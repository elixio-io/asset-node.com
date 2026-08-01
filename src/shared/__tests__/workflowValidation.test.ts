import { describe, expect, it } from 'vitest'
import {
  deriveWorkflowTrigger,
  deriveWorkflowTriggers,
  isValidWebhookUrlSyntax,
  normalizeLegacyWorkflowGraph,
  validateWorkflowGraph,
  WORKFLOW_EVENT_TYPES,
  type WorkflowGraphEdge,
  type WorkflowGraphNode
} from '../workflowValidation'
import { buildWorkflowStarter, WORKFLOW_STARTER_TEMPLATES } from '../workflowTemplates'
import { computeLoopBodyNodeIds, extractWorkflowTargetIds, matchSwitchCase, shouldSkipWorkflowNode } from '../workflowRouting'

const manualTrigger: WorkflowGraphNode = {
  id: 'trigger',
  type: 'trigger-manual',
  data: {},
  position: { x: 0, y: 0 }
}

const auditAction: WorkflowGraphNode = {
  id: 'action',
  type: 'action-audit-log',
  data: { severity: 'info', category: 'operations', message: 'Done' },
  position: { x: 200, y: 0 }
}

const connectedEdge: WorkflowGraphEdge = {
  id: 'edge',
  source: 'trigger',
  target: 'action'
}

describe('workflow graph validation', () => {
  it('accepts every shipped starter template', () => {
    for (const template of WORKFLOW_STARTER_TEMPLATES) {
      const starter = buildWorkflowStarter(template.id, 1)
      const result = validateWorkflowGraph(starter.nodes, starter.edges, starter.trigger)
      expect(result.errors, template.id).toEqual([])
      expect(result.valid, template.id).toBe(true)
    }
  })

  it('creates a blank draft with exactly one Manual / API trigger', () => {
    const starter = buildWorkflowStarter('blank', 7)
    const result = validateWorkflowGraph(starter.nodes, starter.edges, starter.trigger)

    expect(starter.name).toBe('Untitled automation 7')
    expect(starter.nodes).toHaveLength(1)
    expect(starter.nodes[0].type).toBe('trigger-manual')
    expect(result.errors.map(issue => issue.code)).toEqual(['action-missing'])
  })

  it('requires at least one trigger and one action', () => {
    const missing = validateWorkflowGraph([auditAction], [], { type: 'manual' })
    expect(missing.errors.map(issue => issue.code)).toContain('trigger-missing')
  })

  it('allows multiple triggers feeding a shared action', () => {
    const manualT = { ...manualTrigger }
    const eventT = { ...manualTrigger, id: 'trigger-2', type: 'trigger-event', data: { event: 'hardware.created' } }
    const result = validateWorkflowGraph([
      manualT,
      eventT,
      auditAction
    ], [
      { id: 'e1', source: 'trigger', target: 'action' },
      { id: 'e2', source: 'trigger-2', target: 'action' }
    ], [
      { type: 'manual', nodeId: 'trigger' },
      { type: 'event', event: 'hardware.created', nodeId: 'trigger-2' }
    ])
    expect(result.errors.map(issue => issue.code)).not.toContain('trigger-multiple')
    expect(result.errors.map(issue => issue.code)).not.toContain('node-disconnected')
    expect(result.valid).toBe(true)
  })

  it('flags a mutating action reachable from a webhook trigger even when another trigger is safe', () => {
    // Manual trigger (safe) + Webhook trigger (unsafe) both reach a status action.
    const statusAction = { id: 'status', type: 'action-status', data: { statusSlug: 'available' }, position: { x: 400, y: 0 } }
    const result = validateWorkflowGraph([
      { ...manualTrigger },
      { ...manualTrigger, id: 'hook', type: 'trigger-webhook', data: { method: 'POST', hookId: 'abc123' } },
      statusAction
    ], [
      { id: 'e1', source: 'trigger', target: 'status' },
      { id: 'e2', source: 'hook', target: 'status' }
    ], [
      { type: 'manual', nodeId: 'trigger' },
      { type: 'webhook', method: 'POST', webhookId: 'abc123', nodeId: 'hook' }
    ])
    expect(result.errors.map(issue => issue.code)).toContain('mutation-target-unavailable')
  })

  it('rejects disconnected nodes, dangling edges, and cycles', () => {
    const disconnected = validateWorkflowGraph([manualTrigger, auditAction], [], { type: 'manual' })
    expect(disconnected.errors.map(issue => issue.code)).toContain('node-disconnected')

    const dangling = validateWorkflowGraph([manualTrigger, auditAction], [
      connectedEdge,
      { id: 'dangling', source: 'missing', target: 'action' }
    ], { type: 'manual' })
    expect(dangling.errors.map(issue => issue.code)).toContain('edge-dangling')

    const cycle = validateWorkflowGraph([manualTrigger, auditAction], [
      connectedEdge,
      { id: 'back', source: 'action', target: 'trigger' }
    ], { type: 'manual' })
    expect(cycle.errors.map(issue => issue.code)).toContain('graph-cycle')
    expect(cycle.errors.map(issue => issue.code)).toContain('trigger-has-input')
  })

  it('rejects incomplete event/schedule configuration and saved trigger drift', () => {
    const eventNode = { ...manualTrigger, type: 'trigger-event', data: { event: '' } }
    const incomplete = validateWorkflowGraph([eventNode, auditAction], [connectedEdge], { type: 'event' })
    expect(incomplete.errors.map(issue => issue.code)).toContain('event-missing')

    const scheduleNode = { ...manualTrigger, type: 'trigger-schedule', data: { cron: '*/24h' } }
    const drift = validateWorkflowGraph([scheduleNode, auditAction], [connectedEdge], { type: 'manual' })
    expect(drift.errors.map(issue => issue.code)).toContain('trigger-out-of-sync')
  })

  it('keeps webhook trigger nodes usable and validates their method, blocking saved-trigger drift', () => {
    const result = validateWorkflowGraph([
      { ...manualTrigger, type: 'trigger-webhook', data: { method: 'POST', hookId: 'abc123' } },
      auditAction
    ], [connectedEdge], { type: 'webhook', method: 'POST', webhookId: 'abc123' })

    expect(result.valid).toBe(true)

    const badMethod = validateWorkflowGraph([
      { ...manualTrigger, type: 'trigger-webhook', data: { method: 'DELETE' } },
      auditAction
    ], [connectedEdge], { type: 'webhook' })
    expect(badMethod.errors.map(issue => issue.code)).toContain('webhook-method-invalid')

    const outOfSync = validateWorkflowGraph([
      { ...manualTrigger, type: 'trigger-webhook', data: { method: 'POST' } },
      auditAction
    ], [connectedEdge], { type: 'manual' })
    expect(outOfSync.errors.map(issue => issue.code)).toContain('trigger-out-of-sync')
  })

  it('blocks mutating actions downstream of a webhook trigger', () => {
    const assignAction = {
      id: 'assign', type: 'action-assign', data: { assignTo: 'itAdmin' }, position: { x: 200, y: 0 }
    }
    const result = validateWorkflowGraph([
      { ...manualTrigger, type: 'trigger-webhook', data: { method: 'POST', hookId: 'abc123' } },
      assignAction
    ], [{ id: 'edge', source: 'trigger', target: 'assign' }], { type: 'webhook', method: 'POST', webhookId: 'abc123' })

    expect(result.errors.map(issue => issue.code)).toContain('mutation-target-unavailable')
  })

  it('validates the Get Records source node and lets it supply mutation targets from any trigger', () => {
    // A schedule normally can't mutate (no target), but a Get Records source
    // upstream supplies per-item targets, so the chain is valid.
    const scheduleFed = validateWorkflowGraph([
      { ...manualTrigger, type: 'trigger-schedule', data: { cron: 'weekly' } },
      { id: 'get', type: 'action-get-records', data: { entity: 'hardware', limit: 50 }, position: { x: 200, y: 0 } },
      { id: 'upd', type: 'action-update-field', data: { entity: 'hardware', field: 'notes', value: 'x' }, position: { x: 400, y: 0 } }
    ], [
      { id: 'e1', source: 'trigger', target: 'get' },
      { id: 'e2', source: 'get', target: 'upd' }
    ], { type: 'schedule', cron: 'weekly' })
    expect(scheduleFed.errors.map(e => e.code)).not.toContain('mutation-target-unavailable')
    expect(scheduleFed.valid).toBe(true)

    // Invalid entity is rejected.
    const badEntity = validateWorkflowGraph([
      manualTrigger,
      { id: 'get', type: 'action-get-records', data: { entity: 'invoices', limit: 50 }, position: { x: 200, y: 0 } }
    ], [{ id: 'e', source: 'trigger', target: 'get' }], { type: 'manual' })
    expect(badEntity.errors.map(e => e.code)).toContain('get-records-entity-invalid')
  })

  it('accepts an item-field condition without an aggregate entity/field', () => {
    const result = validateWorkflowGraph([
      manualTrigger,
      { id: 'cond', type: 'condition', data: { itemField: 'status', operator: 'eq', value: 'active' }, position: { x: 200, y: 0 } },
      { ...auditAction, id: 'a2' }
    ], [
      { id: 'e1', source: 'trigger', target: 'cond' },
      { id: 'e2', source: 'cond', target: 'a2', sourceHandle: 'true' }
    ], { type: 'manual' })
    expect(result.errors.map(e => e.code)).not.toContain('condition-field-invalid')
    expect(result.errors.map(e => e.code)).not.toContain('condition-incomplete')
  })

  it('derives supported top-level trigger semantics from the graph', () => {
    expect(deriveWorkflowTrigger([{ ...manualTrigger, type: 'trigger-event', data: { event: 'hardware.created' } }]))
      .toEqual({ type: 'event', event: 'hardware.created' })
    expect(deriveWorkflowTrigger([{ ...manualTrigger, type: 'trigger-schedule', data: { cron: 'weekly' } }]))
      .toEqual({ type: 'schedule', cron: 'weekly' })
    expect(deriveWorkflowTrigger([manualTrigger])).toEqual({ type: 'manual' })
    expect(deriveWorkflowTrigger([{ ...manualTrigger, type: 'trigger-webhook', data: {} }]))
      .toEqual({ type: 'webhook', method: 'POST', responseMode: 'immediate', requireSignature: false })
    expect(deriveWorkflowTrigger([{ ...manualTrigger, type: 'trigger-webhook', data: { hookId: 'abc', method: 'GET' } }]))
      .toEqual({ type: 'webhook', method: 'GET', responseMode: 'immediate', requireSignature: false, webhookId: 'abc' })
  })

  it('derives one config per trigger node, each carrying its nodeId', () => {
    const triggers = deriveWorkflowTriggers([
      { id: 'a', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', type: 'trigger-event', data: { event: 'hardware.created' }, position: { x: 0, y: 100 } },
      { id: 'c', type: 'trigger-webhook', data: { hookId: 'xyz', method: 'POST' }, position: { x: 0, y: 200 } },
      { id: 'action', type: 'action-audit-log', data: {}, position: { x: 200, y: 0 } }
    ])
    expect(triggers).toEqual([
      { type: 'manual', nodeId: 'a' },
      { type: 'event', event: 'hardware.created', nodeId: 'b' },
      { type: 'webhook', method: 'POST', responseMode: 'immediate', requireSignature: false, webhookId: 'xyz', nodeId: 'c' }
    ])
  })

  it('repairs legacy graphs that stored their trigger only at the top level', () => {
    const legacyAction = { ...auditAction, id: 'legacy-action' }
    const normalized = normalizeLegacyWorkflowGraph([legacyAction], [], {
      type: 'event',
      event: 'hardware.created'
    })

    expect(normalized.migrated).toBe(true)
    expect(normalized.nodes[0]).toMatchObject({
      type: 'trigger-event',
      data: { event: 'hardware.created' }
    })
    expect(normalized.edges).toEqual([
      expect.objectContaining({ source: normalized.nodes[0].id, target: 'legacy-action' })
    ])
    expect(validateWorkflowGraph(normalized.nodes, normalized.edges, { type: 'event', event: 'hardware.created' }).valid).toBe(true)
  })

  it('requires complete action configuration that the runtime can execute', () => {
    const badStatus = { ...auditAction, type: 'action-status', data: { statusSlug: '' } }
    expect(validateWorkflowGraph([manualTrigger, badStatus], [connectedEdge], { type: 'manual' }).errors.map(issue => issue.code))
      .toContain('status-missing')

    const badUpdate = { ...auditAction, type: 'action-update-field', data: { entity: 'component', field: 'name', value: 'x' } }
    expect(validateWorkflowGraph([manualTrigger, badUpdate], [connectedEdge], { type: 'manual' }).errors.map(issue => issue.code))
      .toContain('update-field-unsupported')
  })

  it('rejects unknown nodes and unsupported condition semantics', () => {
    const unknown = { ...auditAction, type: 'action-magic' }
    expect(validateWorkflowGraph([manualTrigger, unknown], [connectedEdge], { type: 'manual' }).errors.map(issue => issue.code))
      .toContain('node-type-unsupported')

    const badCondition = {
      ...auditAction,
      id: 'condition',
      type: 'condition',
      data: { entity: 'hardware', field: 'rootPassword', operator: 'exec', value: 'x' }
    }
    const result = validateWorkflowGraph([manualTrigger, badCondition, auditAction], [
      { source: 'trigger', target: 'condition' },
      { source: 'condition', target: 'action', sourceHandle: 'true' }
    ], { type: 'manual' })
    expect(result.errors.map(issue => issue.code)).toContain('condition-field-invalid')
    expect(result.errors.map(issue => issue.code)).toContain('condition-operator-invalid')
  })

  it('blocks UI/runtime mismatches for status, delay, notification, and webhook actions', () => {
    const invalidActions: Array<[WorkflowGraphNode, string]> = [
      [{ ...auditAction, type: 'action-status', data: { statusSlug: 'deployed' } }, 'status-invalid'],
      [{ ...auditAction, type: 'logic-delay', data: { duration: 1, unit: 'days' } }, 'delay-invalid'],
      [{ ...auditAction, type: 'action-notify', data: { channel: 'inApp', title: 'Hi', message: 'Message' } }, 'notification-channel-invalid'],
      [{ ...auditAction, type: 'action-webhook', data: { url: 'http://hooks.example.com' } }, 'webhook-url-invalid'],
      [{ ...auditAction, type: 'action-sync', data: { provider: 'not-a-provider' } }, 'sync-provider-invalid']
    ]

    for (const [action, code] of invalidActions) {
      const result = validateWorkflowGraph([manualTrigger, action], [connectedEdge], { type: 'manual' })
      expect(result.errors.map(issue => issue.code), action.type).toContain(code)
    }
    expect(isValidWebhookUrlSyntax('https://internal/hook')).toBe(false)

    // A known provider (and the 'all' default) validate cleanly.
    for (const provider of ['all', 'personio', 'jamf']) {
      const ok = validateWorkflowGraph([manualTrigger, { ...auditAction, type: 'action-sync', data: { provider } }], [connectedEdge], { type: 'manual' })
      expect(ok.errors.map(i => i.code), provider).not.toContain('sync-provider-invalid')
    }
  })

  it('advertises only events that have real emitters', () => {
    expect(WORKFLOW_EVENT_TYPES).toContain('hardware.created')
    expect(WORKFLOW_EVENT_TYPES).toContain('employee.updated')
    expect(WORKFLOW_EVENT_TYPES).not.toContain('license.expired')
    expect(WORKFLOW_EVENT_TYPES).not.toContain('lowStock.alert')
  })

  it('extracts only explicit entity-specific mutation targets', () => {
    expect(extractWorkflowTargetIds({ hardwareIds: ['a', 'b', 'a'], employeeId: 'employee' }, 'hardware'))
      .toEqual(['a', 'b'])
    expect(extractWorkflowTargetIds({ hardwareId: 'hardware' }, 'employee')).toEqual([])
  })

  it('blocks mutation actions behind triggers that cannot identify a target', () => {
    const scheduledTrigger = { ...manualTrigger, type: 'trigger-schedule', data: { cron: '*/24h' } }
    const statusAction = { ...auditAction, type: 'action-status', data: { statusSlug: 'available' } }
    const scheduled = validateWorkflowGraph(
      [scheduledTrigger, statusAction],
      [connectedEdge],
      { type: 'schedule', cron: '*/24h' }
    )
    expect(scheduled.errors.map(issue => issue.code)).toContain('mutation-target-unavailable')

    const deletedTrigger = { ...manualTrigger, type: 'trigger-event', data: { event: 'hardware.deleted' } }
    const deleted = validateWorkflowGraph(
      [deletedTrigger, statusAction],
      [connectedEdge],
      { type: 'event', event: 'hardware.deleted' }
    )
    expect(deleted.errors.map(issue => issue.code)).toContain('mutation-target-unavailable')
  })
})

describe('Switch / Cases routing', () => {
  const switchNode: WorkflowGraphNode = {
    id: 'switch',
    type: 'logic-switch',
    data: { field: 'status', branches: ['Ready', 'Failed', ''] }
  }
  const caseAction = { ...auditAction, id: 'case-action' }
  const defaultAction = { ...auditAction, id: 'default-action' }
  const edges: WorkflowGraphEdge[] = [
    { id: 'to-switch', source: 'trigger', target: 'switch' },
    { id: 'case', source: 'switch', target: 'case-action', sourceHandle: 'branch-0' },
    { id: 'default', source: 'switch', target: 'default-action', sourceHandle: 'default' }
  ]

  it('matches exact case values without capitalization or whitespace surprises', () => {
    expect(matchSwitchCase(' ready ', ['Ready', 'Failed'])).toBe(0)
    expect(matchSwitchCase('FAILED', ['Ready', 'Failed'])).toBe(1)
    expect(matchSwitchCase('', ['', 'Ready'])).toBe(-1)
    expect(matchSwitchCase('Unknown', ['Ready', 'Failed'])).toBe(-1)
  })

  it('accepts a configured default output and warns for an unconnected case only', () => {
    const result = validateWorkflowGraph(
      [manualTrigger, switchNode, caseAction, defaultAction],
      edges,
      { type: 'manual' }
    )

    expect(result.valid).toBe(true)
    expect(result.warnings.map(issue => issue.code)).toEqual(['switch-case-unconnected'])
  })

  it('rejects empty and duplicate case configurations', () => {
    const emptySwitch = { ...switchNode, data: { field: 'status', branches: ['', ''] } }
    const empty = validateWorkflowGraph([manualTrigger, emptySwitch, defaultAction], [
      { id: 'to-switch', source: 'trigger', target: 'switch' },
      { id: 'default', source: 'switch', target: 'default-action', sourceHandle: 'default' }
    ], { type: 'manual' })
    expect(empty.errors.map(issue => issue.code)).toContain('switch-cases-missing')

    const duplicateSwitch = { ...switchNode, data: { field: 'status', branches: ['Ready', 'ready'] } }
    const duplicate = validateWorkflowGraph([manualTrigger, duplicateSwitch, caseAction, defaultAction], edges, { type: 'manual' })
    expect(duplicate.errors.map(issue => issue.code)).toContain('switch-cases-duplicate')
  })

  it('rejects edges aimed at a blank or nonexistent case handle', () => {
    const invalid = validateWorkflowGraph([manualTrigger, switchNode, caseAction], [
      { source: 'trigger', target: 'switch' },
      { source: 'switch', target: 'case-action', sourceHandle: 'branch-2' }
    ], { type: 'manual' })
    expect(invalid.errors.map(issue => issue.code)).toContain('switch-handle-invalid')
  })

  it('runs Default only for unmatched values', () => {
    const outputs = new Map([['switch', { matchedBranch: -1, value: 'Unknown' }]])
    expect(shouldSkipWorkflowNode('default-action', edges, new Map(), outputs, new Set())).toBe(false)
    expect(shouldSkipWorkflowNode('case-action', edges, new Map(), outputs, new Set())).toBe(true)
  })

  it('runs a join when any incoming branch is active', () => {
    const joinEdges: WorkflowGraphEdge[] = [
      { source: 'condition', target: 'join', sourceHandle: 'true' },
      { source: 'condition', target: 'join', sourceHandle: 'false' }
    ]

    expect(shouldSkipWorkflowNode('join', joinEdges, new Map([['condition', true]]), new Map(), new Set())).toBe(false)
    expect(shouldSkipWorkflowNode('join', joinEdges, new Map([['condition', false]]), new Map(), new Set())).toBe(false)
  })

  it('propagates a skipped branch to downstream nodes', () => {
    const downstreamEdges: WorkflowGraphEdge[] = [{ source: 'skipped-action', target: 'next-action' }]
    expect(shouldSkipWorkflowNode('next-action', downstreamEdges, new Map(), new Map(), new Set(['skipped-action']))).toBe(true)
  })

  it('blocks a dependent path when the failed source is marked non-runnable', () => {
    const downstreamEdges: WorkflowGraphEdge[] = [{ source: 'failed-action', target: 'dependent-action' }]
    expect(shouldSkipWorkflowNode('dependent-action', downstreamEdges, new Map(), new Map(), new Set(['failed-action']))).toBe(true)
  })
})

describe('loop nodes', () => {
  const loopEdges: WorkflowGraphEdge[] = [
    { id: 't', source: 'trigger', target: 'loop' },
    { id: 'l1', source: 'loop', sourceHandle: 'loop', target: 'body-a' },
    { id: 'l2', source: 'body-a', target: 'body-b' },
    { id: 'd1', source: 'loop', sourceHandle: 'done', target: 'after' }
  ]

  it('computes the loop body from the "loop" handle, excluding the done path', () => {
    const body = computeLoopBodyNodeIds('loop', loopEdges)
    expect([...body].sort()).toEqual(['body-a', 'body-b'])
    expect(body.has('after')).toBe(false)
    expect(body.has('trigger')).toBe(false)
  })

  const loopBase = (mode: string, extra: Record<string, any> = {}) => ({
    id: 'loop', type: 'logic-loop',
    data: { mode, maxIterations: 100, ...extra }, position: { x: 200, y: 0 }
  })
  const auditBody = { id: 'body-a', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'x' }, position: { x: 400, y: 0 } }

  const validLoopGraph = (loopNode: any) => validateWorkflowGraph(
    [manualTrigger, loopNode, auditBody, { ...auditAction, id: 'after' }],
    [
      { id: 't', source: 'trigger', target: 'loop' },
      { id: 'l', source: 'loop', sourceHandle: 'loop', target: 'body-a' },
      { id: 'd', source: 'loop', sourceHandle: 'done', target: 'after' }
    ],
    [{ type: 'manual', nodeId: 'trigger' }]
  )

  it('accepts a well-formed forEach loop', () => {
    const result = validLoopGraph(loopBase('forEach', { entity: 'hardware' }))
    expect(result.errors.map(i => i.code)).not.toContain('loop-entity-missing')
    expect(result.valid).toBe(true)
  })

  it('flags mode-specific missing config', () => {
    expect(validLoopGraph(loopBase('forEach')).errors.map(i => i.code)).toContain('loop-entity-missing')
    expect(validLoopGraph(loopBase('times', { count: 0 })).errors.map(i => i.code)).toContain('loop-count-invalid')
    expect(validLoopGraph(loopBase('while', { entity: 'hardware' })).errors.map(i => i.code)).toContain('loop-condition-incomplete')
    expect(validLoopGraph(loopBase('forEach', { entity: 'hardware', maxIterations: 9999 })).errors.map(i => i.code)).toContain('loop-max-invalid')
  })

  it('validates Human Review config and rejects approval nodes inside a loop body', () => {
    const approvalOk = validateWorkflowGraph(
      [manualTrigger,
        { id: 'review', type: 'logic-approval', data: { channel: 'email', approverEmail: 'a@b.com', title: 'T', message: 'M' }, position: { x: 200, y: 0 } },
        { ...auditAction, id: 'ok' }],
      [
        { id: 't', source: 'trigger', target: 'review' },
        { id: 'a', source: 'review', sourceHandle: 'approved', target: 'ok' }
      ],
      [{ type: 'manual', nodeId: 'trigger' }]
    )
    expect(approvalOk.errors.map(i => i.code)).not.toContain('approval-approver-missing')

    const missing = validateWorkflowGraph(
      [manualTrigger,
        { id: 'review', type: 'logic-approval', data: { channel: 'email' }, position: { x: 200, y: 0 } },
        { ...auditAction, id: 'ok' }],
      [
        { id: 't', source: 'trigger', target: 'review' },
        { id: 'a', source: 'review', sourceHandle: 'approved', target: 'ok' }
      ],
      [{ type: 'manual', nodeId: 'trigger' }]
    )
    expect(missing.errors.map(i => i.code)).toContain('approval-approver-missing')
    expect(missing.errors.map(i => i.code)).toContain('approval-content-missing')

    // An approval node inside a loop body is rejected.
    const inLoop = validateWorkflowGraph(
      [manualTrigger,
        { id: 'loop', type: 'logic-loop', data: { mode: 'times', count: 2, maxIterations: 10 }, position: { x: 200, y: 0 } },
        { id: 'review', type: 'logic-approval', data: { channel: 'email', approverEmail: 'a@b.com', title: 'T', message: 'M' }, position: { x: 400, y: 0 } }],
      [
        { id: 't', source: 'trigger', target: 'loop' },
        { id: 'l', source: 'loop', sourceHandle: 'loop', target: 'review' }
      ],
      [{ type: 'manual', nodeId: 'trigger' }]
    )
    expect(inLoop.errors.map(i => i.code)).toContain('loop-approval-unsupported')
  })

  it('rejects a loop with no body connected to the "loop" output', () => {
    const result = validateWorkflowGraph(
      [manualTrigger, loopBase('times', { count: 2 }), { ...auditAction, id: 'after' }],
      [
        { id: 't', source: 'trigger', target: 'loop' },
        { id: 'd', source: 'loop', sourceHandle: 'done', target: 'after' }
      ],
      [{ type: 'manual', nodeId: 'trigger' }]
    )
    expect(result.errors.map(i => i.code)).toContain('loop-body-missing')
  })

  it('rejects nested loops and non-isolated body nodes', () => {
    const nested = validateWorkflowGraph(
      [manualTrigger, loopBase('times', { count: 2 }), { id: 'body-a', type: 'logic-loop', data: { mode: 'times', count: 2, maxIterations: 10 }, position: { x: 400, y: 0 } }],
      [
        { id: 't', source: 'trigger', target: 'loop' },
        { id: 'l', source: 'loop', sourceHandle: 'loop', target: 'body-a' }
      ],
      [{ type: 'manual', nodeId: 'trigger' }]
    )
    expect(nested.errors.map(i => i.code)).toContain('loop-nested-unsupported')

    // A body node also fed directly by the trigger (from outside the loop).
    const leaky = validateWorkflowGraph(
      [manualTrigger, loopBase('times', { count: 2 }), auditBody, { ...auditAction, id: 'after' }],
      [
        { id: 't', source: 'trigger', target: 'loop' },
        { id: 'l', source: 'loop', sourceHandle: 'loop', target: 'body-a' },
        { id: 'leak', source: 'trigger', target: 'body-a' },
        { id: 'd', source: 'loop', sourceHandle: 'done', target: 'after' }
      ],
      [{ type: 'manual', nodeId: 'trigger' }]
    )
    expect(leaky.errors.map(i => i.code)).toContain('loop-body-not-isolated')
  })
})
