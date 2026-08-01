import { describe, it, expect } from 'vitest'


interface WorkflowNode { id: string; type: string; data: Record<string, any>; position: { x: number; y: number } }
interface WorkflowEdge { id: string; source: string; target: string; sourceHandle?: string | null }
interface NodeResult { nodeId: string; nodeType: string; status: 'skipped' | 'success' | 'failed'; output?: any; error?: string; duration?: number }

const TRIGGER_TYPES = [
  'trigger-event', 'trigger-schedule', 'trigger-manual', 'trigger-webhook'
] as const

const ACTION_TYPES = [
  'action-updateAsset', 'action-assignAsset', 'action-unassignAsset',
  'action-createAsset', 'action-sendNotification', 'action-createMaintenance',
  'action-webhook', 'action-updateEmployee', 'action-delay',
] as const

const CONDITION_TYPES = ['condition', 'switch'] as const

function isTriggerNode(type: string): boolean {
  return type.startsWith('trigger-')
}

function topoSortSimple(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  if (edges.length === 0) return nodes.map(n => n.id)

  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  nodes.forEach(n => { inDegree.set(n.id, 0); adjacency.set(n.id, []) })
  edges.forEach(e => {
    adjacency.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
  })

  const queue: string[] = []
  inDegree.forEach((deg, nodeId) => { if (deg === 0) queue.push(nodeId) })

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const neighbor of adjacency.get(current) || []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1)
      if (inDegree.get(neighbor) === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== nodes.length) throw new Error('Workflow contains a cycle — cannot execute')
  return sorted
}

function shouldSkipNode(
  nodeId: string,
  edges: WorkflowEdge[],
  conditionResults: Map<string, boolean>
): boolean {
  const incoming = edges.filter(e => e.target === nodeId)
  if (incoming.length === 0) return false

  for (const edge of incoming) {
    if (!edge.sourceHandle) continue

    if (edge.sourceHandle === 'true' || edge.sourceHandle === 'false') {
      const conditionResult = conditionResults.get(edge.source)
      if (conditionResult === undefined) continue
      const expectedBranch = edge.sourceHandle === 'true'
      if (conditionResult !== expectedBranch) return true
    }
  }
  return false
}

function deriveRunStatus(results: NodeResult[]): 'completed' | 'failed' {
  return results.some(r => r.status === 'failed') ? 'failed' : 'completed'
}


describe('Workflow Engine — DAG & Execution Logic', () => {
  describe('Node Type Registry', () => {
    it('should have 4 trigger types', () => {
      expect(TRIGGER_TYPES).toHaveLength(4)
    })

    it('should have 9 action types', () => {
      expect(ACTION_TYPES).toHaveLength(9)
    })

    it('should have 2 condition types', () => {
      expect(CONDITION_TYPES).toHaveLength(2)
    })

    it('all trigger types should start with "trigger-"', () => {
      TRIGGER_TYPES.forEach(t => expect(t).toMatch(/^trigger-/))
    })

    it('all action types should start with "action-"', () => {
      ACTION_TYPES.forEach(t => expect(t).toMatch(/^action-/))
    })
  })

  describe('isTriggerNode', () => {
    it.each(['trigger-event', 'trigger-schedule', 'trigger-manual', 'trigger-webhook'])(
      '"%s" → true', (type) => { expect(isTriggerNode(type)).toBe(true) }
    )

    it.each(['action-updateAsset', 'condition', 'switch'])(
      '"%s" → false', (type) => { expect(isTriggerNode(type)).toBe(false) }
    )
  })

  describe('Topological Sort', () => {
    function mkNode(id: string): WorkflowNode {
      return { id, type: 'action', data: {}, position: { x: 0, y: 0 } }
    }
    function mkEdge(source: string, target: string): WorkflowEdge {
      return { id: `${source}-${target}`, source, target }
    }

    it('single node → returns that node', () => {
      const sorted = topoSortSimple([mkNode('A')], [])
      expect(sorted).toEqual(['A'])
    })

    it('linear chain A → B → C', () => {
      const nodes = [mkNode('A'), mkNode('B'), mkNode('C')]
      const edges = [mkEdge('A', 'B'), mkEdge('B', 'C')]
      const sorted = topoSortSimple(nodes, edges)
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'))
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('C'))
    })

    it('diamond: A → B, A → C, B → D, C → D', () => {
      const nodes = [mkNode('A'), mkNode('B'), mkNode('C'), mkNode('D')]
      const edges = [mkEdge('A', 'B'), mkEdge('A', 'C'), mkEdge('B', 'D'), mkEdge('C', 'D')]
      const sorted = topoSortSimple(nodes, edges)
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'))
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('C'))
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('D'))
      expect(sorted.indexOf('C')).toBeLessThan(sorted.indexOf('D'))
    })

    it('cycle should throw', () => {
      const nodes = [mkNode('A'), mkNode('B')]
      const edges = [mkEdge('A', 'B'), mkEdge('B', 'A')]
      expect(() => topoSortSimple(nodes, edges)).toThrow(/cycle/i)
    })

    it('disconnected nodes all included', () => {
      const nodes = [mkNode('A'), mkNode('B'), mkNode('C')]
      const sorted = topoSortSimple(nodes, [])
      expect(sorted).toHaveLength(3)
      expect(sorted).toContain('A')
      expect(sorted).toContain('B')
      expect(sorted).toContain('C')
    })
  })

  describe('Node Skip Logic (Condition Branches)', () => {
    it('should not skip node with no incoming edges', () => {
      expect(shouldSkipNode('A', [], new Map())).toBe(false)
    })

    it('should not skip if edge has no sourceHandle', () => {
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 'cond', target: 'action' }]
      expect(shouldSkipNode('action', edges, new Map())).toBe(false)
    })

    it('should not skip true-branch when condition is true', () => {
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'cond', target: 'then-action', sourceHandle: 'true' },
      ]
      const conditions = new Map([['cond', true]])
      expect(shouldSkipNode('then-action', edges, conditions)).toBe(false)
    })

    it('should skip true-branch when condition is false', () => {
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'cond', target: 'then-action', sourceHandle: 'true' },
      ]
      const conditions = new Map([['cond', false]])
      expect(shouldSkipNode('then-action', edges, conditions)).toBe(true)
    })

    it('should not skip false-branch when condition is false', () => {
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'cond', target: 'else-action', sourceHandle: 'false' },
      ]
      const conditions = new Map([['cond', false]])
      expect(shouldSkipNode('else-action', edges, conditions)).toBe(false)
    })

    it('should skip false-branch when condition is true', () => {
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'cond', target: 'else-action', sourceHandle: 'false' },
      ]
      const conditions = new Map([['cond', true]])
      expect(shouldSkipNode('else-action', edges, conditions)).toBe(true)
    })
  })

  describe('Run Status Derivation', () => {
    it('all success → completed', () => {
      expect(deriveRunStatus([
        { nodeId: 'a', nodeType: 't', status: 'success' },
        { nodeId: 'b', nodeType: 't', status: 'success' },
      ])).toBe('completed')
    })

    it('any failure → failed', () => {
      expect(deriveRunStatus([
        { nodeId: 'a', nodeType: 't', status: 'success' },
        { nodeId: 'b', nodeType: 't', status: 'failed', error: 'oops' },
      ])).toBe('failed')
    })

    it('all skipped → completed', () => {
      expect(deriveRunStatus([
        { nodeId: 'a', nodeType: 't', status: 'skipped' },
      ])).toBe('completed')
    })

    it('empty results → completed', () => {
      expect(deriveRunStatus([])).toBe('completed')
    })
  })
})
