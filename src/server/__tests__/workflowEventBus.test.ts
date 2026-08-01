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
  'maintenance.completed'
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
    'weekly': 7 * 24 * 60 * 60 * 1000
  }
  return map[expr] ?? null
}


describe('Workflow Event Bus — Pure Logic', () => {
  describe('Cron Parsing', () => {
    it.each([
      ['*/5m', 300_000],
      ['*/15m', 900_000],
      ['*/30m', 1_800_000],
      ['*/1h', 3_600_000],
      ['*/6h', 21_600_000],
      ['*/12h', 43_200_000],
      ['*/24h', 86_400_000],
      ['daily', 86_400_000],
      ['weekly', 604_800_000],
    ])('should parse "%s" to %d ms', (expr, expectedMs) => {
      expect(parseCronToMs(expr)).toBe(expectedMs)
    })

    it('should return null for unsupported cron expressions', () => {
      expect(parseCronToMs('0 0 * * *')).toBeNull()
      expect(parseCronToMs('*/2m')).toBeNull()
      expect(parseCronToMs('hourly')).toBeNull()
      expect(parseCronToMs('')).toBeNull()
      expect(parseCronToMs('random')).toBeNull()
    })

    it('*/5m should be exactly 5 minutes', () => {
      expect(parseCronToMs('*/5m')).toBe(5 * 60 * 1000)
    })

    it('daily and */24h should be equal', () => {
      expect(parseCronToMs('daily')).toBe(parseCronToMs('*/24h'))
    })

    it('weekly should be 7 days', () => {
      expect(parseCronToMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000)
    })
  })

  describe('Event Types', () => {
    it('should expose only the 11 event types wired to real emitters', () => {
      expect(ALL_EVENT_TYPES).toHaveLength(11)
    })

    it('should include all hardware events', () => {
      const hwEvents = ALL_EVENT_TYPES.filter(e => e.startsWith('hardware.'))
      expect(hwEvents).toHaveLength(4)
      expect(hwEvents).toContain('hardware.synced')
      expect(hwEvents).toContain('hardware.created')
      expect(hwEvents).toContain('hardware.updated')
      expect(hwEvents).toContain('hardware.deleted')
    })

    it('should include all employee events', () => {
      const empEvents = ALL_EVENT_TYPES.filter(e => e.startsWith('employee.'))
      expect(empEvents).toHaveLength(3)
      expect(empEvents).toContain('employee.synced')
      expect(empEvents).toContain('employee.created')
      expect(empEvents).toContain('employee.updated')
    })

    it('should include assignment events', () => {
      expect(ALL_EVENT_TYPES).toContain('assignment.created')
      expect(ALL_EVENT_TYPES).toContain('assignment.returned')
    })

    it('should include infrastructure events', () => {
      expect(ALL_EVENT_TYPES).toContain('status.changed')
      expect(ALL_EVENT_TYPES).toContain('maintenance.completed')
      expect(ALL_EVENT_TYPES).not.toContain('license.expired')
      expect(ALL_EVENT_TYPES).not.toContain('lowStock.alert')
    })

    it('should have no duplicates', () => {
      const unique = new Set(ALL_EVENT_TYPES)
      expect(unique.size).toBe(ALL_EVENT_TYPES.length)
    })
  })
})
