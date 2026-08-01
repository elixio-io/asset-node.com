import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Webhook } from '../../models/Webhook'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { requireFeature } from '../middleware/planLimits'
import { isExternalUrl, postSecureWebhook } from '../services/workflowWebhookSecurity'

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin'))
  fastify.addHook('preHandler', requireFeature('api'))

  fastify.get('/', async (request) => {
    const orgId = getOrgId(request)
    return await Webhook.find({ orgId })
      .select('-signingSecret')
      .sort({ createdAt: -1 })
  })

  fastify.post('/', {
    schema: {
      body: Type.Object({
        url: Type.String({ format: 'uri' }),
        events: Type.Array(Type.String(), { minItems: 1 }),
        description: Type.Optional(Type.String({ maxLength: 500 }))
      })
    }
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const { url, events, description } = request.body as {
      url: string; events: string[]; description?: string
    }
    if (!isExternalUrl(url)) {
      return reply.code(400).send({ error: 'Webhook URL must use HTTPS and a public, fully-qualified host' })
    }

    const webhook = await Webhook.create({
      orgId,
      url,
      events,
      description,
      createdBy: (request.user as any).userId
    })

    return reply.code(201).send(webhook)
  })

  fastify.post('/:id/test', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)

    const webhook = await Webhook.findOne({ _id: id, orgId })
    if (!webhook) return reply.code(404).send({ error: 'Webhook not found' })

    try {
      const crypto = await import('crypto')
      const body = JSON.stringify({
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { title: 'Test Webhook', message: 'This is a test payload from AssetNode.' }
      })

      const signature = crypto
        .createHmac('sha256', webhook.signingSecret)
        .update(body)
        .digest('hex')

      const response = await postSecureWebhook(webhook.url, body, {
          'Content-Type': 'application/json',
          'X-HM-Signature': signature,
          'X-HM-Event': 'test'
      })

      return { success: response.ok, status: response.status }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)

    const result = await Webhook.findOneAndDelete({ _id: id, orgId })
    if (!result) return reply.code(404).send({ error: 'Webhook not found' })

    return { message: 'Webhook deleted' }
  })
}

export default webhookRoutes
