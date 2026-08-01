import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Workflow } from '../../models/Workflow'
import { executeWorkflow } from '../services/workflowEngine'
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from '../services/workflowWebhookSecurity'

const hookParamsSchema = Type.Object({
  hookId: Type.String({ minLength: 16, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' })
})

// Hard ceiling for synchronous ('respond' mode) runs — a public endpoint must
// never hang on a slow workflow (Delay/Loop can outlast a caller's patience).
const RESPOND_TIMEOUT_MS = 25_000

const webhookTriggerRoutes: FastifyPluginAsync = async (fastify) => {
  // Plugin-scoped JSON parser that keeps the raw body around (for HMAC signature
  // verification) while still handing the handler a parsed object. Encapsulated
  // to this plugin, so it doesn't affect the app-wide JSON parser.
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as any).rawBody = typeof body === 'string' ? body : ''
    if (!body) return done(null, {})
    try {
      done(null, JSON.parse(body as string))
    } catch {
      // Tolerate non-JSON bodies as the pre-existing handler did (triggerData
      // falls back to just the query string); signature checks fail closed.
      done(null, {})
    }
  })

  fastify.route({
    method: ['GET', 'POST', 'PUT'],
    url: '/:hookId',
    bodyLimit: 100 * 1024,
    schema: { params: hookParamsSchema },
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
        keyGenerator: (request: any) => request.params.hookId
      }
    },
    handler: async (request, reply) => {
      const { hookId } = request.params as { hookId: string }

      const workflow = await Workflow.findOne({
        'triggers.webhookId': hookId,
        isActive: true
      }).select('_id orgId triggers').lean()

      const trigger = (workflow?.triggers || []).find((t: any) => t.webhookId === hookId)
      if (!workflow || !trigger || trigger.method !== request.method) {
        return reply.code(404).send({ error: 'Not found' })
      }

      // Optional HMAC gate: when the trigger carries a signing secret, the caller
      // must present a valid X-Signature-256 over the raw body. Fails closed.
      if ((trigger as any).secret) {
        const rawBody = (request as any).rawBody
        const ok = verifyWebhookSignature(
          typeof rawBody === 'string' ? rawBody : '',
          String((trigger as any).secret),
          request.headers[WEBHOOK_SIGNATURE_HEADER]
        )
        if (!ok) {
          return reply.code(401).send({ error: 'Invalid or missing signature' })
        }
      }

      const body = typeof request.body === 'object' && request.body ? request.body : {}
      const triggerData = { ...body, query: request.query }
      const runArgs = [String(workflow._id), String(workflow.orgId), 'webhook' as const, triggerData, { fromTriggerNodeId: (trigger as any).nodeId }] as const

      // 'respond' mode: run synchronously (with a hard timeout) and return the
      // response an action-respond node set, or a default. Otherwise 202
      // fire-and-forget.
      if ((trigger as any).responseMode === 'respond') {
        try {
          const result = await Promise.race([
            executeWorkflow(...runArgs),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), RESPOND_TIMEOUT_MS))
          ])
          const custom = result.webhookResponse
          if (custom) {
            return reply.code(custom.status).type(custom.contentType).send(custom.body)
          }
          return reply.code(200).send({ ok: result.status !== 'failed', status: result.status })
        } catch (err: any) {
          if (err.message === 'timeout') {
            request.log.warn({ workflowId: String(workflow._id) }, '[WebhookTrigger] synchronous run timed out')
            return reply.code(504).send({ error: 'Workflow did not respond in time' })
          }
          request.log.error({ workflowId: String(workflow._id), err: err.message }, '[WebhookTrigger] execution failed')
          return reply.code(500).send({ error: 'Workflow execution failed' })
        }
      }

      reply.code(202).send({ received: true })
      executeWorkflow(...runArgs).catch((err: any) => {
        request.log.error({ workflowId: String(workflow._id), err: err.message }, '[WebhookTrigger] execution failed')
      })
    }
  })
}

export default webhookTriggerRoutes
