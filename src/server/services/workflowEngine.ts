
import toposort from 'toposort'
import { Engine as RulesEngine } from 'json-rules-engine'
import mongoose from 'mongoose'
import { Workflow } from '../../models/Workflow'
import { WorkflowRun } from '../../models/WorkflowRun'
import { Hardware } from '../../models/Hardware'
import { Employee } from '../../models/Employee'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Consumable } from '../../models/Consumable'
import { MaintenanceRecord } from '../../models/MaintenanceRecord'
import { AuditLog } from '../../models/AuditLog'
import { Assignment } from '../../models/Assignment'
import { User } from '../../models/User'
import { Status } from '../../models/Status'
import { resolveStatusId } from './statusResolver'
import { dispatchNotification } from './notificationDispatcher'
import type { NotificationChannel, NotificationEventType } from './notificationDispatcher'
import { normalizeLegacyWorkflowGraph, validateWorkflowGraph, WORKFLOW_UPDATE_FIELDS } from '../../shared/workflowValidation'
import { computeAllLoopBodyNodeIds, computeLoopBodyNodeIds, extractWorkflowTargetIds, matchSwitchCase, resolveWorkflowFieldValue, type WorkflowTargetEntity } from '../../shared/workflowRouting'
import { requireTenantWorkflowTargets } from './workflowTargets'
import { DEFAULT_OUTPUT_HANDLE, STORED_ITEMS_CAP, type WorkflowItem, type NodeOutputItems } from '../../shared/workflowItems'
import { resolveExpression } from '../../shared/workflowExpressions'
import { GET_RECORDS_MAX_LIMIT } from '../../shared/workflowNodeCatalog'
import { postSecureWebhook } from './workflowWebhookSecurity'
import crypto from 'crypto'
import { Organization } from '../../models/Organization'
import { WorkflowApproval } from '../../models/WorkflowApproval'
import { createHelpdeskTicket, isHelpdeskConfigured } from './helpdeskClient'
import { sendWorkflowApprovalEmail } from './emailService'

export { isExternalUrl } from './workflowWebhookSecurity'


interface WorkflowNode {
  id: string
  type: string
  data: Record<string, any>
  position: { x: number; y: number }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}

interface ExecutionContext {
  orgId: string
  triggeredBy: 'event' | 'schedule' | 'manual' | 'webhook' | 'test'
  triggerData: Record<string, any>
  nodeOutputs: Map<string, any>
  // The item stream: each node's output items keyed by output handle. This is
  // the real node→node data flow; `input` below is what the current node
  // received (gathered from its active incoming edges).
  nodeItems: Map<string, NodeOutputItems>
  input: WorkflowItem[]
  // The single item currently being processed (per-item execution). When unset,
  // expressions resolve `$json` against the first input item / trigger payload.
  currentItem?: Record<string, any>
  // Node name (data.label, else id) → node id, for {{ $('Node').item.json }}.
  nodeLabelToId?: Map<string, string>
  conditionResults: Map<string, boolean>
  skippedNodes: Set<string>
  graphEdges: WorkflowEdge[]
  workflowId?: string
  runId?: string
  // Set to a node id when execution pauses on a Human Review node.
  pausedAt?: string
  // Set by an action-respond node for synchronous webhook-trigger runs.
  webhookResponse?: { status: number; contentType: string; body: string }
}

interface NodeResult {
  nodeId: string
  nodeType: string
  status: 'skipped' | 'success' | 'failed' | 'waiting'
  output?: any
  // Capped slice of the node's output items + the true total (run docs stay
  // bounded; the full set flows in-memory via ctx.nodeItems).
  items?: WorkflowItem[]
  itemCount?: number
  error?: string
  duration?: number
}

// Whether an edge carries any items — the source produced ≥1 item on the edge's
// handle. This IS the routing signal: an untaken branch's handle is empty, so
// its downstream edges deliver nothing. (Replaces the old conditionResults-based
// isWorkflowEdgePathActive for engine routing; that predicate stays for its own
// unit tests but the stream model routes purely by item presence.)
function edgeDelivers(edge: WorkflowEdge, ctx: ExecutionContext): boolean {
  const items = ctx.nodeItems.get(edge.source)?.[edge.sourceHandle || DEFAULT_OUTPUT_HANDLE]
  return (items?.length ?? 0) > 0
}

// Gather the items a node receives: concat the output items of every incoming
// edge whose source handle delivered items. A node whose inputs are all empty
// gets nothing (and is skipped by shouldSkipNode).
function gatherInputItems(nodeId: string, edges: WorkflowEdge[], ctx: ExecutionContext): WorkflowItem[] {
  const items: WorkflowItem[] = []
  for (const edge of edges) {
    if (edge.target !== nodeId) continue
    const upstream = ctx.nodeItems.get(edge.source)?.[edge.sourceHandle || DEFAULT_OUTPUT_HANDLE]
    if (upstream?.length) items.push(...upstream)
  }
  return items
}

// Record a node's output items on the default handle (single-output nodes).
function setNodeItems(ctx: ExecutionContext, nodeId: string, items: WorkflowItem[]): void {
  ctx.nodeItems.set(nodeId, { [DEFAULT_OUTPUT_HANDLE]: items })
}

// The items a node processes: its gathered input, or the trigger payload as a
// single item when it has no stream input (keeps legacy trigger→action flows
// working — the trigger item's json IS triggerData).
function inputItemsOf(ctx: ExecutionContext): WorkflowItem[] {
  return ctx.input.length ? ctx.input : [{ json: ctx.triggerData }]
}

const ENTITY_SINGLE_ALIAS: Record<WorkflowTargetEntity, string> = {
  hardware: 'hardwareId', employee: 'employeeId', license: 'licenseId', consumable: 'consumableId'
}
const ENTITY_MULTI_ALIAS: Record<WorkflowTargetEntity, string> = {
  hardware: 'hardwareIds', employee: 'employeeIds', license: 'licenseIds', consumable: 'consumableIds'
}

// The target ids a single item contributes: an explicit alias (hardwareId, …),
// else the item's own _id/id (source-node records), else the trigger payload
// (legacy). Pure — no DB; validation still happens in requireTenantWorkflowTargets.
function extractItemTargetIds(entity: WorkflowTargetEntity, ctx: ExecutionContext, item: WorkflowItem): string[] {
  const json = item?.json ?? {}
  const explicit = extractWorkflowTargetIds(json, entity)
  if (explicit.length) return explicit
  const idLike = (json as any)._id ?? (json as any).id
  if (idLike != null && String(idLike).trim()) return [String(idLike)]
  return extractWorkflowTargetIds(ctx.triggerData, entity)
}

// Union of every input item's targets, validated once (org-scoped, ObjectId-
// checked) via requireTenantWorkflowTargets. Used by same-value bulk actions.
async function unionTargets(Model: any, entity: WorkflowTargetEntity, ctx: ExecutionContext): Promise<string[]> {
  const ids = new Set<string>()
  for (const item of inputItemsOf(ctx)) {
    for (const id of extractItemTargetIds(entity, ctx, item)) ids.add(id)
  }
  if (ids.size === 0) return []
  return requireTenantWorkflowTargets(Model, entity, ctx.orgId, { [ENTITY_MULTI_ALIAS[entity]]: [...ids] })
}

// Per-item target source (for actions that must run once per item, e.g. because
// their value is a per-item expression). Injects the item's _id/id as the
// entity's single-target alias when no explicit alias is present.
function itemTargetSource(entity: WorkflowTargetEntity, ctx: ExecutionContext, item: WorkflowItem): Record<string, unknown> {
  const json = item?.json ?? {}
  if (extractWorkflowTargetIds(json, entity).length) return json
  const idLike = (json as any)._id ?? (json as any).id
  if (idLike != null && String(idLike).trim()) return { ...json, [ENTITY_SINGLE_ALIAS[entity]]: idLike }
  return ctx.triggerData
}

// Map each node's display name (data.label if set, else its id) to its id so
// {{ $('Node Name') }} expressions can find its output. Later entries win, so an
// explicit label takes precedence over the id fallback.
function buildNodeLabelMap(nodes: WorkflowNode[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of nodes) map.set(node.id, node.id)
  for (const node of nodes) {
    const label = node.data?.label
    if (typeof label === 'string' && label.trim()) map.set(label, node.id)
  }
  return map
}


/**
 * @param options.fromTriggerNodeId  Run only the subgraph reachable from this
 *   trigger node (used when a specific trigger fires — sibling triggers'
 *   exclusive branches are excluded). Enables multiple triggers per workflow.
 * @param options.stopAfterNodeId    Run only up to and including this node
 *   (used by per-node testing).
 */
export interface WorkflowExecutionResult {
  runId: string
  status: 'completed' | 'failed' | 'waiting'
  nodeResults: NodeResult[]
  webhookResponse?: { status: number; contentType: string; body: string }
}

export async function executeWorkflow(
  workflowId: string,
  orgId: string,
  triggeredBy: 'event' | 'schedule' | 'manual' | 'webhook' | 'test',
  triggerData: Record<string, any> = {},
  options: { fromTriggerNodeId?: string; stopAfterNodeId?: string } = {}
): Promise<WorkflowExecutionResult> {
  const workflow = await Workflow.findOne({ _id: workflowId, orgId })
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`)

  const triggers = (workflow.triggers || []) as any[]
  const normalizedGraph = normalizeLegacyWorkflowGraph(
    (workflow.nodes || []) as unknown as WorkflowNode[],
    (workflow.edges || []) as unknown as WorkflowEdge[],
    (triggers[0] as any) ?? { type: 'manual' }
  )
  const nodes = normalizedGraph.nodes as WorkflowNode[]
  const edges = normalizedGraph.edges as WorkflowEdge[]

  // Resolve the execution subset BEFORE validating and before creating the
  // run record — an unknown stopAfterNodeId must not leave an orphan run, and
  // test-mode validation is scoped to the nodes that will actually execute.
  let sortedNodes = topologicalSort(nodes, edges)
  if (options.fromTriggerNodeId) {
    const reachable = reachableNodeIds(options.fromTriggerNodeId, edges)
    sortedNodes = sortedNodes.filter(node => reachable.has(node.id))
  }
  if (options.stopAfterNodeId) {
    const idx = sortedNodes.findIndex(node => node.id === options.stopAfterNodeId)
    if (idx === -1) throw new Error(`Node ${options.stopAfterNodeId} not found in workflow graph`)
    sortedNodes = sortedNodes.slice(0, idx + 1)
  }

  const validation = validateWorkflowGraph(nodes, edges, triggers as any)
  // Test runs validate only what they execute: per-node errors outside the
  // subset don't block ("execute step" must work on a half-built graph), and
  // a missing action is fine for a partial run. Structural errors (no
  // trigger, cycles, dangling edges) always block.
  const nodesToRunIds = new Set(sortedNodes.map(node => node.id))
  const blockingErrors = triggeredBy === 'test'
    ? validation.errors.filter(issue =>
        issue.code !== 'action-missing' && (!issue.nodeId || nodesToRunIds.has(issue.nodeId))
      )
    : validation.errors
  if (blockingErrors.length > 0) {
    throw new Error(`Validation Error: ${blockingErrors.map(issue => issue.message).join(' ')}`)
  }

  const run = await WorkflowRun.create({
    orgId,
    workflowId,
    workflowName: workflow.name,
    status: 'running',
    triggeredBy,
    triggerData,
    startedAt: new Date()
  })

  const ctx: ExecutionContext = {
    orgId,
    triggeredBy,
    triggerData,
    nodeOutputs: new Map(),
    nodeItems: new Map(),
    input: [],
    nodeLabelToId: buildNodeLabelMap(nodes),
    conditionResults: new Map(),
    skippedNodes: new Set(),
    graphEdges: edges,
    workflowId,
    runId: String(run._id)
  }

  const nodeResults: NodeResult[] = []
  let executionFailure: NodeResult | undefined

  try {
    // Loop bodies run nested inside their loop node, never in the top-level pass.
    const loopBodyIds = computeAllLoopBodyNodeIds(nodes, edges)
    const topLevel = sortedNodes.filter(node => !loopBodyIds.has(node.id))

    await runNodeList(topLevel, ctx, edges, nodes, result => nodeResults.push(result))

    // Paused on a Human Review node — the run waits for a decision. Downstream
    // did not run; don't finalize the workflow's run metadata.
    if (ctx.pausedAt) {
      await WorkflowRun.findByIdAndUpdate(run._id, { status: 'waiting', nodeResults })
      return { runId: String(run._id), status: 'waiting' as any, nodeResults }
    }

    executionFailure = nodeResults.find(result => result.status === 'failed')

    await WorkflowRun.findByIdAndUpdate(run._id, {
      status: executionFailure ? 'failed' : 'completed',
      nodeResults,
      completedAt: new Date()
    })

    // Test runs never touch the workflow's real execution metadata.
    if (triggeredBy !== 'test') {
      await Workflow.findByIdAndUpdate(workflowId, {
        lastRunAt: new Date(),
        $inc: { runCount: 1 },
        lastError: executionFailure?.error || null
      })
    }

  } catch (err: any) {
    await WorkflowRun.findByIdAndUpdate(run._id, {
      status: 'failed',
      nodeResults,
      completedAt: new Date(),
      error: err.message
    })
    if (triggeredBy !== 'test') {
      await Workflow.findByIdAndUpdate(workflowId, {
        lastRunAt: new Date(),
        $inc: { runCount: 1 },
        lastError: err.message
      })
    }
    throw err
  }

  // A failed node is an exceptional outcome for real runs, but a NORMAL result
  // for per-node testing — the panel wants to display the error, not catch it.
  if (executionFailure && triggeredBy !== 'test') {
    throw new Error(`Workflow failed at ${executionFailure.nodeType}: ${executionFailure.error || 'Action failed'}`)
  }

  return {
    runId: String(run._id),
    status: executionFailure ? 'failed' : 'completed',
    nodeResults,
    ...(ctx.webhookResponse ? { webhookResponse: ctx.webhookResponse } : {})
  }
}


// BFS over outgoing edges — the set of nodes reachable from a starting node
// (inclusive). Used to run only the subgraph a firing trigger can reach.
function reachableNodeIds(startId: string, edges: WorkflowEdge[]): Set<string> {
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

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (edges.length === 0) return nodes

  const edgePairs: [string, string][] = edges.map(e => [e.source, e.target])

  const connectedIds = new Set<string>()
  for (const e of edges) {
    connectedIds.add(e.source)
    connectedIds.add(e.target)
  }
  for (const node of nodes) {
    if (!connectedIds.has(node.id)) {
      edgePairs.push([node.id, node.id])
    }
  }

  try {
    const sortedIds = [...new Set(toposort(edgePairs))]
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    return sortedIds.map(id => nodeMap.get(id)).filter(Boolean) as WorkflowNode[]
  } catch (err: any) {
    if (err.message?.includes('cycle') || err.message?.includes('Cyclic')) {
      throw new Error('Workflow contains a cycle — cannot execute')
    }
    throw err
  }
}


// Run an ordered node list, applying skip/merge/loop logic. Shared by the
// top-level pass and each loop body iteration. `record` receives every node
// result the caller wants to collect (loop bodies cap this).
async function runNodeList(
  list: WorkflowNode[],
  ctx: ExecutionContext,
  edges: WorkflowEdge[],
  allNodes: WorkflowNode[],
  record: (result: NodeResult) => void
): Promise<void> {
  for (const node of list) {
    // Execution paused on a Human Review node — stop processing the rest.
    if (ctx.pausedAt) break

    if (node.type.startsWith('trigger-')) {
      // The trigger is the stream's source: its payload becomes the first item.
      const items: WorkflowItem[] = [{ json: ctx.triggerData }]
      setNodeItems(ctx, node.id, items)
      record({ nodeId: node.id, nodeType: node.type, status: 'success', items, itemCount: items.length })
      continue
    }

    if (shouldSkipNode(node.id, edges, ctx)) {
      ctx.skippedNodes.add(node.id)
      record({ nodeId: node.id, nodeType: node.type, status: 'skipped' })
      continue
    }

    // Items this node receives from its active upstream edges.
    ctx.input = gatherInputItems(node.id, edges, ctx)

    if (node.type === 'logic-approval') {
      const start = Date.now()
      try {
        const output = await executeApproval(node, ctx)
        ctx.nodeOutputs.set(node.id, output)
        setNodeItems(ctx, node.id, ctx.input)
        record({ nodeId: node.id, nodeType: node.type, status: 'waiting', output, items: ctx.input.slice(0, STORED_ITEMS_CAP), itemCount: ctx.input.length, duration: Date.now() - start })
      } catch (err: any) {
        record({ nodeId: node.id, nodeType: node.type, status: 'failed', error: err.message, duration: Date.now() - start })
        ctx.skippedNodes.add(node.id)
      }
      continue
    }

    // Merge in "all" mode continues only when EVERY incoming edge delivered items.
    if (node.type === 'logic-merge' && node.data?.mode === 'all') {
      const incoming = edges.filter(edge => edge.target === node.id)
      const allActive = incoming.length > 0 && incoming.every(edge => edgeDelivers(edge, ctx))
      if (!allActive) {
        ctx.skippedNodes.add(node.id)
        record({ nodeId: node.id, nodeType: node.type, status: 'skipped' })
        continue
      }
    }

    const start = Date.now()
    try {
      const output = node.type === 'logic-loop'
        ? await runLoopNode(node, ctx, edges, allNodes, record)
        : await executeNode(node, ctx)
      if (!ctx.nodeOutputs.has(node.id)) ctx.nodeOutputs.set(node.id, output)
      // Routing/transform nodes (condition, filter, switch, loop) set their own
      // per-handle output items; everything else passes its input through on the
      // default handle so the next node receives it.
      if (node.type === 'logic-loop') {
        // The body consumed the "loop" handle; post-loop nodes hang off "done".
        ctx.nodeItems.set(node.id, { done: ctx.input })
      } else if (!ctx.nodeItems.has(node.id)) {
        setNodeItems(ctx, node.id, ctx.input)
      }
      // Record the node's actual OUTPUT items (across all handles) for display.
      const outItems = Object.values(ctx.nodeItems.get(node.id) ?? {}).flat()
      const duration = Date.now() - start
      record({ nodeId: node.id, nodeType: node.type, status: 'success', output, items: outItems.slice(0, STORED_ITEMS_CAP), itemCount: outItems.length, duration })
    } catch (err: any) {
      const duration = Date.now() - start
      record({ nodeId: node.id, nodeType: node.type, status: 'failed', error: err.message, duration })
      ctx.skippedNodes.add(node.id)
      console.error(`⚡ [WorkflowEngine] Node ${node.id} (${node.type}) failed:`, err.message)
    }
  }
}

// The entity → target-alias binding an iteration injects so downstream
// mutating actions act on the current item.
const LOOP_ITEM_ALIAS: Record<string, string> = {
  hardware: 'hardwareId',
  employee: 'employeeId',
  license: 'licenseId',
  consumable: 'consumableId'
}

const LOOP_ENTITY_MODEL: Record<string, any> = {
  hardware: Hardware,
  employee: Employee,
  license: SoftwareLicense,
  consumable: Consumable
}

// forEach data source: up to `cap` active records of the entity for the org.
// (v1: no query-side filter — put a Filter node in the loop body to skip items.)
async function fetchLoopItems(orgId: string, entity: string, cap: number): Promise<string[]> {
  const model = LOOP_ENTITY_MODEL[entity]
  if (!model) return []
  const docs = await model.find({ orgId, deletedAt: null })
    .select('_id')
    .sort({ createdAt: 1 })
    .limit(cap)
    .lean()
  return docs.map((doc: any) => String(doc._id))
}

const MAX_LOOP_ITERATIONS = 1000
const RECORDED_ITERATION_CAP = 5

async function runLoopNode(
  loopNode: WorkflowNode,
  ctx: ExecutionContext,
  edges: WorkflowEdge[],
  allNodes: WorkflowNode[],
  record: (result: NodeResult) => void
): Promise<any> {
  const mode = String(loopNode.data?.mode || 'forEach')
  const cap = Math.min(Math.max(Number(loopNode.data?.maxIterations) || 100, 1), MAX_LOOP_ITERATIONS)

  const bodyIds = computeLoopBodyNodeIds(loopNode.id, edges)
  const bodyNodes = allNodes.filter(node => bodyIds.has(node.id))
  // Only edges internal to the body — the entry edges (source = loop node)
  // are dropped so body roots have no incoming edge for the toposort.
  const bodyEdges = edges.filter(edge => bodyIds.has(edge.source) && bodyIds.has(edge.target))
  const bodySorted = topologicalSort(bodyNodes, bodyEdges)

  // forEach: ids fetched from the DB by entity type. forEachItem: the node's own
  // input items (the stream) — each becomes $json in the body.
  const items = mode === 'forEach'
    ? await fetchLoopItems(ctx.orgId, String(loopNode.data?.entity || ''), cap)
    : []
  const streamItems = mode === 'forEachItem' ? inputItemsOf(ctx) : []

  let iterations = 0
  let succeeded = 0
  let failed = 0
  let recordedIterations = 0

  for (let i = 0; i < cap; i++) {
    if (mode === 'forEach' && i >= items.length) break
    if (mode === 'forEachItem' && i >= streamItems.length) break
    if (mode === 'times' && i >= Number(loopNode.data?.count || 0)) break
    if (mode === 'while') {
      const { entity, field, operator, value, itemField } = loopNode.data || {}
      const holds = await evaluateCheck(ctx.orgId, { entity, field, operator, value, itemField }, ctx.triggerData)
      if (!holds) break
    }

    const scopedTriggerData: Record<string, any> = {
      ...ctx.triggerData,
      loopIndex: i
    }
    if (mode === 'forEach') {
      const alias = LOOP_ITEM_ALIAS[String(loopNode.data?.entity || '')]
      if (alias) scopedTriggerData[alias] = items[i]
      scopedTriggerData.loopItem = items[i]
    }
    if (mode === 'forEachItem') {
      Object.assign(scopedTriggerData, streamItems[i].json)
      scopedTriggerData.loopItem = streamItems[i].json
    }

    const scopedCtx: ExecutionContext = {
      orgId: ctx.orgId,
      triggeredBy: ctx.triggeredBy,
      triggerData: scopedTriggerData,
      nodeOutputs: new Map(),
      nodeItems: new Map(),
      input: [],
      nodeLabelToId: ctx.nodeLabelToId,
      conditionResults: new Map(),
      skippedNodes: new Set(),
      graphEdges: bodyEdges
    }

    const iterationResults: NodeResult[] = []
    await runNodeList(bodySorted, scopedCtx, bodyEdges, bodyNodes, r => iterationResults.push(r))

    iterations++
    if (iterationResults.some(r => r.status === 'failed')) failed++
    else succeeded++

    // Cap recorded per-iteration detail to keep the run document bounded.
    if (recordedIterations < RECORDED_ITERATION_CAP) {
      for (const r of iterationResults) {
        record({ ...r, nodeId: `${r.nodeId}#${i}` })
      }
      recordedIterations++
    }
  }

  return { mode, iterations, succeeded, failed }
}

// A node is skipped when it has incoming edges but none delivered items — i.e.
// every upstream branch feeding it was untaken or produced an empty stream.
function shouldSkipNode(
  nodeId: string,
  edges: WorkflowEdge[],
  ctx: ExecutionContext
): boolean {
  const incoming = edges.filter(edge => edge.target === nodeId)
  if (incoming.length === 0) return false
  return !incoming.some(edge => edgeDelivers(edge, ctx))
}


async function executeNode(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  switch (node.type) {
    case 'condition':
      return executeCondition(node, ctx)
    case 'filter':
      return executeFilter(node, ctx)
    case 'logic-switch':
      return executeSwitch(node, ctx)
    case 'logic-delay':
      return executeDelay(node, ctx)
    case 'logic-merge':
      return executeMerge(node, ctx)
    case 'logic-stop-error':
      return executeStopError(node, ctx)
    case 'logic-noop':
      return { passed: true }
    case 'action-notify':
      return executeNotify(node, ctx)
    case 'action-status':
      return executeStatusChange(node, ctx)
    case 'action-assign':
      return executeAssign(node, ctx)
    case 'action-update-field':
      return executeUpdateField(node, ctx)
    case 'action-tag':
      return executeTag(node, ctx)
    case 'action-webhook':
      return executeWebhook(node, ctx)
    case 'action-audit-log':
      return executeAuditLog(node, ctx)
    case 'action-maintenance':
      return executeCreateMaintenance(node, ctx)
    case 'action-sync':
      return executeSync(node, ctx)
    case 'action-helpdesk':
      return executeHelpdesk(node, ctx)
    case 'action-respond':
      return executeRespond(node, ctx)
    case 'action-get-records':
      return executeGetRecords(node, ctx)
    default:
      console.warn(`⚡ [WorkflowEngine] Unknown node type: ${node.type}`)
      return null
  }
}


// Evaluate an entity/field/operator/value check against live data — shared by
// Condition/Filter nodes and the Loop node's "while" termination.
// Read a dotted field path from an item's json (item-field condition mode).
function getItemFieldValue(json: Record<string, any>, path: string): any {
  if (!path) return undefined
  return String(path).split('.').reduce<any>((cur, seg) => (cur == null ? undefined : cur[seg]), json)
}

async function evaluateCheck(
  orgId: string,
  check: { entity: string; field: string; operator: string; value: any; itemField?: string },
  source: Record<string, any>
): Promise<boolean> {
  const engine = new RulesEngine([], { allowUndefinedFacts: true })
  engine.addRule({
    conditions: {
      all: [{ fact: 'fieldValue', operator: mapOperator(check.operator), value: parseValue(check.value) }]
    },
    event: { type: 'condition-met' }
  })

  // Item-field mode compares the current item's own field; otherwise fall back
  // to the aggregate/DB fact resolver.
  const factValue = check.itemField
    ? getItemFieldValue(source, check.itemField)
    : await fetchFact(orgId, check.entity, check.field, source)
  engine.addFact('fieldValue', () => factValue)

  const result = await engine.run()
  return result.events.length > 0
}

async function executeCondition(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { entity, field, operator, value, itemField } = node.data
  const trueItems: WorkflowItem[] = []
  const falseItems: WorkflowItem[] = []
  for (const item of inputItemsOf(ctx)) {
    const met = await evaluateCheck(ctx.orgId, { entity, field, operator, value, itemField }, item.json)
    ;(met ? trueItems : falseItems).push(item)
  }
  // Route each item to the matching branch handle.
  ctx.nodeItems.set(node.id, { true: trueItems, false: falseItems })
  return { matched: trueItems.length, rejected: falseItems.length, total: trueItems.length + falseItems.length }
}

async function executeFilter(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { entity, field, operator, value, itemField } = node.data
  const passItems: WorkflowItem[] = []
  for (const item of inputItemsOf(ctx)) {
    if (await evaluateCheck(ctx.orgId, { entity, field, operator, value, itemField }, item.json)) passItems.push(item)
  }
  // Filter keeps passing items on its single "true" (pass) handle; the rest drop.
  ctx.nodeItems.set(node.id, { true: passItems })
  return { passed: passItems.length, total: inputItemsOf(ctx).length }
}


async function executeNotify(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { channel, title, message } = node.data

  const eventType: NotificationEventType = 'assetAudit'
  const dispatch = await dispatchNotification(ctx.orgId, eventType, {
    title: title || 'Workflow Notification',
    message: interpolateTemplate(message || 'A workflow automation was triggered.', ctx),
    data: {
      workflowEvent: ctx.triggerData,
      channel
    }
  }, {
    channels: [channel as NotificationChannel],
    respectEventPreferences: false
  })

  if (!dispatch.delivered.includes(channel as NotificationChannel)) {
    const reason = dispatch.failed[0]?.error || dispatch.skipped[0]?.reason || 'Notification was not delivered'
    throw new Error(`${channel} notification was not delivered: ${reason}`)
  }

  return { notified: true, channel, title, delivered: dispatch.delivered }
}

async function executeStatusChange(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { statusSlug } = node.data

  if (!statusSlug) throw new Error('No status slug configured')

  const statusId = await resolveStatusId(ctx.orgId, statusSlug)

  const hardwareIds = await unionTargets(Hardware, 'hardware', ctx)
  if (hardwareIds.length === 0) {
    throw new Error('Status action requires an explicit hardware target in the trigger context')
  }

  const result = await Hardware.updateMany(
    { _id: { $in: hardwareIds }, orgId: ctx.orgId, deletedAt: null },
    { $set: { statusId } }
  )

  return { changed: result.modifiedCount, statusSlug }
}

async function executeTag(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { tag, operation = 'add' } = node.data

  if (!tag) throw new Error('No tag configured')

  const hardwareIds = await unionTargets(Hardware, 'hardware', ctx)
  if (hardwareIds.length === 0) {
    throw new Error('Tag action requires an explicit hardware target in the trigger context')
  }

  const update = operation === 'remove'
    ? { $pull: { tags: tag } }
    : { $addToSet: { tags: tag } }

  const result = await Hardware.updateMany(
    { _id: { $in: hardwareIds }, orgId: ctx.orgId, deletedAt: null },
    update
  )

  return { tagged: result.modifiedCount, tag, operation }
}

async function executeWebhook(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { url, method, headers, body } = node.data
  if (!url) throw new Error('No request URL configured')

  const httpMethod = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase())
    ? String(method).toUpperCase()
    : 'POST'
  const sendsBody = httpMethod !== 'GET' && httpMethod !== 'HEAD'

  // Headers stored as [{key,value}] (new) or an object (legacy) — normalize.
  const headerEntries = Array.isArray(headers)
    ? Object.fromEntries(headers.filter((h: any) => h?.key).map((h: any) => [String(h.key), interpolateTemplate(String(h.value ?? ''), ctx)]))
    : (headers && typeof headers === 'object' ? headers : {})

  let requestBody = ''
  if (sendsBody) {
    // Explicit body if provided; else the legacy workflow envelope (back-compat).
    requestBody = body != null && String(body).trim() !== ''
      ? interpolateTemplate(String(body), ctx)
      : JSON.stringify({
          event: 'workflow.executed',
          timestamp: new Date().toISOString(),
          orgId: ctx.orgId,
          triggerData: ctx.triggerData
        })
  }

  const response = await postSecureWebhook(url, requestBody, {
    'Content-Type': 'application/json',
    'X-AssetNode-Workflow': 'true',
    ...headerEntries
  }, 5000, httpMethod)
  if (!response.ok) {
    throw new Error(`Request returned HTTP ${response.status}; redirects are not followed`)
  }

  console.log(`⚡ [HTTP] ${httpMethod} ${url} → ${response.status}`)
  return { status: response.status, ok: true, method: httpMethod, url }
}

async function executeCreateMaintenance(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { maintenanceType = 'preventive', description = 'Auto-created by workflow' } = node.data

  const hardwareIds = await unionTargets(Hardware, 'hardware', ctx)
  if (hardwareIds.length === 0) {
    throw new Error('Maintenance action requires an explicit hardware target in the trigger context')
  }

  const records = []
  for (const hardwareId of hardwareIds) {
    records.push(await MaintenanceRecord.create({
      orgId: ctx.orgId,
      hardware: hardwareId,
      type: maintenanceType,
      description,
      performedBy: 'Workflow automation',
      status: 'scheduled',
      startDate: new Date()
    }))
  }

  return { created: records.length }
}


async function executeSwitch(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { field, branches = [] } = node.data
  const branchCount = Array.isArray(branches) ? branches.length : 0

  // Route each item to its matched branch handle ("branch-N"), else "default".
  const byHandle: Record<string, WorkflowItem[]> = { default: [] }
  for (let i = 0; i < branchCount; i++) byHandle[`branch-${i}`] = []
  for (const item of inputItemsOf(ctx)) {
    const actualValue = resolveWorkflowFieldValue(item.json, field)
    const matchIndex = matchSwitchCase(actualValue, branches as unknown[])
    const handle = matchIndex >= 0 ? `branch-${matchIndex}` : 'default'
    ;(byHandle[handle] ??= []).push(item)
  }
  ctx.nodeItems.set(node.id, byHandle)
  return { routed: inputItemsOf(ctx).length, branches: branchCount }
}


async function executeMerge(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { mode = 'any' } = node.data
  // Convergence point: emit the concatenation of every input branch that
  // delivered items (runNodeList already enforced the "all" gate upstream).
  setNodeItems(ctx, node.id, ctx.input)
  return { merged: ctx.input.length, mode }
}

// Source node: load org-scoped records of an entity into the item stream (one
// item per record). Ignores its input — it's a stream origin. Hard-capped.
async function executeGetRecords(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const entity = String(node.data?.entity || 'hardware')
  const Model = LOOP_ENTITY_MODEL[entity]
  if (!Model) throw new Error(`Get Records: unknown entity "${entity}"`)

  const limit = Math.min(Math.max(Number(node.data?.limit) || 50, 1), GET_RECORDS_MAX_LIMIT)
  const docs = await Model.find({ orgId: ctx.orgId, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  const items: WorkflowItem[] = docs.map((doc: any) => ({ json: { ...doc, _id: String(doc._id) } }))
  setNodeItems(ctx, node.id, items)
  console.log(`⚡ [GetRecords] ${entity} → ${items.length} items`)
  return { entity, count: items.length }
}

async function executeStopError(node: WorkflowNode, _ctx: ExecutionContext): Promise<any> {
  const message = String(node.data?.message || 'Workflow stopped with error')
  throw new Error(message)
}

async function executeApproval(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const approverEmail = interpolateTemplate(String(node.data?.approverEmail || ''), ctx).trim()
  if (!approverEmail) throw new Error('Human Review requires an approver email')

  const token = crypto.randomBytes(24).toString('base64url')
  await WorkflowApproval.create({
    orgId: ctx.orgId,
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    nodeId: node.id,
    triggerData: ctx.triggerData,
    token
  })

  const appUrl = process.env.APP_URL || 'https://app.asset-node.com'
  const approveUrl = `${appUrl}/api/approvals/${token}?decision=approve`
  const rejectUrl = `${appUrl}/api/approvals/${token}?decision=reject`
  const title = interpolateTemplate(String(node.data?.title || 'Approval required'), ctx)
  const message = interpolateTemplate(String(node.data?.message || ''), ctx)
  const channel = String(node.data?.channel || 'email')

  if (channel === 'email') {
    const sent = await sendWorkflowApprovalEmail(approverEmail, { title, message, approveUrl, rejectUrl })
    if (!sent) throw new Error('Approval request email could not be sent')
  } else {
    const dispatch = await dispatchNotification(ctx.orgId, 'assetAudit', {
      title,
      message: `${message}\n\n✅ Approve: ${approveUrl}\n❌ Reject: ${rejectUrl}`,
      data: { approverEmail }
    }, { channels: [channel as NotificationChannel], respectEventPreferences: false })
    if (!dispatch.delivered.includes(channel as NotificationChannel)) {
      throw new Error(`Approval request could not be sent via ${channel}`)
    }
  }

  // Signal the run to pause; downstream nodes wait for the decision.
  ctx.pausedAt = node.id
  return { waiting: true, approver: approverEmail }
}

// Resume a paused run once an approver decides. Runs ONLY the subgraph
// reachable from the approval node's approved/rejected output — pre-approval
// nodes already ran and are never re-executed.
export async function resumeWorkflowApproval(
  token: string,
  decision: 'approve' | 'reject'
): Promise<{ status: string } | null> {
  const approval = await WorkflowApproval.findOne({ token, status: 'pending' })
  if (!approval) return null

  const approved = decision === 'approve'
  approval.status = approved ? 'approved' : 'rejected'
  approval.decidedAt = new Date()
  approval.decidedVia = 'link'
  await approval.save()

  const workflow = await Workflow.findOne({ _id: approval.workflowId, orgId: approval.orgId })
  const run = await WorkflowRun.findById(approval.runId)
  if (!workflow || !run) return { status: approval.status }

  const nodes = (workflow.nodes || []) as unknown as WorkflowNode[]
  const edges = (workflow.edges || []) as unknown as WorkflowEdge[]

  // Nodes reachable from the chosen handle of the approval node.
  const handle = approved ? 'approved' : 'rejected'
  const startTargets = edges
    .filter(e => e.source === approval.nodeId && e.sourceHandle === handle)
    .map(e => e.target)
  const reachable = new Set<string>()
  for (const start of startTargets) {
    for (const id of reachableNodeIds(start, edges)) reachable.add(id)
  }

  const ctx: ExecutionContext = {
    orgId: String(approval.orgId),
    triggeredBy: (run.triggeredBy as any) || 'manual',
    triggerData: (approval.triggerData as any) || {},
    nodeOutputs: new Map(),
    // Seed the approval node's chosen handle with the paused item so the
    // resumed branch receives it (downstream item gathering starts from here).
    nodeItems: new Map([[approval.nodeId, { [handle]: [{ json: (approval.triggerData as any) || {} }] }]]),
    input: [],
    nodeLabelToId: buildNodeLabelMap(nodes),
    conditionResults: new Map([[approval.nodeId, approved]]),
    skippedNodes: new Set(),
    graphEdges: edges,
    workflowId: String(approval.workflowId),
    runId: String(run._id)
  }

  const sorted = topologicalSort(nodes, edges).filter(n => reachable.has(n.id))
  const appended: NodeResult[] = []
  await runNodeList(sorted, ctx, edges, nodes, r => appended.push(r))

  const priorResults = (run.nodeResults || []) as unknown as NodeResult[]
  const combined = [...priorResults, { nodeId: approval.nodeId, nodeType: 'logic-approval', status: 'success' as const, output: { decision: approval.status } }, ...appended]
  const failure = appended.find(r => r.status === 'failed')
  const paused = ctx.pausedAt

  run.set('nodeResults', combined)
  run.set('status', paused ? 'waiting' : failure ? 'failed' : 'completed')
  if (!paused) run.set('completedAt', new Date())
  await run.save()

  if (!paused) {
    await Workflow.findByIdAndUpdate(approval.workflowId, {
      lastRunAt: new Date(),
      $inc: { runCount: 1 },
      lastError: failure?.error || null
    })
  }

  return { status: approval.status }
}

async function executeRespond(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const status = Number(node.data?.status) || 200
  const contentType = String(node.data?.contentType || 'application/json')
  const body = interpolateTemplate(String(node.data?.body || ''), ctx)
  // Captured by the webhook receiver in 'respond' mode; ignored otherwise.
  ctx.webhookResponse = { status, contentType, body }
  return { responded: true, status }
}

async function executeSync(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const provider = String(node.data?.provider || 'all')

  // Lazy imports throughout — syncOrchestrator/sync services pull in the event
  // bus, which lazy-loads this engine; top-level imports would risk a cycle.
  if (provider === 'all') {
    const { runFullSync } = await import('./syncOrchestrator')
    const result = await runFullSync(ctx.orgId)
    return { synced: true, provider: 'all', created: result.totalCreated, updated: result.totalUpdated, errors: result.totalErrors }
  }

  const results = await runProviderSync(provider, ctx.orgId)
  return {
    synced: true,
    provider,
    created: results.reduce((sum, r) => sum + r.created, 0),
    updated: results.reduce((sum, r) => sum + r.updated, 0),
    errors: results.reduce((sum, r) => sum + r.errors.length, 0)
  }
}

// Run a single integration's sync. Jamf resolves to both variants (Pro +
// School), each tolerated independently — mirroring runFullSync's jamf block.
async function runProviderSync(
  provider: string,
  orgId: string
): Promise<Array<{ created: number; updated: number; errors: unknown[] }>> {
  switch (provider) {
    case 'intune': return [await (await import('./syncIntune')).syncIntune(orgId)]
    case 'autopilot': return [await (await import('./syncAutopilot')).syncAutopilot(orgId)]
    case 'kandji': return [await (await import('./syncKandji')).syncKandji(orgId)]
    case 'mosyle': return [await (await import('./syncMosyle')).syncMosyle(orgId)]
    case 'googleWorkspace': return [await (await import('./syncGoogleWorkspace')).syncGoogleWorkspace(orgId)]
    case 'personio': return [await (await import('./syncPersonio')).syncPersonio(orgId)]
    case 'bamboohr': return [await (await import('./syncBambooHR')).syncBambooHR(orgId)]
    case 'hibob': return [await (await import('./syncHiBob')).syncHiBob(orgId)]
    case 'jamf': {
      const jamf = await import('./syncJamf')
      const out: Array<{ created: number; updated: number; errors: unknown[] }> = []
      let anyOk = false
      for (const fn of [jamf.syncJamfPro, jamf.syncJamfSchool]) {
        try { out.push(await fn(orgId)); anyOk = true }
        catch (err: any) { out.push({ created: 0, updated: 0, errors: [err.message] }) }
      }
      // If neither variant ran, surface the failure as a node error.
      if (!anyOk) throw new Error(out[0]?.errors?.[0] ? String(out[0].errors[0]) : 'Jamf sync failed')
      return out
    }
    default:
      throw new Error(`Unknown sync provider "${provider}"`)
  }
}

async function executeHelpdesk(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const org = await Organization.findById(ctx.orgId).select('name settings.integrations.helpdesk').lean() as any
  const config = org?.settings?.integrations?.helpdesk
  if (!isHelpdeskConfigured(config)) {
    throw new Error('Helpdesk integration is not configured for this organization')
  }

  const requesterEmail = interpolateTemplate(String(node.data?.requesterEmail || ''), ctx).trim()
  if (!requesterEmail) throw new Error('Helpdesk ticket requires a requester email')

  const priority = ['low', 'medium', 'high', 'critical'].includes(String(node.data?.priority))
    ? node.data.priority
    : 'medium'

  const result = await createHelpdeskTicket(config, {
    ticketRef: `WF-${Date.now().toString(36).toUpperCase()}`,
    subject: interpolateTemplate(String(node.data?.subject || 'Workflow ticket'), ctx),
    description: interpolateTemplate(String(node.data?.description || ''), ctx),
    category: String(node.data?.category || 'operations'),
    priority,
    requester: {
      name: interpolateTemplate(String(node.data?.requesterName || 'Automation'), ctx) || 'Automation',
      email: requesterEmail
    },
    organizationName: org.name
  })

  if (!result.ok) {
    throw new Error('Helpdesk ticket was not created — check the integration configuration')
  }
  return { ticketCreated: true, provider: result.provider, externalTicketId: result.externalTicketId }
}

async function executeDelay(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { duration = 1, unit = 'seconds' } = node.data
  const seconds = Number(duration)
  if (unit !== 'seconds' || !Number.isInteger(seconds) || seconds < 1 || seconds > 30) {
    throw new Error('Delay must be a whole number from 1 to 30 seconds')
  }

  const milliseconds = seconds * 1000
  console.log(`⚡ [Delay] Waiting ${milliseconds}ms`)
  await new Promise(resolve => setTimeout(resolve, milliseconds))

  return { waited: milliseconds, configured: `${seconds} seconds` }
}


async function executeAssign(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { assignTo, employeeEmail, note } = node.data

  const hardwareIds = await unionTargets(Hardware, 'hardware', ctx)
  if (hardwareIds.length === 0) {
    throw new Error('Assignment action requires an explicit hardware target in the trigger context')
  }

  const deployableStatuses = await Status.find({ orgId: ctx.orgId, type: 'deployable' }).select('_id').lean()
  const availableCount = await Hardware.countDocuments({
    _id: { $in: hardwareIds },
    orgId: ctx.orgId,
    deletedAt: null,
    assignedTo: null,
    statusId: { $in: deployableStatuses.map(status => status._id) }
  })
  if (availableCount !== hardwareIds.length) {
    throw new Error('One or more workflow assignment targets are not available')
  }

  let employee: any = null
  if (assignTo === 'specific' && employeeEmail) {
    employee = await Employee.findOne({ orgId: ctx.orgId, email: employeeEmail, isActive: true, deletedAt: null }).lean()
  } else if (assignTo === 'itAdmin') {
    const adminUser = await User.findOne({
      orgId: ctx.orgId,
      role: { $in: ['admin', 'manager'] },
      isActive: true
    }).select('_id email').lean()
    if (adminUser) {
      employee = await Employee.findOne({
        orgId: ctx.orgId,
        isActive: true,
        deletedAt: null,
        $or: [
          { userId: adminUser._id },
          { email: adminUser.email }
        ]
      }).lean()
    }
  } else if (assignTo === 'manager') {
    const employeeIds = await unionTargets(Employee, 'employee', ctx)
    const triggeredEmployee = employeeIds[0]
      ? await Employee.findOne({ _id: employeeIds[0], orgId: ctx.orgId, isActive: true, deletedAt: null }).select('managerId').lean()
      : null
    if (triggeredEmployee?.managerId) {
      employee = await Employee.findOne({ _id: triggeredEmployee.managerId, orgId: ctx.orgId, isActive: true, deletedAt: null }).lean()
    }
  } else if (assignTo === 'triggeredUser') {
    const employeeIds = await unionTargets(Employee, 'employee', ctx)
    if (employeeIds[0]) {
      employee = await Employee.findOne({ _id: employeeIds[0], orgId: ctx.orgId, isActive: true, deletedAt: null }).lean()
    }
  }

  if (!employee) {
    throw new Error(`No tenant-scoped employee could be resolved for assignment target "${assignTo}"`)
  }

  const assignment = new Assignment({
    orgId: ctx.orgId,
    employeeId: employee._id,
    hardware: hardwareIds,
    notes: note || 'Auto-assigned by workflow automation',
    assignmentDate: new Date()
  })
  await assignment.save()

  console.log(`⚡ [Assign] ${hardwareIds.length} assets → ${employee.email || employee._id}`)
  return { assigned: hardwareIds.length, employee: employee.email || String(employee._id), assignmentId: String(assignment._id), note }
}


async function executeUpdateField(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { entity, field, value } = node.data
  if (!entity || !field) return { updated: 0, message: 'No entity/field configured' }

  const allowed = WORKFLOW_UPDATE_FIELDS[entity]
  if (!allowed || !allowed.includes(field)) {
    throw new Error(`Field "${field}" is not allowed for automated updates on entity "${entity}"`)
  }

  const modelMap: Record<string, any> = {
    hardware: Hardware,
    license: SoftwareLicense,
    consumable: Consumable,
    employee: Employee
  }
  const Model = modelMap[entity]
  if (!Model) return { updated: 0, message: `Unknown entity: ${entity}` }

  // Run per item so the value expression is resolved against each item ($json)
  // and each item's own record is targeted.
  let updated = 0
  let lastValue = ''
  for (const item of inputItemsOf(ctx)) {
    ctx.currentItem = item.json
    const interpolatedValue = interpolateTemplate(value || '', ctx)
    lastValue = interpolatedValue
    const targetIds = await requireTenantWorkflowTargets(
      Model, entity as WorkflowTargetEntity, ctx.orgId, itemTargetSource(entity as WorkflowTargetEntity, ctx, item)
    )
    if (targetIds.length === 0) {
      ctx.currentItem = undefined
      throw new Error(`Update Field action requires an explicit ${entity} target in the trigger context`)
    }
    const result = await Model.updateMany(
      { _id: { $in: targetIds }, orgId: ctx.orgId, deletedAt: null },
      { $set: { [field]: interpolatedValue } },
      { runValidators: true }
    )
    updated += result.modifiedCount
  }
  ctx.currentItem = undefined

  console.log(`⚡ [UpdateField] ${entity}.${field} → ${updated} docs`)
  return { updated, entity, field, value: lastValue }
}


async function executeAuditLog(node: WorkflowNode, ctx: ExecutionContext): Promise<any> {
  const { severity = 'info', category = 'operations', message } = node.data

  const interpolatedMessage = interpolateTemplate(message || 'Workflow automation executed', ctx)

  await AuditLog.create({
    orgId: ctx.orgId,
    action: 'update' as const,
    entityType: 'workflow',
    entityId: ctx.triggerData.workflowId || 'automation',
    userEmail: 'system@automation',
    metadata: {
      severity,
      category,
      message: interpolatedMessage,
      triggeredBy: ctx.triggeredBy,
      triggerData: ctx.triggerData
    },
    timestamp: new Date()
  })

  console.log(`⚡ [AuditLog] [${severity}/${category}] ${interpolatedMessage}`)
  return { logged: true, severity, category, message: interpolatedMessage }
}


function mapOperator(op: string): string {
  const map: Record<string, string> = {
    'lt': 'lessThan',
    'lte': 'lessThanInclusive',
    'gt': 'greaterThan',
    'gte': 'greaterThanInclusive',
    'eq': 'equal',
    'neq': 'notEqual',
    'in': 'in',
    'contains': 'contains'
  }
  return map[op] || op
}

function parseValue(value: any): any {
  if (typeof value === 'string') {
    const num = Number(value)
    if (!isNaN(num)) return num
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return value
}

async function fetchFact(
  orgId: string,
  entity: string,
  field: string,
  triggerData: Record<string, any>
): Promise<any> {
  switch (entity) {
    case 'hardware': {
      if (field === 'warrantyExpiringCount') {
        const now = new Date()
        return await Hardware.countDocuments({
          orgId,
          deletedAt: null,
          warrantyExpiry: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
        })
      }
      if (field === 'warrantyDaysRemaining') {
        const now = new Date()
        const nextExpiry = await Hardware.findOne({
          orgId,
          deletedAt: null,
          warrantyExpiry: { $gte: now }
        }).select('warrantyExpiry').sort({ warrantyExpiry: 1 }).lean()
        if (!nextExpiry?.warrantyExpiry) return Number.MAX_SAFE_INTEGER
        return Math.ceil((new Date(nextExpiry.warrantyExpiry).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      }
      if (field === 'totalCount') {
        return await Hardware.countDocuments({ orgId, deletedAt: null })
      }
      if (field === 'nonCompliantCount') {
        return await Hardware.countDocuments({
          orgId,
          deletedAt: null,
          'customFields.complianceState': { $in: ['noncompliant', 'nonCompliant'] }
        })
      }
      if (field === 'deviceAge') {
        const result = await Hardware.aggregate([
          { $match: { orgId: new mongoose.Types.ObjectId(orgId), deletedAt: null, purchaseDate: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: { $subtract: [new Date(), '$purchaseDate'] } } } }
        ])
        return result[0] ? result[0].avg / (365.25 * 24 * 60 * 60 * 1000) : 0
      }
      return triggerData[field] ?? 0
    }
    case 'employee': {
      if (field === 'totalCount') {
        return await Employee.countDocuments({ orgId, deletedAt: null, isActive: true })
      }
      return triggerData[field] ?? 0
    }
    case 'license': {
      if (field === 'expiringCount') {
        const now = new Date()
        return await SoftwareLicense.countDocuments({
          orgId, deletedAt: null, isActive: true,
          expirationDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
        })
      }
      return triggerData[field] ?? 0
    }
    case 'consumable': {
      if (field === 'lowStockCount') {
        return await Consumable.countDocuments({
          orgId, deletedAt: null, isActive: true,
          $expr: { $lt: ['$totalQuantity', '$minimumQuantity'] }
        })
      }
      return triggerData[field] ?? 0
    }
    default:
      return triggerData[field] ?? 0
  }
}

// The json an expression resolves `$json` / bare fields against: the current
// item being processed if set (per-item execution, Phase C), else the first
// input item, else the trigger payload. Legacy trigger→action flows are
// unaffected — the trigger item's json IS triggerData.
function currentItemJson(ctx: ExecutionContext): Record<string, any> {
  return ctx.currentItem ?? ctx.input[0]?.json ?? ctx.triggerData
}

// Resolve a node NAME (data.label, falling back to node id) to its first output
// item's json — powers {{ $('Node').item.json.field }}.
function resolveNodeItemJson(ctx: ExecutionContext, name: string): Record<string, any> | undefined {
  const id = ctx.nodeLabelToId?.get(name) ?? name
  return ctx.nodeItems.get(id)?.[DEFAULT_OUTPUT_HANDLE]?.[0]?.json
}

function interpolateTemplate(template: string, ctx: ExecutionContext): string {
  return resolveExpression(template, {
    json: currentItemJson(ctx),
    orgId: ctx.orgId,
    triggeredBy: ctx.triggeredBy,
    nodeItemJson: (name: string) => resolveNodeItemJson(ctx, name)
  })
}
