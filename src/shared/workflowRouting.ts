import type { WorkflowGraphEdge } from './workflowValidation'

export interface SwitchResult {
  matchedBranch: number
  value: unknown
}

const WORKFLOW_FIELD_ALIASES: Record<string, string[]> = {
  status: ['status', 'statusSlug', 'newStatus', 'newStatusSlug', 'statusId', 'newStatusId'],
  category: ['category', 'categorySlug', 'categoryId'],
  location: ['location', 'locationSlug', 'locationId'],
  department: ['department', 'departmentSlug', 'departmentId'],
  manufacturer: ['manufacturer', 'manufacturerName', 'manufacturerId'],
  assignee: ['assignee', 'assigneeEmail', 'assignedTo', 'employeeId'],
  provider: ['provider']
}

export type WorkflowTargetEntity = 'hardware' | 'employee' | 'license' | 'consumable'

const WORKFLOW_TARGET_ALIASES: Record<WorkflowTargetEntity, { single: string[]; multiple: string[] }> = {
  hardware: {
    single: ['hardwareId', 'assetId'],
    multiple: ['hardwareIds', 'assetIds']
  },
  employee: {
    single: ['employeeId'],
    multiple: ['employeeIds']
  },
  license: {
    single: ['licenseId'],
    multiple: ['licenseIds']
  },
  consumable: {
    single: ['consumableId'],
    multiple: ['consumableIds']
  }
}

export function extractWorkflowTargetIds(
  triggerData: Record<string, unknown>,
  entity: WorkflowTargetEntity
): string[] {
  const aliases = WORKFLOW_TARGET_ALIASES[entity]
  const ids: string[] = []

  for (const key of aliases.multiple) {
    const value = triggerData[key]
    if (Array.isArray(value)) ids.push(...value.map(String))
  }
  for (const key of aliases.single) {
    const value = triggerData[key]
    if (value !== undefined && value !== null && String(value).trim()) ids.push(String(value))
  }

  return [...new Set(ids.map(id => id.trim()).filter(Boolean))]
}

export function resolveWorkflowFieldValue(
  triggerData: Record<string, unknown>,
  field: string
): unknown {
  const candidates = WORKFLOW_FIELD_ALIASES[field] || [field]
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(triggerData, candidate)) {
      return triggerData[candidate]
    }
  }
  return ''
}

export function matchSwitchCase(actualValue: unknown, branches: unknown[]): number {
  const normalizedActual = String(actualValue ?? '').trim().toLowerCase()
  return branches.findIndex(branch => {
    const normalizedBranch = String(branch ?? '').trim().toLowerCase()
    return normalizedBranch.length > 0 && normalizedBranch === normalizedActual
  })
}

// Whether a single incoming edge carries an "active" path: its source ran
// (not skipped) and, for condition/switch outputs, the branch actually matched.
export function isWorkflowEdgePathActive(
  edge: WorkflowGraphEdge,
  conditionResults: Map<string, boolean>,
  nodeOutputs: Map<string, any>,
  skippedNodes: Set<string>
): boolean {
  if (skippedNodes.has(edge.source)) return false

  if (edge.sourceHandle === 'true' || edge.sourceHandle === 'false') {
    const result = conditionResults.get(edge.source)
    return result !== undefined && result === (edge.sourceHandle === 'true')
  }

  // Human Review outputs mirror condition true/false (approved = true).
  if (edge.sourceHandle === 'approved' || edge.sourceHandle === 'rejected') {
    const result = conditionResults.get(edge.source)
    return result !== undefined && result === (edge.sourceHandle === 'approved')
  }

  if (edge.sourceHandle?.startsWith('branch-')) {
    const branchIndex = Number.parseInt(edge.sourceHandle.slice('branch-'.length), 10)
    const output = nodeOutputs.get(edge.source) as SwitchResult | undefined
    return Boolean(output && output.matchedBranch === branchIndex)
  }

  if (edge.sourceHandle === 'default') {
    const output = nodeOutputs.get(edge.source) as SwitchResult | undefined
    return Boolean(output && output.matchedBranch === -1)
  }

  return true
}

// The nodes belonging to a Loop node's body: everything forward-reachable from
// its "loop" output handle. The body is a self-contained sub-graph run
// repeatedly per iteration; its nodes never appear in the outer execution pass.
// (v1 forbids nested loops, so a body is always a flat acyclic sub-graph.)
export function computeLoopBodyNodeIds(
  loopNodeId: string,
  edges: WorkflowGraphEdge[]
): Set<string> {
  const body = new Set<string>()
  const queue = edges
    .filter(edge => edge.source === loopNodeId && edge.sourceHandle === 'loop')
    .map(edge => edge.target)

  while (queue.length > 0) {
    const id = queue.shift()!
    if (id === loopNodeId || body.has(id)) continue
    body.add(id)
    for (const edge of edges) {
      if (edge.source === id && edge.target !== loopNodeId && !body.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }
  return body
}

// Union of every loop's body — the set of nodes the top-level pass must skip
// (they run only inside their owning loop).
export function computeAllLoopBodyNodeIds(
  nodes: Array<{ id: string; type?: string }>,
  edges: WorkflowGraphEdge[]
): Set<string> {
  const owned = new Set<string>()
  for (const node of nodes) {
    if (node.type === 'logic-loop') {
      for (const id of computeLoopBodyNodeIds(node.id, edges)) owned.add(id)
    }
  }
  return owned
}

export function shouldSkipWorkflowNode(
  nodeId: string,
  edges: WorkflowGraphEdge[],
  conditionResults: Map<string, boolean>,
  nodeOutputs: Map<string, any>,
  skippedNodes: Set<string>
): boolean {
  const incomingEdges = edges.filter(edge => edge.target === nodeId)
  if (incomingEdges.length === 0) return false

  return !incomingEdges.some(edge =>
    isWorkflowEdgePathActive(edge, conditionResults, nodeOutputs, skippedNodes)
  )
}
