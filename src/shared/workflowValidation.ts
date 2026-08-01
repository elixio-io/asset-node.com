import { WORKFLOW_NODE_CATALOG, SYNC_PROVIDERS, GET_RECORDS_ENTITIES, GET_RECORDS_MAX_LIMIT } from './workflowNodeCatalog'
import { computeLoopBodyNodeIds } from './workflowRouting'

const LOOP_ENTITIES = ['hardware', 'employee', 'license', 'consumable']

export interface WorkflowGraphNode {
  id: string
  type?: string
  data?: Record<string, any>
  position?: { x: number; y: number }
}

export interface WorkflowGraphEdge {
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
}

export interface WorkflowTriggerConfig {
  type: 'event' | 'schedule' | 'manual' | 'webhook'
  event?: string
  cron?: string
  cronLabel?: string
  webhookId?: string
  method?: 'GET' | 'POST' | 'PUT'
  responseMode?: 'immediate' | 'respond'
  requireSignature?: boolean
  // Links this trigger config to its graph node. Present on configs derived via
  // deriveWorkflowTriggers (the multi-trigger path); absent on the legacy
  // single-trigger shape passed by older callers/tests.
  nodeId?: string
}

export type WorkflowValidationSeverity = 'error' | 'warning'

export interface WorkflowValidationIssue {
  code: string
  message: string
  severity: WorkflowValidationSeverity
  nodeId?: string
}

export interface WorkflowValidationResult {
  valid: boolean
  errors: WorkflowValidationIssue[]
  warnings: WorkflowValidationIssue[]
  issues: WorkflowValidationIssue[]
}

export interface NormalizedWorkflowGraph {
  nodes: WorkflowGraphNode[]
  edges: WorkflowGraphEdge[]
  migrated: boolean
}

export const WORKFLOW_EVENT_TYPES = [
  'hardware.synced', 'hardware.created', 'hardware.updated', 'hardware.deleted',
  'employee.synced', 'employee.created', 'employee.updated',
  'status.changed',
  'assignment.created', 'assignment.returned',
  'maintenance.completed'
] as const

export const WORKFLOW_SCHEDULES = [
  '*/5m', '*/15m', '*/30m', '*/1h', '*/6h', '*/12h', '*/24h', 'weekly'
] as const

export const WORKFLOW_UPDATE_FIELDS: Record<string, readonly string[]> = {
  hardware: ['assetName', 'notes', 'serialNumber', 'warrantyExpiry', 'purchaseDate', 'purchasePrice'],
  license: ['name', 'notes', 'totalSeats', 'expirationDate', 'renewalDate'],
  consumable: ['name', 'notes', 'totalQuantity', 'minimumQuantity'],
  employee: ['jobTitle', 'notes', 'phone']
}

export const WORKFLOW_STATUS_SLUGS = [
  'available', 'assigned', 'defective', 'for-sale', 'in-repair',
  'retired', 'lost', 'disposed', 'on-order'
] as const

export const WORKFLOW_NOTIFICATION_CHANNELS = ['email', 'slack', 'teams'] as const
export const WORKFLOW_MAINTENANCE_TYPES = ['repair', 'preventive', 'upgrade', 'inspection', 'cleaning'] as const

export const WORKFLOW_CONDITION_FIELDS: Record<string, readonly string[]> = {
  hardware: ['warrantyExpiringCount', 'warrantyDaysRemaining', 'totalCount', 'deviceAge', 'nonCompliantCount'],
  employee: ['totalCount', 'created', 'updated'],
  license: ['expiringCount'],
  consumable: ['lowStockCount']
}

export const WORKFLOW_CONDITION_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'] as const
export const WORKFLOW_SWITCH_FIELDS = [
  'status', 'category', 'location', 'department', 'manufacturer', 'assignee', 'provider'
] as const

// Derived from the node catalog — the single source of truth for node types.
export const WORKFLOW_NODE_TYPES: readonly string[] = WORKFLOW_NODE_CATALOG.map(entry => entry.type)

const SUPPORTED_TRIGGER_NODES = new Set([
  'trigger-event',
  'trigger-schedule',
  'trigger-webhook',
  'trigger-manual'
])

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0
}

function addIssue(
  issues: WorkflowValidationIssue[],
  severity: WorkflowValidationSeverity,
  code: string,
  message: string,
  nodeId?: string
) {
  issues.push({ severity, code, message, ...(nodeId ? { nodeId } : {}) })
}

// Per-node trigger config WITHOUT nodeId (the legacy single-trigger shape).
function triggerConfigFromNode(triggerNode: WorkflowGraphNode): WorkflowTriggerConfig | null {
  if (triggerNode.type === 'trigger-event') {
    return { type: 'event', ...(hasValue(triggerNode.data?.event) ? { event: String(triggerNode.data?.event) } : {}) }
  }
  if (triggerNode.type === 'trigger-schedule') {
    return { type: 'schedule', ...(hasValue(triggerNode.data?.cron) ? { cron: String(triggerNode.data?.cron) } : {}) }
  }
  if (triggerNode.type === 'trigger-manual') return { type: 'manual' }
  if (triggerNode.type === 'trigger-webhook') {
    const method = hasValue(triggerNode.data?.method) ? String(triggerNode.data?.method) : 'POST'
    const responseMode = triggerNode.data?.responseMode === 'respond' ? 'respond' : 'immediate'
    return {
      type: 'webhook',
      method: method as 'GET' | 'POST' | 'PUT',
      responseMode,
      requireSignature: triggerNode.data?.requireSignature === true,
      ...(hasValue(triggerNode.data?.hookId) ? { webhookId: String(triggerNode.data?.hookId) } : {})
    }
  }
  return null
}

// Legacy single-trigger accessor — returns the first trigger's config (no nodeId).
// Kept for backward compatibility; new callers should use deriveWorkflowTriggers.
export function deriveWorkflowTrigger(
  nodes: WorkflowGraphNode[],
  fallback: WorkflowTriggerConfig = { type: 'manual' }
): WorkflowTriggerConfig {
  const triggerNode = nodes.find(node => String(node.type || '').startsWith('trigger-'))
  if (!triggerNode) return fallback
  return triggerConfigFromNode(triggerNode) ?? fallback
}

// One config per trigger node, each carrying its nodeId. This is the canonical
// source that gets persisted to Workflow.triggers[].
export function deriveWorkflowTriggers(nodes: WorkflowGraphNode[]): WorkflowTriggerConfig[] {
  return nodes
    .filter(node => String(node.type || '').startsWith('trigger-'))
    .map(node => {
      const cfg = triggerConfigFromNode(node)
      return cfg ? { ...cfg, nodeId: node.id } : { type: 'manual' as const, nodeId: node.id }
    })
}

export function mirrorWebhookIdIntoNodes(
  nodes: WorkflowGraphNode[] | undefined | null,
  webhookId: string
): WorkflowGraphNode[] | undefined | null {
  if (!Array.isArray(nodes)) return nodes
  return nodes.map(node =>
    node?.type === 'trigger-webhook'
      ? { ...node, data: { ...(node.data || {}), hookId: webhookId } }
      : node
  )
}

export function normalizeLegacyWorkflowGraph(
  nodesInput: WorkflowGraphNode[] | null | undefined,
  edgesInput: WorkflowGraphEdge[] | null | undefined,
  trigger: WorkflowTriggerConfig
): NormalizedWorkflowGraph {
  const nodes = Array.isArray(nodesInput) ? [...nodesInput] : []
  const edges = Array.isArray(edgesInput) ? [...edgesInput] : []
  if (nodes.some(node => String(node.type || '').startsWith('trigger-'))) {
    return { nodes, edges, migrated: false }
  }

  const existingIds = new Set(nodes.map(node => node.id))
  let triggerId = 'trigger-migrated'
  let suffix = 1
  while (existingIds.has(triggerId)) triggerId = `trigger-migrated-${suffix++}`

  const triggerType = trigger.type === 'event'
    ? 'trigger-event'
    : trigger.type === 'schedule'
      ? 'trigger-schedule'
      : 'trigger-manual'
  const triggerData = trigger.type === 'event'
    ? { event: trigger.event || '' }
    : trigger.type === 'schedule'
      ? { cron: trigger.cron || '' }
      : { description: 'Run manually or via API' }

  const minX = nodes.length > 0
    ? Math.min(...nodes.map(node => Number(node.position?.x ?? 400)))
    : 400
  const minY = nodes.length > 0
    ? Math.min(...nodes.map(node => Number(node.position?.y ?? 200)))
    : 200
  const triggerNode: WorkflowGraphNode = {
    id: triggerId,
    type: triggerType,
    data: triggerData,
    position: { x: minX - 300, y: minY }
  }

  const targets = new Set(edges.map(edge => edge.target))
  const roots = nodes.filter(node => !targets.has(node.id))
  const migrationEdges = roots.map((node, index) => ({
    id: `edge-${triggerId}-${node.id}-${index}`,
    source: triggerId,
    target: node.id
  }))

  return {
    nodes: [triggerNode, ...nodes],
    edges: [...migrationEdges, ...edges],
    migrated: true
  }
}

export function validateWorkflowGraph(
  nodesInput: WorkflowGraphNode[] | null | undefined,
  edgesInput: WorkflowGraphEdge[] | null | undefined,
  trigger?: WorkflowTriggerConfig | WorkflowTriggerConfig[] | null
): WorkflowValidationResult {
  const nodes = Array.isArray(nodesInput) ? nodesInput : []
  const edges = Array.isArray(edgesInput) ? edgesInput : []
  const issues: WorkflowValidationIssue[] = []

  // Accept both the legacy single-trigger object and the new triggers[] array.
  const triggerList: WorkflowTriggerConfig[] = Array.isArray(trigger)
    ? trigger
    : trigger
      ? [trigger]
      : []
  // Resolve the persisted config for a given trigger node: by nodeId when the
  // configs carry one, else fall back to the sole legacy config (no nodeId).
  const configForNode = (nodeId: string): WorkflowTriggerConfig | undefined =>
    triggerList.find(t => t.nodeId === nodeId)
    ?? (triggerList.length === 1 && triggerList[0].nodeId === undefined ? triggerList[0] : undefined)

  const nodeIds = new Set<string>()
  const duplicateNodeIds = new Set<string>()
  for (const node of nodes) {
    if (!hasValue(node.id)) {
      addIssue(issues, 'error', 'node-id-missing', 'Every node needs an identifier.')
      continue
    }
    if (nodeIds.has(node.id)) duplicateNodeIds.add(node.id)
    nodeIds.add(node.id)
    if (!(WORKFLOW_NODE_TYPES as readonly string[]).includes(String(node.type || ''))) {
      addIssue(issues, 'error', 'node-type-unsupported', `Node type "${node.type || 'unknown'}" is not supported.`, node.id)
    }
  }
  for (const id of duplicateNodeIds) {
    addIssue(issues, 'error', 'node-id-duplicate', `Node id "${id}" is used more than once.`, id)
  }

  const validEdges: WorkflowGraphEdge[] = []
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      addIssue(issues, 'error', 'edge-dangling', 'A connection points to a node that no longer exists.')
      continue
    }
    if (edge.source === edge.target) {
      addIssue(issues, 'error', 'edge-self-reference', 'A node cannot connect to itself.', edge.source)
      continue
    }
    const sourceNode = nodes.find(node => node.id === edge.source)
    if ((edge.sourceHandle === 'true' || edge.sourceHandle === 'false') && sourceNode?.type !== 'condition' && sourceNode?.type !== 'filter') {
      addIssue(issues, 'error', 'edge-handle-invalid', 'True/false outputs can only start at a condition node.', edge.source)
      continue
    }
    if ((edge.sourceHandle === 'default' || edge.sourceHandle?.startsWith('branch-')) && sourceNode?.type !== 'logic-switch') {
      addIssue(issues, 'error', 'edge-handle-invalid', 'Case/default outputs can only start at a Switch / Cases node.', edge.source)
      continue
    }
    if ((edge.sourceHandle === 'loop' || edge.sourceHandle === 'done') && sourceNode?.type !== 'logic-loop') {
      addIssue(issues, 'error', 'edge-handle-invalid', 'Loop/done outputs can only start at a Loop node.', edge.source)
      continue
    }
    if ((edge.sourceHandle === 'approved' || edge.sourceHandle === 'rejected') && sourceNode?.type !== 'logic-approval') {
      addIssue(issues, 'error', 'edge-handle-invalid', 'Approved/rejected outputs can only start at a Human Review node.', edge.source)
      continue
    }
    if (sourceNode?.type === 'logic-switch' && edge.sourceHandle?.startsWith('branch-')) {
      const match = /^branch-(\d+)$/.exec(edge.sourceHandle)
      const branches = Array.isArray(sourceNode.data?.branches) ? sourceNode.data.branches : []
      const branchIndex = match ? Number.parseInt(match[1], 10) : -1
      if (branchIndex < 0 || branchIndex >= branches.length || !hasValue(branches[branchIndex])) {
        addIssue(issues, 'error', 'switch-handle-invalid', 'A Switch connection points to a case that is not configured.', edge.source)
        continue
      }
    }
    validEdges.push(edge)
  }

  const triggerNodes = nodes.filter(node => String(node.type || '').startsWith('trigger-'))
  if (triggerNodes.length === 0) {
    addIssue(issues, 'error', 'trigger-missing', 'Add at least one trigger to define how this workflow starts.')
  }

  for (const node of triggerNodes) {
    if (!SUPPORTED_TRIGGER_NODES.has(String(node.type))) continue
    if (validEdges.some(edge => edge.target === node.id)) {
      addIssue(issues, 'error', 'trigger-has-input', 'A trigger must be a starting node and cannot have an incoming connection.', node.id)
    }

    const cfg = configForNode(node.id)

    if (node.type === 'trigger-event') {
      const event = String(node.data?.event || '')
      if (!event) {
        addIssue(issues, 'error', 'event-missing', 'Choose an event for the event trigger.', node.id)
      } else if (!(WORKFLOW_EVENT_TYPES as readonly string[]).includes(event)) {
        addIssue(issues, 'error', 'event-invalid', `Event "${event}" is not supported.`, node.id)
      }
      if (cfg && (cfg.type !== 'event' || cfg.event !== event)) {
        addIssue(issues, 'error', 'trigger-out-of-sync', 'The saved event trigger does not match the trigger node.', node.id)
      }
    }

    if (node.type === 'trigger-schedule') {
      const cron = String(node.data?.cron || '')
      if (!cron) {
        addIssue(issues, 'error', 'schedule-missing', 'Choose an interval for the schedule trigger.', node.id)
      } else if (!(WORKFLOW_SCHEDULES as readonly string[]).includes(cron)) {
        addIssue(issues, 'error', 'schedule-invalid', `Schedule "${cron}" is not supported.`, node.id)
      }
      if (cfg && (cfg.type !== 'schedule' || cfg.cron !== cron)) {
        addIssue(issues, 'error', 'trigger-out-of-sync', 'The saved schedule does not match the trigger node.', node.id)
      }
    }

    if (node.type === 'trigger-manual' && cfg && cfg.type !== 'manual') {
      addIssue(issues, 'error', 'trigger-out-of-sync', 'The saved trigger does not match the Manual / API node.', node.id)
    }

    if (node.type === 'trigger-webhook') {
      const method = String(node.data?.method || 'POST')
      if (!['GET', 'POST', 'PUT'].includes(method)) {
        addIssue(issues, 'error', 'webhook-method-invalid', `Method "${method}" is not supported for webhook triggers.`, node.id)
      }
      if (cfg && cfg.type !== 'webhook') {
        addIssue(issues, 'error', 'trigger-out-of-sync', 'The saved trigger does not match the webhook node.', node.id)
      }
    }
  }

  const actionNodes = nodes.filter(node => String(node.type || '').startsWith('action-'))
  if (actionNodes.length === 0) {
    addIssue(issues, 'error', 'action-missing', 'Add and connect at least one action.')
  }

  if (triggerNodes.length >= 1) {
    // A node is connected if it is reachable from ANY trigger.
    const reachable = new Set<string>(triggerNodes.map(t => t.id))
    const queue = triggerNodes.map(t => t.id)
    while (queue.length > 0) {
      const source = queue.shift()!
      for (const edge of validEdges) {
        if (edge.source === source && !reachable.has(edge.target)) {
          reachable.add(edge.target)
          queue.push(edge.target)
        }
      }
    }

    for (const node of nodes) {
      const isTrigger = triggerNodes.some(t => t.id === node.id)
      if (!isTrigger && !reachable.has(node.id)) {
        addIssue(issues, 'error', 'node-disconnected', `The ${node.type || 'unknown'} node is not connected to a trigger.`, node.id)
      }
    }
  }

  const inDegree = new Map(nodes.map(node => [node.id, 0]))
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]))
  for (const edge of validEdges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    outgoing.get(edge.source)?.push(edge.target)
  }
  const cycleQueue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id)
  let visited = 0
  while (cycleQueue.length > 0) {
    const id = cycleQueue.shift()!
    visited += 1
    for (const target of outgoing.get(id) || []) {
      const nextDegree = (inDegree.get(target) || 0) - 1
      inDegree.set(target, nextDegree)
      if (nextDegree === 0) cycleQueue.push(target)
    }
  }
  if (nodes.length > 0 && visited !== nodes.length) {
    addIssue(issues, 'error', 'graph-cycle', 'The workflow contains a cycle. Remove the circular connection.')
  }

  for (const node of nodes) validateNodeConfiguration(node, validEdges, issues)

  validateLoopBodies(nodes, validEdges, issues)

  if (triggerNodes.length >= 1) {
    validateMutationTargetCompatibility(triggerNodes, nodes, validEdges, issues)
  }

  const errors = issues.filter(issue => issue.severity === 'error')
  const warnings = issues.filter(issue => issue.severity === 'warning')
  return { valid: errors.length === 0, errors, warnings, issues }
}

const MUTATION_TARGET_EVENTS: Record<string, readonly string[]> = {
  hardware: [
    'hardware.created', 'hardware.updated', 'status.changed',
    'assignment.created', 'assignment.returned', 'maintenance.completed'
  ],
  employee: ['employee.created', 'employee.updated', 'assignment.created', 'assignment.returned']
}

// Why a given trigger cannot safely feed a mutating action node, or null if it can.
function triggerMutationProblem(
  triggerNode: WorkflowGraphNode,
  mutationNode: WorkflowGraphNode
): { code: string; message: string } | null {
  if (triggerNode.type === 'trigger-manual') return null

  if (triggerNode.type === 'trigger-schedule') {
    return {
      code: 'mutation-target-unavailable',
      message: 'Scheduled workflows cannot mutate records because a schedule does not identify a target. Use a notification, audit, or webhook action.'
    }
  }

  if (triggerNode.type === 'trigger-webhook') {
    return {
      code: 'mutation-target-unavailable',
      message: 'Webhook-triggered workflows cannot mutate records automatically because the caller is unauthenticated and the payload is not a vetted target identifier. Use a notification, audit, or outbound webhook action.'
    }
  }

  if (triggerNode.type !== 'trigger-event') return null
  const event = String(triggerNode.data?.event || '')
  const entity = mutationNode.type === 'action-update-field' ? String(mutationNode.data?.entity || '') : 'hardware'
  if (!MUTATION_TARGET_EVENTS[entity]?.includes(event)) {
    return {
      code: 'mutation-target-unavailable',
      message: `Event "${event}" does not provide an available ${entity} target for this action.`
    }
  }
  if (
    mutationNode.type === 'action-assign' &&
    ['manager', 'triggeredUser'].includes(String(mutationNode.data?.assignTo || ''))
  ) {
    return {
      code: 'assignment-employee-context-unavailable',
      message: 'Triggered employee and manager assignment modes require a Manual / API run with both employee and hardware identifiers.'
    }
  }
  return null
}

// A mutating action is safe only if EVERY trigger that can reach it supplies a
// valid target. With multiple triggers, a node reachable from both a Manual
// trigger (ok) and a Webhook trigger (not ok) is flagged for the webhook path.
function validateMutationTargetCompatibility(
  triggerNodes: WorkflowGraphNode[],
  nodes: WorkflowGraphNode[],
  edges: WorkflowGraphEdge[],
  issues: WorkflowValidationIssue[]
) {
  const mutationNodes = nodes.filter(node => [
    'action-status', 'action-assign', 'action-update-field', 'action-tag', 'action-maintenance'
  ].includes(String(node.type)))
  if (mutationNodes.length === 0) return

  const reachableFrom = (startId: string): Set<string> => {
    const reachable = new Set<string>([startId])
    const queue = [startId]
    while (queue.length > 0) {
      const source = queue.shift()!
      for (const edge of edges) {
        if (edge.source === source && !reachable.has(edge.target)) {
          reachable.add(edge.target)
          queue.push(edge.target)
        }
      }
    }
    return reachable
  }
  const reachByTrigger = new Map(triggerNodes.map(t => [t.id, reachableFrom(t.id)]))

  // A source node (Get Records) upstream of a mutating action supplies the
  // per-item target from the stream, so the trigger no longer needs to. Any
  // trigger type is then valid for that action.
  const sourceNodeIds = new Set(
    nodes.filter(node => node.type === 'action-get-records').map(node => node.id)
  )
  const hasSourceAncestor = (nodeId: string): boolean => {
    const seen = new Set<string>([nodeId])
    const queue = [nodeId]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const edge of edges) {
        if (edge.target !== current || seen.has(edge.source)) continue
        if (sourceNodeIds.has(edge.source)) return true
        seen.add(edge.source)
        queue.push(edge.source)
      }
    }
    return false
  }

  for (const mNode of mutationNodes) {
    if (hasSourceAncestor(mNode.id)) continue
    for (const trigger of triggerNodes) {
      if (!reachByTrigger.get(trigger.id)!.has(mNode.id)) continue
      const problem = triggerMutationProblem(trigger, mNode)
      if (problem) addIssue(issues, 'error', problem.code, problem.message, mNode.id)
    }
  }
}

// A Loop body is a self-contained sub-graph entered only via the "loop" handle.
// Enforce: no nested loops (v1), the body doesn't overlap the "done"
// continuation, and body nodes aren't fed from outside the body.
function validateLoopBodies(
  nodes: WorkflowGraphNode[],
  edges: WorkflowGraphEdge[],
  issues: WorkflowValidationIssue[]
) {
  const loopNodes = nodes.filter(node => node.type === 'logic-loop')
  for (const loop of loopNodes) {
    const body = computeLoopBodyNodeIds(loop.id, edges)
    if (body.size === 0) continue

    if (nodes.some(node => body.has(node.id) && node.type === 'logic-loop')) {
      addIssue(issues, 'error', 'loop-nested-unsupported', 'Nested loops are not supported yet — a loop body cannot contain another loop.', loop.id)
    }
    if (nodes.some(node => body.has(node.id) && node.type === 'logic-approval')) {
      addIssue(issues, 'error', 'loop-approval-unsupported', 'A Human Review node cannot be placed inside a loop body.', loop.id)
    }

    const doneTargets = new Set(
      edges.filter(edge => edge.source === loop.id && edge.sourceHandle === 'done').map(edge => edge.target)
    )
    for (const id of body) {
      if (doneTargets.has(id)) {
        addIssue(issues, 'error', 'loop-body-overlaps-done', 'A node is connected to both the loop body and its "done" output.', loop.id)
      }
      // Body nodes may only be fed from within the body or the loop's "loop" handle.
      const fedFromOutside = edges.some(edge =>
        edge.target === id &&
        edge.source !== loop.id &&
        !body.has(edge.source)
      )
      if (fedFromOutside) {
        addIssue(issues, 'error', 'loop-body-not-isolated', 'A loop body node has an incoming connection from outside the loop.', id)
      }
    }
  }
}

function validateNodeConfiguration(
  node: WorkflowGraphNode,
  edges: WorkflowGraphEdge[],
  issues: WorkflowValidationIssue[]
) {
  const data = node.data || {}

  if (node.type === 'condition' || node.type === 'filter') {
    // Item-field mode: test a field of each incoming stream item (e.g. "status")
    // instead of a predefined aggregate fact. Any field path is allowed.
    if (hasValue(data.itemField)) {
      if (!hasValue(data.operator) || !hasValue(data.value)) {
        addIssue(issues, 'error', 'condition-incomplete', 'Complete the field, comparison, and value for this condition.', node.id)
      }
    } else {
      if (!hasValue(data.entity) || !hasValue(data.field) || !hasValue(data.operator) || !hasValue(data.value)) {
        addIssue(issues, 'error', 'condition-incomplete', 'Complete the entity, field, comparison, and value for this condition.', node.id)
      }
      if (hasValue(data.entity) && !WORKFLOW_CONDITION_FIELDS[String(data.entity)]) {
        addIssue(issues, 'error', 'condition-entity-invalid', `Entity "${data.entity}" is not supported in conditions.`, node.id)
      } else if (
        hasValue(data.entity) &&
        hasValue(data.field) &&
        !WORKFLOW_CONDITION_FIELDS[String(data.entity)]?.includes(String(data.field))
      ) {
        addIssue(issues, 'error', 'condition-field-invalid', `Field "${data.field}" is not supported for ${data.entity} conditions.`, node.id)
      }
    }
    if (hasValue(data.operator) && !(WORKFLOW_CONDITION_OPERATORS as readonly string[]).includes(String(data.operator))) {
      addIssue(issues, 'error', 'condition-operator-invalid', `Comparison "${data.operator}" is not supported.`, node.id)
    }
  }

  if (node.type === 'logic-switch') {
    if (!hasValue(data.field)) {
      addIssue(issues, 'error', 'switch-field-missing', 'Choose the field that Switch / Cases should compare.', node.id)
    } else if (!(WORKFLOW_SWITCH_FIELDS as readonly string[]).includes(String(data.field))) {
      addIssue(issues, 'error', 'switch-field-invalid', `Switch field "${data.field}" is not supported.`, node.id)
    }

    const branches = Array.isArray(data.branches)
      ? data.branches.map((value: unknown) => String(value || '').trim())
      : []
    const configuredBranches = branches
      .map((value: string, index: number) => ({ value, index }))
      .filter((branch: { value: string }) => branch.value.length > 0)

    if (configuredBranches.length === 0) {
      addIssue(issues, 'error', 'switch-cases-missing', 'Add at least one case value to Switch / Cases.', node.id)
    }

    const normalized = configuredBranches.map((branch: { value: string }) => branch.value.toLowerCase())
    if (new Set(normalized).size !== normalized.length) {
      addIssue(issues, 'error', 'switch-cases-duplicate', 'Switch / Cases values must be unique (case-insensitive).', node.id)
    }

    for (const branch of configuredBranches) {
      if (!edges.some(edge => edge.source === node.id && edge.sourceHandle === `branch-${branch.index}`)) {
        addIssue(issues, 'warning', 'switch-case-unconnected', `Case "${branch.value}" has no connected action.`, node.id)
      }
    }
    if (!edges.some(edge => edge.source === node.id && edge.sourceHandle === 'default')) {
      addIssue(issues, 'warning', 'switch-default-unconnected', 'The Default output is not connected; unmatched values will stop here.', node.id)
    }
  }

  if (node.type === 'logic-delay' && (
    data.unit !== 'seconds' ||
    !Number.isInteger(Number(data.duration)) ||
    Number(data.duration) < 1 ||
    Number(data.duration) > 30
  )) {
    addIssue(issues, 'error', 'delay-invalid', 'Delay must be a whole number from 1 to 30 seconds.', node.id)
  }

  if (node.type === 'logic-merge') {
    if (!['any', 'all'].includes(String(data.mode || 'any'))) {
      addIssue(issues, 'error', 'merge-mode-invalid', 'Merge mode must be "any" or "all".', node.id)
    }
    const incomingCount = edges.filter(edge => edge.target === node.id).length
    if (incomingCount < 2) {
      addIssue(issues, 'warning', 'merge-single-input', 'Merge has fewer than two incoming connections — it has nothing to converge.', node.id)
    }
  }

  if (node.type === 'logic-stop-error' && !hasValue(data.message)) {
    addIssue(issues, 'error', 'stop-error-message-missing', 'Enter the error message this node should stop the run with.', node.id)
  }

  if (node.type === 'logic-approval') {
    if (!(WORKFLOW_NOTIFICATION_CHANNELS as readonly string[]).includes(String(data.channel || ''))) {
      addIssue(issues, 'error', 'approval-channel-invalid', 'Choose Email, Slack, or Microsoft Teams for the approval request.', node.id)
    }
    if (!hasValue(data.approverEmail)) {
      addIssue(issues, 'error', 'approval-approver-missing', 'Enter the approver email for the review request.', node.id)
    }
    if (!hasValue(data.title) || !hasValue(data.message)) {
      addIssue(issues, 'error', 'approval-content-missing', 'Enter a title and message for the review request.', node.id)
    }
  }

  if (node.type === 'logic-loop') {
    const mode = String(data.mode || 'forEach')
    if (!['forEach', 'forEachItem', 'times', 'while'].includes(mode)) {
      addIssue(issues, 'error', 'loop-mode-invalid', 'Loop mode must be "for each input item", "for each record", "times", or "while".', node.id)
    }
    const maxIterations = Number(data.maxIterations)
    if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) {
      addIssue(issues, 'error', 'loop-max-invalid', 'Loop max iterations must be a whole number from 1 to 1000.', node.id)
    }
    if (mode === 'forEach') {
      if (!hasValue(data.entity)) {
        addIssue(issues, 'error', 'loop-entity-missing', 'Choose which records the loop iterates over.', node.id)
      } else if (!LOOP_ENTITIES.includes(String(data.entity))) {
        addIssue(issues, 'error', 'loop-entity-invalid', `Loop entity "${data.entity}" is not supported.`, node.id)
      }
    }
    if (mode === 'times') {
      const count = Number(data.count)
      if (!Number.isInteger(count) || count < 1) {
        addIssue(issues, 'error', 'loop-count-invalid', 'Repeat count must be a whole number of at least 1.', node.id)
      }
    }
    if (mode === 'while' && (!hasValue(data.entity) || !hasValue(data.field) || !hasValue(data.operator) || !hasValue(data.value))) {
      addIssue(issues, 'error', 'loop-condition-incomplete', 'Complete the entity, field, comparison, and value for the while condition.', node.id)
    }
    if (!edges.some(edge => edge.source === node.id && edge.sourceHandle === 'loop')) {
      addIssue(issues, 'error', 'loop-body-missing', 'Connect the loop body to the "loop" output.', node.id)
    }
  }

  if (node.type === 'action-status') {
    if (!hasValue(data.statusSlug)) {
      addIssue(issues, 'error', 'status-missing', 'Choose the status this action should apply.', node.id)
    } else if (!(WORKFLOW_STATUS_SLUGS as readonly string[]).includes(String(data.statusSlug))) {
      addIssue(issues, 'error', 'status-invalid', `Status "${data.statusSlug}" is not available for workflow actions.`, node.id)
    }
  }

  if (node.type === 'action-assign') {
    const targets = ['specific', 'itAdmin', 'manager', 'triggeredUser']
    if (!hasValue(data.assignTo)) {
      addIssue(issues, 'error', 'assignment-target-missing', 'Choose who should receive the hardware.', node.id)
    } else if (!targets.includes(String(data.assignTo))) {
      addIssue(issues, 'error', 'assignment-target-invalid', `Assignment target "${data.assignTo}" is not supported.`, node.id)
    } else if (data.assignTo === 'specific' && !hasValue(data.employeeEmail)) {
      addIssue(issues, 'error', 'assignment-email-missing', 'Enter an employee email for the specific assignment target.', node.id)
    }
  }

  if (node.type === 'action-notify') {
    if (!(WORKFLOW_NOTIFICATION_CHANNELS as readonly string[]).includes(String(data.channel || ''))) {
      addIssue(issues, 'error', 'notification-channel-invalid', 'Choose Email, Slack, or Microsoft Teams for this notification.', node.id)
    }
    if (!hasValue(data.title) || !hasValue(data.message)) {
      addIssue(issues, 'error', 'notification-content-missing', 'Enter a subject and message for this notification.', node.id)
    }
  }

  if (node.type === 'action-update-field') {
    if (!hasValue(data.entity) || !hasValue(data.field)) {
      addIssue(issues, 'error', 'update-field-incomplete', 'Choose an entity and field for this update action.', node.id)
    }
    if (!hasValue(data.value)) {
      addIssue(issues, 'error', 'update-value-missing', 'Enter the new value for this update action.', node.id)
    }
    if (hasValue(data.entity) && hasValue(data.field) && !WORKFLOW_UPDATE_FIELDS[String(data.entity)]?.includes(String(data.field))) {
      addIssue(issues, 'error', 'update-field-unsupported', `Field "${data.field}" cannot be updated automatically for ${data.entity}.`, node.id)
    }
  }

  if (node.type === 'action-webhook') {
    if (!hasValue(data.url)) {
      addIssue(issues, 'error', 'webhook-url-missing', 'Enter the URL for this HTTP request.', node.id)
    } else if (!isValidWebhookUrlSyntax(String(data.url))) {
      addIssue(issues, 'error', 'webhook-url-invalid', 'HTTP requests require a public HTTPS URL with a fully qualified host.', node.id)
    }
    if (hasValue(data.method) && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(data.method).toUpperCase())) {
      addIssue(issues, 'error', 'webhook-method-invalid', `HTTP method "${data.method}" is not supported.`, node.id)
    }
  }

  if (node.type === 'action-sync' && hasValue(data.provider) && !SYNC_PROVIDERS.includes(String(data.provider))) {
    addIssue(issues, 'error', 'sync-provider-invalid', `Sync provider "${data.provider}" is not supported.`, node.id)
  }

  if (node.type === 'action-get-records') {
    if (!GET_RECORDS_ENTITIES.includes(String(data.entity))) {
      addIssue(issues, 'error', 'get-records-entity-invalid', `Get Records entity "${data.entity}" is not supported.`, node.id)
    }
    if (hasValue(data.limit)) {
      const limit = Number(data.limit)
      if (!Number.isInteger(limit) || limit < 1 || limit > GET_RECORDS_MAX_LIMIT) {
        addIssue(issues, 'error', 'get-records-limit-invalid', `Get Records limit must be a whole number from 1 to ${GET_RECORDS_MAX_LIMIT}.`, node.id)
      }
    }
  }

  if (node.type === 'action-respond') {
    const status = Number(data.status)
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      addIssue(issues, 'error', 'respond-status-invalid', 'Response status must be a whole number from 100 to 599.', node.id)
    }
  }

  if (node.type === 'action-helpdesk') {
    if (!hasValue(data.subject) || !hasValue(data.description)) {
      addIssue(issues, 'error', 'helpdesk-content-missing', 'Enter a subject and description for the helpdesk ticket.', node.id)
    }
    if (!hasValue(data.requesterEmail)) {
      addIssue(issues, 'error', 'helpdesk-requester-missing', 'Enter a requester email for the helpdesk ticket.', node.id)
    }
    if (!['low', 'medium', 'high', 'critical'].includes(String(data.priority || 'medium'))) {
      addIssue(issues, 'error', 'helpdesk-priority-invalid', 'Choose a supported ticket priority.', node.id)
    }
  }

  if (node.type === 'action-audit-log') {
    if (!['info', 'warning', 'error', 'critical'].includes(String(data.severity || ''))) {
      addIssue(issues, 'error', 'audit-severity-invalid', 'Choose a supported audit severity.', node.id)
    }
    if (!['compliance', 'security', 'operations', 'finance', 'custom'].includes(String(data.category || ''))) {
      addIssue(issues, 'error', 'audit-category-invalid', 'Choose a supported audit category.', node.id)
    }
    if (!hasValue(data.message)) {
      addIssue(issues, 'error', 'audit-message-missing', 'Enter the audit log message.', node.id)
    }
  }

  if (node.type === 'action-tag') {
    if (!hasValue(data.tag)) {
      addIssue(issues, 'error', 'tag-missing', 'Enter the tag this action should add or remove.', node.id)
    }
    if (!['add', 'remove'].includes(String(data.operation || 'add'))) {
      addIssue(issues, 'error', 'tag-operation-invalid', 'Choose Add or Remove for the tag action.', node.id)
    }
  }

  if (node.type === 'action-maintenance') {
    if (!(WORKFLOW_MAINTENANCE_TYPES as readonly string[]).includes(String(data.maintenanceType || ''))) {
      addIssue(issues, 'error', 'maintenance-type-invalid', 'Choose a supported maintenance type.', node.id)
    }
    if (!hasValue(data.description)) {
      addIssue(issues, 'error', 'maintenance-description-missing', 'Enter a maintenance description.', node.id)
    }
  }
}

export function isValidWebhookUrlSyntax(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
    if (!hostname || hostname === 'localhost') return false


    return hostname.includes('.') || hostname.includes(':')
  } catch {
    return false
  }
}
