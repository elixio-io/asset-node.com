import { describe, it, expect } from 'vitest'


interface SyncResult {
  provider: string
  created: number
  updated: number
  errors: string[]
  duration: number
}

const MDM_PROVIDERS = ['kandji', 'intune', 'autopilot', 'jamfPro', 'jamfSchool', 'mosyle']
const HR_PROVIDERS = ['personio', 'bamboohr', 'googleWorkspace', 'hibob']

function aggregateResults(results: SyncResult[]) {
  return {
    totalCreated: results.reduce((s, r) => s + r.created, 0),
    totalUpdated: results.reduce((s, r) => s + r.updated, 0),
    totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
  }
}

function classifyProvider(provider: string): 'mdm' | 'hr' | 'unknown' {
  if (MDM_PROVIDERS.includes(provider)) return 'mdm'
  if (HR_PROVIDERS.includes(provider)) return 'hr'
  return 'unknown'
}

function determineWorkflowEvent(provider: string): string | null {
  if (MDM_PROVIDERS.includes(provider)) return 'hardware.synced'
  if (HR_PROVIDERS.includes(provider)) return 'employee.synced'
  return null
}

function buildErrorResult(provider: string, errorMessage: string): SyncResult {
  return { provider, created: 0, updated: 0, errors: [errorMessage], duration: 0 }
}


describe('Sync Orchestrator — Pure Logic', () => {
  describe('Provider Classification', () => {
    it.each([
      ['kandji', 'mdm'], ['intune', 'mdm'], ['autopilot', 'mdm'],
      ['jamfPro', 'mdm'], ['jamfSchool', 'mdm'], ['mosyle', 'mdm'],
    ])('%s → %s', (provider, expected) => {
      expect(classifyProvider(provider)).toBe(expected)
    })

    it.each([
      ['personio', 'hr'], ['bamboohr', 'hr'],
      ['googleWorkspace', 'hr'], ['hibob', 'hr'],
    ])('%s → %s', (provider, expected) => {
      expect(classifyProvider(provider)).toBe(expected)
    })

    it('unknown provider → "unknown"', () => {
      expect(classifyProvider('random-provider')).toBe('unknown')
    })
  })

  describe('Provider Registry', () => {
    it('should have 6 MDM providers', () => {
      expect(MDM_PROVIDERS).toHaveLength(6)
    })

    it('should have 4 HR providers', () => {
      expect(HR_PROVIDERS).toHaveLength(4)
    })

    it('MDM and HR should not overlap', () => {
      const overlap = MDM_PROVIDERS.filter(p => HR_PROVIDERS.includes(p))
      expect(overlap).toHaveLength(0)
    })
  })

  describe('Result Aggregation', () => {
    it('should sum created across all results', () => {
      const results: SyncResult[] = [
        { provider: 'kandji', created: 5, updated: 3, errors: [], duration: 100 },
        { provider: 'personio', created: 10, updated: 7, errors: [], duration: 200 },
      ]
      expect(aggregateResults(results).totalCreated).toBe(15)
    })

    it('should sum updated across all results', () => {
      const results: SyncResult[] = [
        { provider: 'intune', created: 0, updated: 12, errors: [], duration: 50 },
        { provider: 'bamboohr', created: 0, updated: 8, errors: [], duration: 75 },
      ]
      expect(aggregateResults(results).totalUpdated).toBe(20)
    })

    it('should count total errors', () => {
      const results: SyncResult[] = [
        { provider: 'jamfPro', created: 0, updated: 0, errors: ['Auth failed'], duration: 0 },
        { provider: 'mosyle', created: 0, updated: 0, errors: ['Timeout', 'Rate limited'], duration: 0 },
      ]
      expect(aggregateResults(results).totalErrors).toBe(3)
    })

    it('empty results → all zeros', () => {
      expect(aggregateResults([])).toEqual({ totalCreated: 0, totalUpdated: 0, totalErrors: 0 })
    })
  })

  describe('Workflow Event Routing', () => {
    it('MDM providers → hardware.synced', () => {
      MDM_PROVIDERS.forEach(p => {
        expect(determineWorkflowEvent(p)).toBe('hardware.synced')
      })
    })

    it('HR providers → employee.synced', () => {
      HR_PROVIDERS.forEach(p => {
        expect(determineWorkflowEvent(p)).toBe('employee.synced')
      })
    })

    it('unknown provider → null', () => {
      expect(determineWorkflowEvent('unknown')).toBeNull()
    })
  })

  describe('Error Result Builder', () => {
    it('should produce a well-formed error result', () => {
      const result = buildErrorResult('kandji', 'Authentication failed')
      expect(result.provider).toBe('kandji')
      expect(result.created).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.errors).toEqual(['Authentication failed'])
      expect(result.duration).toBe(0)
    })
  })
})
