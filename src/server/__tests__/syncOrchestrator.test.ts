import { describe, it, expect } from 'vitest'


interface SyncResult {
  provider: string
  created: number
  updated: number
  errors: string[]
  duration: number
}

interface OrchestratorResult {
  orgId: string
  timestamp: string
  results: SyncResult[]
  totalCreated: number
  totalUpdated: number
  totalErrors: number
  duration: number
}


function aggregateResults(orgId: string, results: SyncResult[], duration: number): OrchestratorResult {
  return {
    orgId,
    timestamp: new Date().toISOString(),
    results,
    totalCreated: results.reduce((s, r) => s + r.created, 0),
    totalUpdated: results.reduce((s, r) => s + r.updated, 0),
    totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
    duration
  }
}

const mdmProviders = ['kandji', 'intune', 'autopilot', 'jamfPro', 'jamfSchool', 'mosyle']
const hrProviders = ['personio', 'bamboohr', 'googleWorkspace', 'hibob']

function classifyProvider(provider: string): 'mdm' | 'hr' | 'unknown' {
  if (mdmProviders.includes(provider)) return 'mdm'
  if (hrProviders.includes(provider)) return 'hr'
  return 'unknown'
}

function getWorkflowEvent(provider: string): string | null {
  const type = classifyProvider(provider)
  if (type === 'mdm') return 'hardware.synced'
  if (type === 'hr') return 'employee.synced'
  return null
}


describe('Sync Orchestrator — Pure Logic', () => {
  describe('Result aggregation', () => {
    it('should sum created counts', () => {
      const results: SyncResult[] = [
        { provider: 'kandji', created: 5, updated: 2, errors: [], duration: 100 },
        { provider: 'personio', created: 3, updated: 1, errors: [], duration: 200 },
      ]
      const agg = aggregateResults('org-1', results, 300)
      expect(agg.totalCreated).toBe(8)
    })

    it('should sum updated counts', () => {
      const results: SyncResult[] = [
        { provider: 'intune', created: 0, updated: 10, errors: [], duration: 150 },
        { provider: 'bamboohr', created: 1, updated: 5, errors: [], duration: 250 },
      ]
      const agg = aggregateResults('org-1', results, 400)
      expect(agg.totalUpdated).toBe(15)
    })

    it('should count total errors across providers', () => {
      const results: SyncResult[] = [
        { provider: 'kandji', created: 0, updated: 0, errors: ['timeout', 'auth failed'], duration: 50 },
        { provider: 'personio', created: 5, updated: 0, errors: ['rate limit'], duration: 100 },
      ]
      const agg = aggregateResults('org-1', results, 150)
      expect(agg.totalErrors).toBe(3)
    })

    it('should handle empty results array', () => {
      const agg = aggregateResults('org-1', [], 0)
      expect(agg.totalCreated).toBe(0)
      expect(agg.totalUpdated).toBe(0)
      expect(agg.totalErrors).toBe(0)
      expect(agg.results).toHaveLength(0)
    })

    it('should include timestamp', () => {
      const agg = aggregateResults('org-1', [], 0)
      expect(agg.timestamp).toBeTruthy()
      expect(new Date(agg.timestamp).getTime()).not.toBeNaN()
    })
  })

  describe('Provider classification', () => {
    it('should classify MDM providers correctly', () => {
      expect(classifyProvider('kandji')).toBe('mdm')
      expect(classifyProvider('intune')).toBe('mdm')
      expect(classifyProvider('autopilot')).toBe('mdm')
      expect(classifyProvider('jamfPro')).toBe('mdm')
      expect(classifyProvider('jamfSchool')).toBe('mdm')
      expect(classifyProvider('mosyle')).toBe('mdm')
    })

    it('should classify HR providers correctly', () => {
      expect(classifyProvider('personio')).toBe('hr')
      expect(classifyProvider('bamboohr')).toBe('hr')
      expect(classifyProvider('googleWorkspace')).toBe('hr')
      expect(classifyProvider('hibob')).toBe('hr')
    })

    it('should return unknown for unrecognized providers', () => {
      expect(classifyProvider('slack')).toBe('unknown')
      expect(classifyProvider('random')).toBe('unknown')
    })
  })

  describe('Workflow event routing', () => {
    it('MDM providers should emit hardware.synced', () => {
      expect(getWorkflowEvent('kandji')).toBe('hardware.synced')
      expect(getWorkflowEvent('intune')).toBe('hardware.synced')
      expect(getWorkflowEvent('mosyle')).toBe('hardware.synced')
    })

    it('HR providers should emit employee.synced', () => {
      expect(getWorkflowEvent('personio')).toBe('employee.synced')
      expect(getWorkflowEvent('bamboohr')).toBe('employee.synced')
      expect(getWorkflowEvent('googleWorkspace')).toBe('employee.synced')
    })

    it('unknown providers should return null (no event)', () => {
      expect(getWorkflowEvent('slack')).toBeNull()
    })
  })

  describe('Provider coverage (all 10 supported)', () => {
    const allProviders = [...mdmProviders, ...hrProviders]

    it('should have 6 MDM providers', () => {
      expect(mdmProviders).toHaveLength(6)
    })

    it('should have 4 HR providers', () => {
      expect(hrProviders).toHaveLength(4)
    })

    it('should have 10 total integrations', () => {
      expect(allProviders).toHaveLength(10)
    })

    it('should have no duplicates', () => {
      const unique = new Set(allProviders)
      expect(unique.size).toBe(allProviders.length)
    })
  })
})
