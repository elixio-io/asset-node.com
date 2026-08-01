import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import crypto from 'crypto'
import { Workflow } from '../../models/Workflow'
import { WorkflowRun } from '../../models/WorkflowRun'
import { executeWorkflow } from '../services/workflowEngine'
import { refreshCronWorkflows } from '../services/workflowEventBus'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { checkLimit } from '../middleware/planLimits'
import { normalizeLegacyWorkflowGraph, validateWorkflowGraph } from '../../shared/workflowValidation'

function mintSecret(): string {
  return crypto.randomBytes(24).toString('base64url')
}

// Mint a server-side webhookId for every webhook trigger element that lacks one
// (reusing the existing id for the same trigger node so callable URLs stay
// stable across saves), and mirror it into the matching graph node's data.hookId
// so the frontend can render the real URL. Also manages the optional HMAC
// signing secret: minted (once, server-side) when `requireSignature` is on,
// dropped when it is off; mirrored to node.data.webhookSecret for display.
// Returns updated triggers + nodes.
function ensureWebhookIds(
  triggers: any[],
  nodes: any[] | undefined,
  existingTriggers: any[] = []
): { triggers: any[]; nodes: any[] | undefined } {
  if (!Array.isArray(triggers)) return { triggers, nodes }
  const nodesCopy = Array.isArray(nodes)
    ? nodes.map((n: any) => ({ ...n, data: { ...(n?.data || {}) } }))
    : nodes
  const updatedTriggers = triggers.map((t: any) => {
    if (t?.type !== 'webhook') return t
    const prior = existingTriggers.find(
      (e: any) => e?.nodeId === t.nodeId && e?.type === 'webhook'
    )
    const webhookId = t.webhookId || prior?.webhookId || mintSecret()

    // Secret is never accepted from the client — reuse the persisted one, or
    // mint a fresh one the first time signing is enabled.
    const requireSignature = t.requireSignature === true
    const secret = requireSignature ? (prior?.secret || mintSecret()) : undefined

    if (Array.isArray(nodesCopy)) {
      const node = nodesCopy.find((n: any) => n?.id === t.nodeId && n?.type === 'trigger-webhook')
      if (node) {
        node.data.hookId = webhookId
        if (secret) node.data.webhookSecret = secret
        else delete node.data.webhookSecret
      }
    }
    return { ...t, webhookId, requireSignature, ...(secret ? { secret } : { secret: undefined }) }
  })
  return { triggers: updatedTriggers, nodes: nodesCopy }
}

// TypeBox shape for a single trigger element. No `webhookId` field — AJV's
// removeAdditional strips any client-supplied value; the server is the sole minter.
const triggerElementSchema = Type.Object({
  nodeId: Type.String(),
  type: Type.Union([
    Type.Literal('event'),
    Type.Literal('schedule'),
    Type.Literal('manual'),
    Type.Literal('webhook')
  ]),
  event: Type.Optional(Type.String()),
  cron: Type.Optional(Type.String()),
  cronLabel: Type.Optional(Type.String()),
  method: Type.Optional(Type.Union([Type.Literal('GET'), Type.Literal('POST'), Type.Literal('PUT')])),
  responseMode: Type.Optional(Type.Union([Type.Literal('immediate'), Type.Literal('respond')])),
  requireSignature: Type.Optional(Type.Boolean())
})

const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/events', async () => {
    return {
      events: [
        { value: 'hardware.synced', label: 'Hardware Synced (MDM)', description: 'After an MDM sync completes' },
        { value: 'hardware.created', label: 'Hardware Created', description: 'When a new asset is added' },
        { value: 'hardware.updated', label: 'Hardware Updated', description: 'When an asset is modified' },
        { value: 'hardware.deleted', label: 'Hardware Deleted', description: 'When an asset is removed' },
        { value: 'employee.synced', label: 'Employee Synced (HR)', description: 'After an HR sync completes' },
        { value: 'employee.created', label: 'Employee Created', description: 'When a new employee is added' },
        { value: 'employee.updated', label: 'Employee Updated', description: 'When an employee is modified' },
        { value: 'status.changed', label: 'Status Changed', description: 'When an asset status changes' },
        { value: 'assignment.created', label: 'Assignment Created', description: 'When hardware is assigned' },
        { value: 'assignment.returned', label: 'Assignment Returned', description: 'When hardware is returned' },
        { value: 'maintenance.completed', label: 'Maintenance Completed', description: 'When maintenance finishes' }
      ],
      schedules: [
        { value: '*/5m', label: 'Every 5 minutes' },
        { value: '*/15m', label: 'Every 15 minutes' },
        { value: '*/30m', label: 'Every 30 minutes' },
        { value: '*/1h', label: 'Every hour' },
        { value: '*/6h', label: 'Every 6 hours' },
        { value: '*/12h', label: 'Every 12 hours' },
        { value: '*/24h', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' }
      ],
      conditions: {
        entities: ['hardware', 'employee', 'license', 'consumable'],
        fields: {
          hardware: [
            { value: 'warrantyDaysRemaining', label: 'Warranty days remaining', type: 'number' },
            { value: 'warrantyExpiringCount', label: 'Warranties expiring within 30 days', type: 'number' },
            { value: 'totalCount', label: 'Total device count', type: 'number' },
            { value: 'deviceAge', label: 'Average device age (years)', type: 'number' },
            { value: 'nonCompliantCount', label: 'Non-compliant devices', type: 'number' }
          ],
          employee: [
            { value: 'totalCount', label: 'Total employee count', type: 'number' },
            { value: 'created', label: 'Employees created by event', type: 'number' },
            { value: 'updated', label: 'Employees updated by event', type: 'number' }
          ],
          license: [
            { value: 'expiringCount', label: 'Expiring licenses (30d)', type: 'number' }
          ],
          consumable: [
            { value: 'lowStockCount', label: 'Low stock items', type: 'number' }
          ]
        },
        operators: [
          { value: 'lt', label: 'less than', symbol: '<' },
          { value: 'lte', label: 'less than or equal', symbol: '≤' },
          { value: 'gt', label: 'greater than', symbol: '>' },
          { value: 'gte', label: 'greater than or equal', symbol: '≥' },
          { value: 'eq', label: 'equals', symbol: '=' },
          { value: 'neq', label: 'not equal', symbol: '≠' }
        ]
      }
    }
  })

  fastify.get('/', async (request) => {
    const orgId = getOrgId(request)
    return await Workflow.find({ orgId })
      .sort({ createdAt: -1 })
      .select('-nodes -edges')
      .lean()
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)

    const workflow = await Workflow.findOne({ _id: id, orgId }).lean()
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })

    return workflow
  })

  fastify.post('/', {
    preHandler: [checkLimit('workflows')],
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        description: Type.Optional(Type.String({ maxLength: 1000 })),
        triggers: Type.Array(triggerElementSchema),
        nodes: Type.Optional(Type.Array(Type.Any())),
        edges: Type.Optional(Type.Array(Type.Any())),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const body = sanitizeBody(request.body as any)

    const minted = ensureWebhookIds(body.triggers, body.nodes)
    body.triggers = minted.triggers
    body.nodes = minted.nodes

    if (body.isActive) {
      const normalized = normalizeLegacyWorkflowGraph(body.nodes, body.edges, body.triggers?.[0] ?? { type: 'manual' })
      body.nodes = normalized.nodes
      body.edges = normalized.edges
      const validation = validateWorkflowGraph(body.nodes, body.edges, body.triggers)
      if (!validation.valid) {
        return reply.code(400).send({
          error: 'Workflow cannot be activated until its graph is valid.',
          code: 'WORKFLOW_INVALID',
          issues: validation.issues
        })
      }
    }

    const workflow = await Workflow.create({
      orgId,
      ...body,
      createdBy: (request.user as any).userId
    })

    if (workflow.isActive && workflow.triggers?.some((t: any) => t.type === 'schedule')) {
      await refreshCronWorkflows(orgId)
    }

    return reply.code(201).send(workflow)
  })

  fastify.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        description: Type.Optional(Type.String({ maxLength: 1000 })),
        triggers: Type.Optional(Type.Array(triggerElementSchema)),
        nodes: Type.Optional(Type.Array(Type.Any())),
        edges: Type.Optional(Type.Array(Type.Any())),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)
    const body = sanitizeBody(request.body as any)

    const existing = await Workflow.findOne({ _id: id, orgId })
    if (!existing) return reply.code(404).send({ error: 'Workflow not found' })

    if (body.triggers) {
      const minted = ensureWebhookIds(body.triggers, body.nodes, (existing.triggers || []) as any[])
      body.triggers = minted.triggers
      if (body.nodes) body.nodes = minted.nodes
    }

    const effectiveTriggers = body.triggers ?? (existing.triggers as any)
    const remainsActive = body.isActive ?? existing.isActive
    if (remainsActive) {
      const normalized = normalizeLegacyWorkflowGraph(
        body.nodes ?? existing.nodes as any,
        body.edges ?? existing.edges as any,
        effectiveTriggers?.[0] ?? { type: 'manual' }
      )
      if (normalized.migrated) {
        body.nodes = normalized.nodes
        body.edges = normalized.edges
      }
      const validation = validateWorkflowGraph(
        normalized.nodes,
        normalized.edges,
        effectiveTriggers
      )
      if (!validation.valid) {
        return reply.code(400).send({
          error: 'Deactivate this workflow before saving an invalid draft.',
          code: 'WORKFLOW_INVALID',
          issues: validation.issues
        })
      }
    }

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, orgId },
      { $set: body },
      { new: true }
    )
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })

    await refreshCronWorkflows(orgId)

    return workflow
  })

  fastify.patch('/:id/toggle', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)

    const workflow = await Workflow.findOne({ _id: id, orgId })
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })

    const activating = !workflow.isActive
    if (activating) {
      const triggers = (workflow.triggers || []) as any[]
      const normalized = normalizeLegacyWorkflowGraph(workflow.nodes as any, workflow.edges as any, triggers[0] ?? { type: 'manual' })
      const validation = validateWorkflowGraph(normalized.nodes, normalized.edges, triggers)
      if (!validation.valid) {
        return reply.code(400).send({
          error: 'Workflow cannot be activated until its graph is valid.',
          code: 'WORKFLOW_INVALID',
          issues: validation.issues
        })
      }
      if (normalized.migrated) {
        workflow.set({ nodes: normalized.nodes, edges: normalized.edges })
      }
    }

    // Defensive: mint hookIds for any webhook trigger element still missing one.
    const currentTriggers = (workflow.triggers || []) as any[]
    if (currentTriggers.some((t: any) => t.type === 'webhook' && !t.webhookId)) {
      const minted = ensureWebhookIds(currentTriggers, workflow.nodes as any, currentTriggers)
      workflow.set('triggers', minted.triggers)
      workflow.set('nodes', minted.nodes)
    }

    workflow.isActive = activating
    await workflow.save()

    await refreshCronWorkflows(orgId)

    return { isActive: workflow.isActive }
  })

  fastify.post('/:id/execute', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        triggerData: Type.Optional(Type.Record(Type.String(), Type.Any()))
      }, { additionalProperties: true })
    },
    config: { rawBody: false } as any
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)
    const body = sanitizeBody((request.body as any) || {})

    try {
      await executeWorkflow(id, orgId, 'manual', body.triggerData || {})
      return { success: true, message: 'Workflow executed' }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // Execute the trigger and every node up to (and including) :nodeId with the
  // supplied triggerData — real execution, same executors as a full run, but
  // recorded as a 'test' run: excluded from history and from runCount/lastRunAt.
  fastify.post('/:id/nodes/:nodeId/test', {
    schema: {
      params: Type.Object({ id: Type.String(), nodeId: Type.String() }),
      body: Type.Object({
        triggerData: Type.Optional(Type.Record(Type.String(), Type.Any()))
      }, { additionalProperties: true })
    }
  }, async (request, reply) => {
    const { id, nodeId } = request.params as { id: string; nodeId: string }
    const orgId = getOrgId(request)
    const body = sanitizeBody((request.body as any) || {})

    try {
      const result = await executeWorkflow(id, orgId, 'test', body.triggerData || {}, { stopAfterNodeId: nodeId })
      return {
        runId: result.runId,
        status: result.status,
        nodeResult: result.nodeResults.find(nr => nr.nodeId === nodeId) ?? null,
        nodeResults: result.nodeResults
      }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  fastify.get('/:id/runs', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50, default: 20 }))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { limit = 20 } = request.query as { limit?: number }
    const orgId = getOrgId(request)

    const workflow = await Workflow.findOne({ _id: id, orgId }).select('_id').lean()
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })

    // Test runs (per-node "Execute step") never appear in real run history.
    const runs = await WorkflowRun.find({ workflowId: id, orgId, triggeredBy: { $ne: 'test' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return runs
  })

  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)

    const result = await Workflow.findOneAndDelete({ _id: id, orgId })
    if (!result) return reply.code(404).send({ error: 'Workflow not found' })

    await refreshCronWorkflows(orgId)

    await WorkflowRun.deleteMany({ workflowId: id })

    return { message: 'Workflow deleted' }
  })
}

export default workflowRoutes
