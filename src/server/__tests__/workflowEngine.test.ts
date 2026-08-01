import { describe, it, expect, vi } from 'vitest'
import { isExternalUrl } from '../services/workflowWebhookSecurity'


import toposort from 'toposort'

function topologicalSort(
  nodes: { id: string }[],
  edges: { source: string; target: string }[]
): { id: string }[] {
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
    return sortedIds.map(id => nodeMap.get(id)).filter(Boolean) as { id: string }[]
  } catch (err: any) {
    if (err.message?.includes('cycle') || err.message?.includes('Cyclic')) {
      throw new Error('Workflow contains a cycle — cannot execute')
    }
    throw err
  }
}


function shouldSkipNode(
  nodeId: string,
  edges: { source: string; target: string; sourceHandle?: string | null }[],
  conditionResults: Map<string, boolean>,
  nodeOutputs: Map<string, any>
): boolean {
  const incomingEdges = edges.filter(e => e.target === nodeId)
  if (incomingEdges.length === 0) return false

  for (const edge of incomingEdges) {
    if (edge.sourceHandle === 'true' || edge.sourceHandle === 'false') {
      const conditionResult = conditionResults.get(edge.source)
      if (conditionResult === undefined) continue
      const requiredResult = edge.sourceHandle === 'true'
      if (conditionResult !== requiredResult) return true
    }
    if (edge.sourceHandle?.startsWith('branch-')) {
      const branchIndex = parseInt(edge.sourceHandle.replace('branch-', ''), 10)
      const switchOutput = nodeOutputs.get(edge.source)
      if (!switchOutput) continue
      if (switchOutput.matchedBranch !== branchIndex) return true
    }
  }
  return false
}


function interpolateTemplate(template: string, ctx: { orgId: string; triggeredBy: string; triggerData: Record<string, any> }): string {
  return template
    .replace(/\{\{orgId\}\}/g, ctx.orgId)
    .replace(/\{\{triggeredBy\}\}/g, ctx.triggeredBy)
    .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
    .replace(/\{\{provider\}\}/g, ctx.triggerData.provider || '')
    .replace(/\{\{created\}\}/g, String(ctx.triggerData.created || 0))
    .replace(/\{\{updated\}\}/g, String(ctx.triggerData.updated || 0))
}


function extractAssetIds(triggerData: Record<string, any>): string[] {
  if (triggerData.assetIds) return Array.isArray(triggerData.assetIds) ? triggerData.assetIds : [triggerData.assetIds]
  if (triggerData.assetId) return [triggerData.assetId]
  if (triggerData.hardwareId) return [triggerData.hardwareId]
  if (triggerData.created && Array.isArray(triggerData.created)) return triggerData.created
  return []
}


function mapOperator(op: string): string {
  const map: Record<string, string> = {
    'lt': 'lessThan', 'lte': 'lessThanInclusive',
    'gt': 'greaterThan', 'gte': 'greaterThanInclusive',
    'eq': 'equal', 'neq': 'notEqual',
    'in': 'in', 'contains': 'contains'
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


const ALLOWED_UPDATE_FIELDS: Record<string, string[]> = {
  hardware: ['notes', 'statusId', 'location', 'tags', 'customFields', 'name', 'serialNumber', 'warrantyExpiry', 'purchaseDate', 'purchaseCost'],
  license: ['notes', 'customFields', 'licenseName', 'seats', 'expirationDate'],
  consumable: ['notes', 'customFields', 'name', 'totalQuantity', 'minimumQuantity'],
  employee: ['department', 'title', 'notes', 'customFields', 'phone', 'location']
}


describe('Workflow Engine — Pure Logic', () => {
  describe('topologicalSort', () => {
    it('should sort a linear DAG in correct order', () => {
      const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
      const edges = [{ source: 'A', target: 'B' }, { source: 'B', target: 'C' }]
      const result = topologicalSort(nodes, edges)
      expect(result.map(n => n.id)).toEqual(['A', 'B', 'C'])
    })

    it('should handle a branching DAG', () => {
      const nodes = [{ id: 'trigger' }, { id: 'condition' }, { id: 'true-branch' }, { id: 'false-branch' }]
      const edges = [
        { source: 'trigger', target: 'condition' },
        { source: 'condition', target: 'true-branch' },
        { source: 'condition', target: 'false-branch' },
      ]
      const result = topologicalSort(nodes, edges)
      const ids = result.map(n => n.id)
      expect(ids.indexOf('trigger')).toBeLessThan(ids.indexOf('condition'))
      expect(ids.indexOf('condition')).toBeLessThan(ids.indexOf('true-branch'))
      expect(ids.indexOf('condition')).toBeLessThan(ids.indexOf('false-branch'))
    })

    it('should detect cycles and throw', () => {
      const nodes = [{ id: 'A' }, { id: 'B' }]
      const edges = [{ source: 'A', target: 'B' }, { source: 'B', target: 'A' }]
      expect(() => topologicalSort(nodes, edges)).toThrow('cycle')
    })

    it('should include disconnected nodes', () => {




      const nodes = [{ id: 'orphan' }]
      const result = topologicalSort(nodes, [])
      expect(result.map(n => n.id)).toContain('orphan')
    })

    it('should handle empty edges (return nodes as-is)', () => {
      const nodes = [{ id: 'X' }, { id: 'Y' }]
      const result = topologicalSort(nodes, [])
      expect(result).toEqual(nodes)
    })
  })

  describe('shouldSkipNode — condition branching', () => {
    it('should not skip node with no incoming edges', () => {
      expect(shouldSkipNode('A', [], new Map(), new Map())).toBe(false)
    })

    it('should skip true-branch when condition is false', () => {
      const edges = [{ source: 'cond', target: 'trueNode', sourceHandle: 'true' }]
      const conditions = new Map([['cond', false]])
      expect(shouldSkipNode('trueNode', edges, conditions, new Map())).toBe(true)
    })

    it('should NOT skip true-branch when condition is true', () => {
      const edges = [{ source: 'cond', target: 'trueNode', sourceHandle: 'true' }]
      const conditions = new Map([['cond', true]])
      expect(shouldSkipNode('trueNode', edges, conditions, new Map())).toBe(false)
    })

    it('should skip false-branch when condition is true', () => {
      const edges = [{ source: 'cond', target: 'falseNode', sourceHandle: 'false' }]
      const conditions = new Map([['cond', true]])
      expect(shouldSkipNode('falseNode', edges, conditions, new Map())).toBe(true)
    })

    it('should NOT skip false-branch when condition is false', () => {
      const edges = [{ source: 'cond', target: 'falseNode', sourceHandle: 'false' }]
      const conditions = new Map([['cond', false]])
      expect(shouldSkipNode('falseNode', edges, conditions, new Map())).toBe(false)
    })

    it('should skip wrong switch branch', () => {
      const edges = [{ source: 'switch', target: 'action', sourceHandle: 'branch-1' }]
      const outputs = new Map([['switch', { matchedBranch: 0 }]])
      expect(shouldSkipNode('action', edges, new Map(), outputs)).toBe(true)
    })

    it('should NOT skip correct switch branch', () => {
      const edges = [{ source: 'switch', target: 'action', sourceHandle: 'branch-2' }]
      const outputs = new Map([['switch', { matchedBranch: 2 }]])
      expect(shouldSkipNode('action', edges, new Map(), outputs)).toBe(false)
    })

    it('should not skip when upstream condition is undefined', () => {
      const edges = [{ source: 'cond', target: 'action', sourceHandle: 'true' }]
      const conditions = new Map<string, boolean>()
      expect(shouldSkipNode('action', edges, conditions, new Map())).toBe(false)
    })
  })

  describe('isExternalUrl — SSRF protection', () => {
    it('should allow public HTTPS URLs', () => {
      expect(isExternalUrl('https://api.example.com/webhook')).toBe(true)
    })

    it('should block public HTTP URLs', () => {
      expect(isExternalUrl('http://example.com/hook')).toBe(false)
    })

    it('should block localhost', () => {
      expect(isExternalUrl('http://localhost/evil')).toBe(false)
      expect(isExternalUrl('http://127.0.0.1/evil')).toBe(false)
    })

    it('should block IPv6 localhost', () => {
      const result = isExternalUrl('https://[::1]/')
      expect(result).toBe(false)
    })

    it('should block private 10.x.x.x range', () => {
      expect(isExternalUrl('http://10.0.0.1/internal')).toBe(false)
      expect(isExternalUrl('http://10.255.255.255/')).toBe(false)
    })

    it('should block private 172.16-31.x.x range', () => {
      expect(isExternalUrl('http://172.16.0.1/')).toBe(false)
      expect(isExternalUrl('http://172.31.255.255/')).toBe(false)
    })

    it('should block private 192.168.x.x range', () => {
      expect(isExternalUrl('http://192.168.1.1/')).toBe(false)
    })

    it('should block AWS metadata endpoint', () => {
      expect(isExternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    })

    it('should block GCP metadata endpoint', () => {
      expect(isExternalUrl('http://metadata.google.internal/computeMetadata/')).toBe(false)
    })

    it('should block FTP protocol', () => {
      expect(isExternalUrl('ftp://evil.com/file')).toBe(false)
    })

    it('should block invalid URLs', () => {
      expect(isExternalUrl('not-a-url')).toBe(false)
      expect(isExternalUrl('')).toBe(false)
    })
  })

  describe('interpolateTemplate', () => {
    const ctx = {
      orgId: 'org-123',
      triggeredBy: 'manual',
      triggerData: { provider: 'intune', created: 5, updated: 3 },
    }

    it('should replace {{orgId}}', () => {
      expect(interpolateTemplate('Org: {{orgId}}', ctx)).toBe('Org: org-123')
    })

    it('should replace {{triggeredBy}}', () => {
      expect(interpolateTemplate('Triggered: {{triggeredBy}}', ctx)).toBe('Triggered: manual')
    })

    it('should replace {{provider}}', () => {
      expect(interpolateTemplate('Provider: {{provider}}', ctx)).toBe('Provider: intune')
    })

    it('should replace {{created}} and {{updated}}', () => {
      expect(interpolateTemplate('Created: {{created}}, Updated: {{updated}}', ctx)).toBe('Created: 5, Updated: 3')
    })

    it('should handle missing trigger data gracefully', () => {
      const emptyCtx = { orgId: 'x', triggeredBy: 'event', triggerData: {} }
      expect(interpolateTemplate('Provider: {{provider}}', emptyCtx)).toBe('Provider: ')
    })

    it('should handle multiple occurrences', () => {
      expect(interpolateTemplate('{{orgId}}-{{orgId}}', ctx)).toBe('org-123-org-123')
    })
  })

  describe('extractAssetIds', () => {
    it('should extract from assetIds array', () => {
      expect(extractAssetIds({ assetIds: ['a', 'b'] })).toEqual(['a', 'b'])
    })

    it('should wrap single assetIds string', () => {
      expect(extractAssetIds({ assetIds: 'single-id' })).toEqual(['single-id'])
    })

    it('should extract from assetId', () => {
      expect(extractAssetIds({ assetId: 'x1' })).toEqual(['x1'])
    })

    it('should extract from hardwareId', () => {
      expect(extractAssetIds({ hardwareId: 'hw-1' })).toEqual(['hw-1'])
    })

    it('should extract from created array', () => {
      expect(extractAssetIds({ created: ['c1', 'c2'] })).toEqual(['c1', 'c2'])
    })

    it('should return empty for no asset references', () => {
      expect(extractAssetIds({ name: 'test' })).toEqual([])
    })
  })

  describe('mapOperator', () => {
    it('should map all standard operators', () => {
      expect(mapOperator('lt')).toBe('lessThan')
      expect(mapOperator('lte')).toBe('lessThanInclusive')
      expect(mapOperator('gt')).toBe('greaterThan')
      expect(mapOperator('gte')).toBe('greaterThanInclusive')
      expect(mapOperator('eq')).toBe('equal')
      expect(mapOperator('neq')).toBe('notEqual')
      expect(mapOperator('in')).toBe('in')
      expect(mapOperator('contains')).toBe('contains')
    })

    it('should pass through unknown operators', () => {
      expect(mapOperator('custom')).toBe('custom')
    })
  })

  describe('parseValue', () => {
    it('should parse numeric strings to numbers', () => {
      expect(parseValue('42')).toBe(42)
      expect(parseValue('3.14')).toBe(3.14)
      expect(parseValue('0')).toBe(0)
    })

    it('should parse boolean strings', () => {
      expect(parseValue('true')).toBe(true)
      expect(parseValue('false')).toBe(false)
    })

    it('should pass through non-parseable strings', () => {
      expect(parseValue('hello')).toBe('hello')
    })

    it('should pass through numbers', () => {
      expect(parseValue(42)).toBe(42)
    })

    it('should pass through null/undefined', () => {
      expect(parseValue(null)).toBe(null)
      expect(parseValue(undefined)).toBe(undefined)
    })
  })

  describe('ALLOWED_UPDATE_FIELDS — security allowlist', () => {
    it('should NOT allow orgId on any entity', () => {
      Object.values(ALLOWED_UPDATE_FIELDS).forEach(fields => {
        expect(fields).not.toContain('orgId')
      })
    })

    it('should NOT allow _id on any entity', () => {
      Object.values(ALLOWED_UPDATE_FIELDS).forEach(fields => {
        expect(fields).not.toContain('_id')
      })
    })

    it('should NOT allow role on employee', () => {
      expect(ALLOWED_UPDATE_FIELDS.employee).not.toContain('role')
    })

    it('should NOT allow hashedPassword on any entity', () => {
      Object.values(ALLOWED_UPDATE_FIELDS).forEach(fields => {
        expect(fields).not.toContain('hashedPassword')
        expect(fields).not.toContain('password')
      })
    })

    it('should NOT allow email on employee (prevents identity hijack)', () => {
      expect(ALLOWED_UPDATE_FIELDS.employee).not.toContain('email')
    })

    it('should allow notes on all entities', () => {
      Object.values(ALLOWED_UPDATE_FIELDS).forEach(fields => {
        expect(fields).toContain('notes')
      })
    })
  })
})
