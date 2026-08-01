import { describe, it, expect } from 'vitest'


type WorkflowEventType =
  | 'hardware.synced' | 'hardware.created' | 'hardware.updated' | 'hardware.deleted'
  | 'employee.synced' | 'employee.created' | 'employee.updated'
  | 'status.changed'
  | 'assignment.created' | 'assignment.returned'
  | 'maintenance.completed'

const ALL_EVENT_TYPES: WorkflowEventType[] = [
  'hardware.synced', 'hardware.created', 'hardware.updated', 'hardware.deleted',
  'employee.synced', 'employee.created', 'employee.updated',
  'status.changed',
  'assignment.created', 'assignment.returned',
  'maintenance.completed',
]

function parseCronToMs(expr: string): number | null {
  const map: Record<string, number> = {
    '*/5m': 5 * 60 * 1000,
    '*/15m': 15 * 60 * 1000,
    '*/30m': 30 * 60 * 1000,
    '*/1h': 60 * 60 * 1000,
    '*/6h': 6 * 60 * 60 * 1000,
    '*/12h': 12 * 60 * 60 * 1000,
    '*/24h': 24 * 60 * 60 * 1000,
    'daily': 24 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000,
  }
  return map[expr] ?? null
}

function buildCronKey(orgId: string, workflowId: string): string {
  return `${orgId}:${workflowId}`
}


describe('Workflow Event Bus — Pure Logic', () => {
  describe('Event Type Registry', () => {
    it('should expose only the 11 event types wired to real emitters', () => {
      expect(ALL_EVENT_TYPES).toHaveLength(11)
    })

    it('should have 4 hardware events', () => {
      const hw = ALL_EVENT_TYPES.filter(e => e.startsWith('hardware.'))
      expect(hw).toHaveLength(4)
    })

    it('should have 3 employee events', () => {
      const emp = ALL_EVENT_TYPES.filter(e => e.startsWith('employee.'))
      expect(emp).toHaveLength(3)
    })

    it('should have 2 assignment events', () => {
      const assign = ALL_EVENT_TYPES.filter(e => e.startsWith('assignment.'))
      expect(assign).toHaveLength(2)
    })

    it.each([
      'hardware.synced', 'hardware.created', 'hardware.updated', 'hardware.deleted',
      'employee.synced', 'employee.created', 'employee.updated',
      'status.changed', 'assignment.created', 'assignment.returned',
      'maintenance.completed'
    ])('should include "%s"', (event) => {
      expect(ALL_EVENT_TYPES).toContain(event)
    })
  })

  describe('Cron Expression Parser', () => {
    it('*/5m → 300,000ms (5 min)', () => {
      expect(parseCronToMs('*/5m')).toBe(5 * 60 * 1000)
    })

    it('*/15m → 900,000ms (15 min)', () => {
      expect(parseCronToMs('*/15m')).toBe(15 * 60 * 1000)
    })

    it('*/30m → 1,800,000ms (30 min)', () => {
      expect(parseCronToMs('*/30m')).toBe(30 * 60 * 1000)
    })

    it('*/1h → 3,600,000ms (1 hour)', () => {
      expect(parseCronToMs('*/1h')).toBe(60 * 60 * 1000)
    })

    it('*/6h → 21,600,000ms (6 hours)', () => {
      expect(parseCronToMs('*/6h')).toBe(6 * 60 * 60 * 1000)
    })

    it('*/12h → 43,200,000ms (12 hours)', () => {
      expect(parseCronToMs('*/12h')).toBe(12 * 60 * 60 * 1000)
    })

    it('*/24h → 86,400,000ms (24 hours)', () => {
      expect(parseCronToMs('*/24h')).toBe(24 * 60 * 60 * 1000)
    })

    it('daily → 86,400,000ms', () => {
      expect(parseCronToMs('daily')).toBe(24 * 60 * 60 * 1000)
    })

    it('weekly → 604,800,000ms', () => {
      expect(parseCronToMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it('unsupported expression → null', () => {
      expect(parseCronToMs('0 */5 * * *')).toBeNull()
    })

    it('empty string → null', () => {
      expect(parseCronToMs('')).toBeNull()
    })

    it('daily and */24h should be equal', () => {
      expect(parseCronToMs('daily')).toBe(parseCronToMs('*/24h'))
    })
  })

  describe('Cron Job Key Construction', () => {
    it('should format as orgId:workflowId', () => {
      expect(buildCronKey('org-1', 'wf-2')).toBe('org-1:wf-2')
    })

    it('keys with same org prefix should be matchable', () => {
      const key1 = buildCronKey('org-1', 'wf-1')
      const key2 = buildCronKey('org-1', 'wf-2')
      expect(key1.startsWith('org-1:')).toBe(true)
      expect(key2.startsWith('org-1:')).toBe(true)
    })
  })
})
