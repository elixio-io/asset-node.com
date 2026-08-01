import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../workflowWebhookSecurity', async () => {
  const actual = await vi.importActual<typeof import('../workflowWebhookSecurity')>('../workflowWebhookSecurity')
  return { ...actual, postSecureWebhook: vi.fn() }
})

vi.mock('../syncOrchestrator', () => ({
  runFullSync: vi.fn().mockResolvedValue({ totalCreated: 3, totalUpdated: 5, totalErrors: 0 })
}))

vi.mock('../syncPersonio', () => ({
  syncPersonio: vi.fn().mockResolvedValue({ provider: 'personio', created: 2, updated: 4, errors: [], duration: 1 })
}))

vi.mock('../helpdeskClient', () => ({
  isHelpdeskConfigured: vi.fn(() => true),
  createHelpdeskTicket: vi.fn().mockResolvedValue({ ok: true, provider: 'zendesk', externalTicketId: '42' })
}))

vi.mock('../emailService', () => ({
  sendWorkflowApprovalEmail: vi.fn().mockResolvedValue(true)
}))

import { AuditLog } from '../../../models/AuditLog'
import { Hardware } from '../../../models/Hardware'
import { Organization } from '../../../models/Organization'
import { Workflow } from '../../../models/Workflow'
import { WorkflowRun } from '../../../models/WorkflowRun'
import { WorkflowApproval } from '../../../models/WorkflowApproval'
import { executeWorkflow, resumeWorkflowApproval } from '../workflowEngine'
import { postSecureWebhook } from '../workflowWebhookSecurity'
import { createHelpdeskTicket } from '../helpdeskClient'
import { sendWorkflowApprovalEmail } from '../emailService'

describe('workflow engine runtime failure propagation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('marks dependent nodes skipped and rejects the execution after an action fails', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'workflow-a',
      orgId: 'org-a',
      name: 'Failure propagation',
      trigger: { type: 'manual' },
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'webhook', type: 'action-webhook', data: { url: 'https://hooks.example.com/test' }, position: { x: 200, y: 0 } },
        { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Must not run' }, position: { x: 400, y: 0 } }
      ],
      edges: [
        { id: 'first', source: 'trigger', target: 'webhook' },
        { id: 'dependent', source: 'webhook', target: 'audit' }
      ]
    } as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-a' } as any)
    const runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)
    vi.mocked(postSecureWebhook).mockRejectedValue(new Error('delivery failed'))

    await expect(executeWorkflow('workflow-a', 'org-a', 'manual', {}))
      .rejects.toThrow('Workflow failed at action-webhook: delivery failed')
    expect(auditCreate).not.toHaveBeenCalled()

    expect(runUpdate).toHaveBeenCalledWith('run-a', expect.objectContaining({
      status: 'failed',
      nodeResults: expect.arrayContaining([
        expect.objectContaining({ nodeId: 'webhook', status: 'failed' }),
        expect.objectContaining({ nodeId: 'audit', status: 'skipped' })
      ])
    }))
  })

  it('runs only the subgraph reachable from the firing trigger (multi-trigger)', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-multi',
      orgId: 'org-a',
      name: 'Multi-trigger',
      triggers: [
        { type: 'manual', nodeId: 'trig-a' },
        { type: 'manual', nodeId: 'trig-b' }
      ],
      nodes: [
        { id: 'trig-a', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'trig-b', type: 'trigger-manual', data: {}, position: { x: 0, y: 200 } },
        { id: 'audit-a', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'A' }, position: { x: 200, y: 0 } },
        { id: 'audit-b', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'B' }, position: { x: 200, y: 200 } }
      ],
      edges: [
        { id: 'ea', source: 'trig-a', target: 'audit-a' },
        { id: 'eb', source: 'trig-b', target: 'audit-b' }
      ]
    } as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-multi' } as any)
    const runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-multi', 'org-a', 'manual', {}, { fromTriggerNodeId: 'trig-a' })

    // Only trig-a's branch runs; trig-b and audit-b are excluded entirely.
    expect(auditCreate).toHaveBeenCalledTimes(1)
    const nodeResults = (runUpdate.mock.calls[0][1] as any).nodeResults
    const ids = nodeResults.map((r: any) => r.nodeId)
    expect(ids).toContain('audit-a')
    expect(ids).not.toContain('audit-b')
    expect(ids).not.toContain('trig-b')
  })

  it('threads the trigger payload as an item into the first downstream node (data flow)', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-stream',
      orgId: 'org-a',
      name: 'Stream',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'x' }, position: { x: 200, y: 0 } }
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'audit' }]
    } as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-stream' } as any)
    const runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-stream', 'org-a', 'manual', { hardwareId: 'hw-1', foo: 'bar' })

    const nodeResults = (runUpdate.mock.calls[0][1] as any).nodeResults
    const trigger = nodeResults.find((r: any) => r.nodeId === 'trigger')
    const audit = nodeResults.find((r: any) => r.nodeId === 'audit')
    // Trigger emits its payload as the first item; the action receives it.
    expect(trigger.items).toEqual([{ json: { hardwareId: 'hw-1', foo: 'bar' } }])
    expect(audit.items).toEqual([{ json: { hardwareId: 'hw-1', foo: 'bar' } }])
    expect(audit.itemCount).toBe(1)
  })

  it('stop-and-error fails the run with its message and skips downstream nodes', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-stop',
      orgId: 'org-a',
      name: 'Stop test',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'stop', type: 'logic-stop-error', data: { message: 'No manager assigned' }, position: { x: 200, y: 0 } },
        { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Must not run' }, position: { x: 400, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'stop' },
        { id: 'e2', source: 'stop', target: 'audit' }
      ]
    } as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-stop' } as any)
    const runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await expect(executeWorkflow('wf-stop', 'org-a', 'manual', {}))
      .rejects.toThrow('Workflow failed at logic-stop-error: No manager assigned')
    expect(auditCreate).not.toHaveBeenCalled()
    expect(runUpdate).toHaveBeenCalledWith('run-stop', expect.objectContaining({
      status: 'failed',
      nodeResults: expect.arrayContaining([
        expect.objectContaining({ nodeId: 'stop', status: 'failed', error: 'No manager assigned' }),
        expect.objectContaining({ nodeId: 'audit', status: 'skipped' })
      ])
    }))
  })

  it('filter blocks its downstream path when the check fails, without failing the run', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-filter',
      orgId: 'org-a',
      name: 'Filter test',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'filter', type: 'filter', data: { entity: 'employee', field: 'created', operator: 'gt', value: '10' }, position: { x: 200, y: 0 } },
        { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Only when passed' }, position: { x: 400, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'filter' },
        { id: 'e2', source: 'filter', sourceHandle: 'true', target: 'audit' }
      ]
    } as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-filter' } as any)
    const runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    // created=5 is not > 10 → filter blocks, downstream skipped, run completes.
    await executeWorkflow('wf-filter', 'org-a', 'manual', { created: 5 })

    expect(auditCreate).not.toHaveBeenCalled()
    expect(runUpdate).toHaveBeenCalledWith('run-filter', expect.objectContaining({
      status: 'completed',
      nodeResults: expect.arrayContaining([
        expect.objectContaining({ nodeId: 'filter', status: 'success' }),
        expect.objectContaining({ nodeId: 'audit', status: 'skipped' })
      ])
    }))
  })

  it('test runs stop after the target node, never bump run metadata, and return failures instead of throwing', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-test-mode',
      orgId: 'org-a',
      name: 'Test mode',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'stop', type: 'logic-stop-error', data: { message: 'Deliberate failure' }, position: { x: 200, y: 0 } },
        // Downstream node is deliberately UNCONFIGURED — per-node testing must
        // still run the prefix even though this node would fail validation.
        { id: 'notify', type: 'action-notify', data: {}, position: { x: 400, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'stop' },
        { id: 'e2', source: 'stop', target: 'notify' }
      ]
    } as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-test-mode' } as any)
    vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    const workflowUpdate = vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)

    // Resolves (does not throw) despite the failing node, and excludes the
    // out-of-subset unconfigured notify node.
    const result = await executeWorkflow('wf-test-mode', 'org-a', 'test', {}, { stopAfterNodeId: 'stop' })

    expect(result.status).toBe('failed')
    expect(result.nodeResults.map(r => r.nodeId)).toEqual(['trigger', 'stop'])
    expect(result.nodeResults.at(-1)).toMatchObject({ nodeId: 'stop', status: 'failed', error: 'Deliberate failure' })
    // runCount/lastRunAt/lastError untouched for test runs.
    expect(workflowUpdate).not.toHaveBeenCalled()
  })

  it('rejects a test run when the target node does not exist, without creating a run', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-missing-node',
      orgId: 'org-a',
      name: 'Missing node',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'x' }, position: { x: 200, y: 0 } }
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'audit' }]
    } as any)
    const runCreate = vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'never' } as any)

    await expect(executeWorkflow('wf-missing-node', 'org-a', 'test', {}, { stopAfterNodeId: 'ghost' }))
      .rejects.toThrow('Node ghost not found in workflow graph')
    expect(runCreate).not.toHaveBeenCalled()
  })

  it('merge "any" continues on one active input; merge "all" requires every input', async () => {
    const buildWorkflow = (mode: 'any' | 'all') => ({
      _id: `wf-merge-${mode}`,
      orgId: 'org-a',
      name: `Merge ${mode}`,
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'cond', type: 'condition', data: { entity: 'employee', field: 'created', operator: 'gt', value: '10' }, position: { x: 200, y: 0 } },
        { id: 'merge', type: 'logic-merge', data: { mode }, position: { x: 400, y: 0 } },
        { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'After merge' }, position: { x: 600, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'cond' },
        // Condition's true branch (inactive: created=5 is not > 10) + a direct
        // always-active path from the trigger, converging on the merge.
        { id: 'e2', source: 'cond', sourceHandle: 'true', target: 'merge' },
        { id: 'e3', source: 'trigger', target: 'merge' },
        { id: 'e4', source: 'merge', target: 'audit' }
      ]
    })

    // mode "any": the direct trigger path is active → merge + audit run.
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(buildWorkflow('any') as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-any' } as any)
    let runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    let auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-merge-any', 'org-a', 'manual', { created: 5 })
    expect(auditCreate).toHaveBeenCalledTimes(1)
    let results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(results.find((r: any) => r.nodeId === 'merge').status).toBe('success')

    vi.restoreAllMocks()

    // mode "all": the condition's true branch is inactive → merge + audit skip.
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(buildWorkflow('all') as any)
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: 'run-all' } as any)
    runUpdate = vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-merge-all', 'org-a', 'manual', { created: 5 })
    expect(auditCreate).not.toHaveBeenCalled()
    results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(results.find((r: any) => r.nodeId === 'merge').status).toBe('skipped')
    expect(results.find((r: any) => r.nodeId === 'audit').status).toBe('skipped')
  })

  const loopWorkflow = (loopData: Record<string, any>) => ({
    _id: 'wf-loop',
    orgId: 'org-a',
    name: 'Loop test',
    triggers: [{ type: 'manual', nodeId: 'trigger' }],
    nodes: [
      { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
      { id: 'loop', type: 'logic-loop', data: loopData, position: { x: 200, y: 0 } },
      { id: 'body', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Iteration {{loopIndex}}' }, position: { x: 400, y: 0 } },
      { id: 'after', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Done' }, position: { x: 400, y: 200 } }
    ],
    edges: [
      { id: 't', source: 'trigger', target: 'loop' },
      { id: 'l', source: 'loop', sourceHandle: 'loop', target: 'body' },
      { id: 'd', source: 'loop', sourceHandle: 'done', target: 'after' }
    ]
  })

  const spyRun = (runId: string) => {
    vi.spyOn(WorkflowRun, 'create').mockResolvedValue({ _id: runId } as any)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)
    return vi.spyOn(WorkflowRun, 'findByIdAndUpdate').mockResolvedValue(null as any)
  }

  it('times mode runs the body exactly count times and then the done path', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(loopWorkflow({ mode: 'times', count: 3, maxIterations: 100 }) as any)
    const runUpdate = spyRun('run-times')
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-loop', 'org-a', 'manual', {})

    // 3 body iterations + 1 "after" (done path).
    expect(auditCreate).toHaveBeenCalledTimes(4)
    const results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(results.find((r: any) => r.nodeId === 'loop').output).toMatchObject({ mode: 'times', iterations: 3, succeeded: 3 })
    expect(results.find((r: any) => r.nodeId === 'after')).toBeTruthy()
    // Per-iteration body results are tagged with the iteration index.
    expect(results.filter((r: any) => String(r.nodeId).startsWith('body#')).length).toBe(3)
  })

  it('caps runaway loops at maxIterations', async () => {
    // while true, capped at 5.
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(loopWorkflow({
      mode: 'while', entity: 'hardware', field: 'totalCount', operator: 'gt', value: '0', maxIterations: 5
    }) as any)
    const runUpdate = spyRun('run-while')
    vi.spyOn(Hardware, 'countDocuments').mockResolvedValue(42 as any)
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-loop', 'org-a', 'manual', {})

    expect(auditCreate).toHaveBeenCalledTimes(5 + 1) // 5 capped iterations + done
    const results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(results.find((r: any) => r.nodeId === 'loop').output).toMatchObject({ iterations: 5 })
  })

  it('forEach binds each entity id into the iteration scope', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(loopWorkflow({ mode: 'forEach', entity: 'hardware', maxIterations: 100 }) as any)
    const runUpdate = spyRun('run-foreach')
    // Two hardware records to iterate over.
    const leanChain = { select: () => leanChain, sort: () => leanChain, limit: () => leanChain, lean: () => Promise.resolve([{ _id: 'hw-1' }, { _id: 'hw-2' }]) }
    vi.spyOn(Hardware, 'find').mockReturnValue(leanChain as any)
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-loop', 'org-a', 'manual', {})

    expect(auditCreate).toHaveBeenCalledTimes(2 + 1) // 2 items + done
    const results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(results.find((r: any) => r.nodeId === 'loop').output).toMatchObject({ mode: 'forEach', iterations: 2 })
  })

  it('loops over the input item stream (forEachItem), running the body once per item', async () => {
    const RECORDS = [
      { _id: '6a623ee48649419b4ed583c1', assetTag: 'L1' },
      { _id: '6a623ee48649419b4ed583c2', assetTag: 'L2' }
    ]
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-loopitems', orgId: 'org-a', name: 'Loop items',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'get', type: 'action-get-records', data: { entity: 'hardware', limit: 50 }, position: { x: 150, y: 0 } },
        { id: 'loop', type: 'logic-loop', data: { mode: 'forEachItem', maxIterations: 100 }, position: { x: 300, y: 0 } },
        { id: 'body', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'tag {{ $json.assetTag }}' }, position: { x: 450, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'get' },
        { id: 'e2', source: 'get', target: 'loop' },
        { id: 'e3', source: 'loop', target: 'body', sourceHandle: 'loop' }
      ]
    } as any)
    const runUpdate = spyRun('run-loopitems')
    vi.spyOn(Hardware, 'find').mockImplementation(() => {
      const chain: any = { select: () => chain, sort: () => chain, limit: () => chain, lean: () => Promise.resolve(RECORDS) }
      return chain
    })
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)

    await executeWorkflow('wf-loopitems', 'org-a', 'manual', {})

    // Body ran once per input item, each seeing its own item via {{ $json }}.
    expect(auditCreate).toHaveBeenCalledTimes(2)
    const messages = auditCreate.mock.calls.map(c => (c[0] as any).metadata.message).sort()
    expect(messages).toEqual(['tag L1', 'tag L2'])
    const results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(results.find((r: any) => r.nodeId === 'loop').output).toMatchObject({ mode: 'forEachItem', iterations: 2 })
  })

  it('streams source records through a per-item condition split into a per-item update', async () => {
    const RECORDS = [
      { _id: '6a623ee48649419b4ed583b1', status: 'active', assetTag: 'A1' },
      { _id: '6a623ee48649419b4ed583b2', status: 'retired', assetTag: 'A2' },
      { _id: '6a623ee48649419b4ed583b3', status: 'active', assetTag: 'A3' }
    ]
    vi.spyOn(Workflow, 'findOne').mockResolvedValue({
      _id: 'wf-flow', orgId: 'org-a', name: 'Stream split',
      triggers: [{ type: 'manual', nodeId: 'trigger' }],
      nodes: [
        { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
        { id: 'get', type: 'action-get-records', data: { entity: 'hardware', limit: 50 }, position: { x: 200, y: 0 } },
        { id: 'cond', type: 'condition', data: { itemField: 'status', operator: 'eq', value: 'active' }, position: { x: 400, y: 0 } },
        { id: 'upd', type: 'action-update-field', data: { entity: 'hardware', field: 'notes', value: 'flagged {{ $json.assetTag }}' }, position: { x: 600, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'get' },
        { id: 'e2', source: 'get', target: 'cond' },
        { id: 'e3', source: 'cond', target: 'upd', sourceHandle: 'true' }
      ]
    } as any)
    const runUpdate = spyRun('run-flow')
    vi.spyOn(Hardware, 'find').mockImplementation((query: any) => {
      const idFilter = query?._id?.$in
      const rows = idFilter ? RECORDS.filter(r => idFilter.includes(r._id)) : RECORDS
      const chain: any = { select: () => chain, sort: () => chain, limit: () => chain, lean: () => Promise.resolve(rows) }
      return chain
    })
    const updateMany = vi.spyOn(Hardware, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any)

    await executeWorkflow('wf-flow', 'org-a', 'manual', {})

    const results = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    // Get Records emitted 3 items into the stream.
    expect(results.find((r: any) => r.nodeId === 'get')).toMatchObject({ itemCount: 3 })
    // Condition split the stream per item: 2 active → true, 1 retired → false.
    expect(results.find((r: any) => r.nodeId === 'cond').output).toMatchObject({ matched: 2, rejected: 1 })
    // Update ran once per active item, each targeting its own _id with a per-item value.
    expect(updateMany).toHaveBeenCalledTimes(2)
    const targeted = updateMany.mock.calls.map(c => (c[0] as any)._id.$in[0]).sort()
    expect(targeted).toEqual(['6a623ee48649419b4ed583b1', '6a623ee48649419b4ed583b3'])
    const setNotes = updateMany.mock.calls.map(c => (c[1] as any).$set.notes).sort()
    expect(setNotes).toEqual(['flagged A1', 'flagged A3'])
  })

  const singleActionWorkflow = (actionNode: any) => ({
    _id: 'wf-action', orgId: 'org-a', name: 'Action test',
    triggers: [{ type: 'manual', nodeId: 'trigger' }],
    nodes: [
      { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
      actionNode
    ],
    edges: [{ id: 'e', source: 'trigger', target: actionNode.id }]
  })

  it('sync action runs a full integration sync and reports the totals', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(singleActionWorkflow(
      { id: 'sync', type: 'action-sync', data: {}, position: { x: 200, y: 0 } }
    ) as any)
    const runUpdate = spyRun('run-sync')

    await executeWorkflow('wf-action', 'org-a', 'manual', {})

    const result = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults.find((r: any) => r.nodeId === 'sync')
    expect(result.status).toBe('success')
    expect(result.output).toMatchObject({ synced: true, created: 3, updated: 5, errors: 0 })
  })

  it('sync action targets a single provider and reports only its totals', async () => {
    const { syncPersonio } = await import('../syncPersonio')
    const { runFullSync } = await import('../syncOrchestrator')
    // Module-mock call history isn't cleared by restoreAllMocks between tests.
    vi.mocked(runFullSync).mockClear()
    vi.mocked(syncPersonio).mockClear()
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(singleActionWorkflow(
      { id: 'sync', type: 'action-sync', data: { provider: 'personio' }, position: { x: 200, y: 0 } }
    ) as any)
    const runUpdate = spyRun('run-sync-personio')

    await executeWorkflow('wf-action', 'org-a', 'manual', {})

    expect(vi.mocked(syncPersonio)).toHaveBeenCalledWith('org-a')
    expect(vi.mocked(runFullSync)).not.toHaveBeenCalled()
    const result = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults.find((r: any) => r.nodeId === 'sync')
    expect(result.output).toMatchObject({ synced: true, provider: 'personio', created: 2, updated: 4, errors: 0 })
  })

  it('helpdesk action creates a ticket via the configured provider', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(singleActionWorkflow(
      { id: 'hd', type: 'action-helpdesk', data: { subject: 'Device {{loopItem}} flagged', description: 'x', priority: 'high', category: 'security', requesterEmail: '{{userEmail}}' }, position: { x: 200, y: 0 } }
    ) as any)
    const runUpdate = spyRun('run-hd')
    const orgChain = { select: () => orgChain, lean: () => Promise.resolve({ name: 'Acme', settings: { integrations: { helpdesk: { enabled: true, provider: 'zendesk', subdomain: 'acme', email: 'it@acme.com', apiToken: 'x' } } } }) }
    vi.spyOn(Organization, 'findById').mockReturnValue(orgChain as any)

    await executeWorkflow('wf-action', 'org-a', 'manual', { userEmail: 'user@acme.com' })

    // Requester email interpolated from trigger data.
    expect(vi.mocked(createHelpdeskTicket)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: 'high', requester: expect.objectContaining({ email: 'user@acme.com' }) })
    )
    const result = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults.find((r: any) => r.nodeId === 'hd')
    expect(result.status).toBe('success')
    expect(result.output).toMatchObject({ ticketCreated: true, externalTicketId: '42' })
  })

  const approvalWorkflow = () => ({
    _id: 'wf-approval', orgId: 'org-a', name: 'Approval test',
    triggers: [{ type: 'manual', nodeId: 'trigger' }],
    nodes: [
      { id: 'trigger', type: 'trigger-manual', data: {}, position: { x: 0, y: 0 } },
      { id: 'review', type: 'logic-approval', data: { channel: 'email', approverEmail: 'boss@acme.com', title: 'OK?', message: 'Please review' }, position: { x: 200, y: 0 } },
      { id: 'onApprove', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Approved' }, position: { x: 400, y: 0 } },
      { id: 'onReject', type: 'action-audit-log', data: { severity: 'warning', category: 'operations', message: 'Rejected' }, position: { x: 400, y: 200 } }
    ],
    edges: [
      { id: 't', source: 'trigger', target: 'review' },
      { id: 'a', source: 'review', sourceHandle: 'approved', target: 'onApprove' },
      { id: 'r', source: 'review', sourceHandle: 'rejected', target: 'onReject' }
    ]
  })

  it('pauses on a Human Review node without running either branch, then resumes the approved path', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(approvalWorkflow() as any)
    const runUpdate = spyRun('run-approval')
    const auditCreate = vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)
    const approvalCreate = vi.spyOn(WorkflowApproval, 'create').mockResolvedValue({} as any)

    const result = await executeWorkflow('wf-approval', 'org-a', 'manual', {})

    // Run pauses: an approval record + email are created, neither branch runs.
    expect(result.status).toBe('waiting')
    expect(approvalCreate).toHaveBeenCalled()
    expect(vi.mocked(sendWorkflowApprovalEmail)).toHaveBeenCalledWith('boss@acme.com', expect.objectContaining({ approveUrl: expect.stringContaining('/api/approvals/') }))
    expect(auditCreate).not.toHaveBeenCalled()
    const waitingResults = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults
    expect(waitingResults.find((r: any) => r.nodeId === 'review').status).toBe('waiting')
    expect(waitingResults.find((r: any) => r.nodeId === 'onApprove')).toBeUndefined()

    // Resume: only the approved branch runs; the rejected branch never does.
    const savedRun: any = { _id: 'run-approval', triggeredBy: 'manual', nodeResults: waitingResults, set: vi.fn(), save: vi.fn() }
    vi.spyOn(WorkflowApproval, 'findOne').mockResolvedValue({
      token: 'tok', status: 'pending', orgId: 'org-a', workflowId: 'wf-approval', runId: 'run-approval',
      nodeId: 'review', triggerData: {}, save: vi.fn()
    } as any)
    vi.spyOn(Workflow, 'findById').mockResolvedValue(approvalWorkflow() as any)
    vi.spyOn(WorkflowRun, 'findById').mockResolvedValue(savedRun)
    vi.spyOn(Workflow, 'findByIdAndUpdate').mockResolvedValue(null as any)

    const resume = await resumeWorkflowApproval('tok', 'approve')

    expect(resume?.status).toBe('approved')
    expect(auditCreate).toHaveBeenCalledTimes(1) // only the approved branch
    const finalStatus = savedRun.set.mock.calls.find((c: any[]) => c[0] === 'status')?.[1]
    expect(finalStatus).toBe('completed')
  })

  it('returns null when resuming an already-decided approval', async () => {
    vi.spyOn(WorkflowApproval, 'findOne').mockResolvedValue(null)
    expect(await resumeWorkflowApproval('used-token', 'approve')).toBeNull()
  })

  it('HTTP request action sends the configured method, headers and interpolated body', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(singleActionWorkflow(
      { id: 'http', type: 'action-webhook', data: {
        url: 'https://api.example.com/x', method: 'put',
        headers: [{ key: 'X-Token', value: '{{token}}' }, { key: '', value: 'ignored' }],
        body: '{"id":"{{assetId}}"}'
      }, position: { x: 200, y: 0 } }
    ) as any)
    const runUpdate = spyRun('run-http')
    vi.mocked(postSecureWebhook).mockResolvedValue({ status: 200, ok: true, body: '' } as any)

    await executeWorkflow('wf-action', 'org-a', 'manual', { token: 'sekret', assetId: 'hw-9' })

    expect(vi.mocked(postSecureWebhook)).toHaveBeenCalledWith(
      'https://api.example.com/x',
      '{"id":"hw-9"}',
      expect.objectContaining({ 'X-Token': 'sekret' }),
      expect.any(Number),
      'PUT'
    )
    const result = (runUpdate.mock.calls.at(-1)![1] as any).nodeResults.find((r: any) => r.nodeId === 'http')
    expect(result.output).toMatchObject({ method: 'PUT', ok: true, status: 200 })
  })

  it('respond action surfaces a custom webhook response in the execution result', async () => {
    vi.spyOn(Workflow, 'findOne').mockResolvedValue(singleActionWorkflow(
      { id: 'respond', type: 'action-respond', data: { status: 201, contentType: 'application/json', body: '{"asset":"{{assetId}}"}' }, position: { x: 200, y: 0 } }
    ) as any)
    spyRun('run-respond')

    const result = await executeWorkflow('wf-action', 'org-a', 'webhook', { assetId: 'hw-7' })

    expect(result.webhookResponse).toEqual({ status: 201, contentType: 'application/json', body: '{"asset":"hw-7"}' })
  })
})
