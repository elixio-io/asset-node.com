import { describe, it, expect } from 'vitest'


const MAINTENANCE_TYPES = ['repair', 'preventive', 'upgrade', 'inspection', 'cleaning'] as const
const MAINTENANCE_STATUSES = ['scheduled', 'inProgress', 'completed', 'cancelled'] as const

const STATUS_TRANSITIONS: Record<string, string[]> = {
  'scheduled': ['inProgress', 'cancelled'],
  'inProgress': ['completed', 'cancelled'],
  'completed': [],
  'cancelled': [],
}

function isValidTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

function maintenanceDurationDays(startDate: Date, completionDate: Date | null | undefined): number | null {
  if (!completionDate) return null
  const diff = new Date(completionDate).getTime() - new Date(startDate).getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function isOverdue(status: string, startDate: Date, maxDays: number): boolean {
  if (status === 'completed' || status === 'cancelled') return false
  const elapsed = Date.now() - new Date(startDate).getTime()
  const elapsedDays = elapsed / (1000 * 60 * 60 * 24)
  return elapsedDays > maxDays
}


describe('MaintenanceRecord Model — Types & Lifecycle', () => {
  describe('Maintenance Type Enum', () => {
    it('should have 5 types', () => {
      expect(MAINTENANCE_TYPES).toHaveLength(5)
    })

    it.each(['repair', 'preventive', 'upgrade', 'inspection', 'cleaning'] as const)(
      '"%s" should be valid', (type) => {
        expect(MAINTENANCE_TYPES).toContain(type)
      }
    )
  })

  describe('Maintenance Status Enum', () => {
    it('should have 4 statuses', () => {
      expect(MAINTENANCE_STATUSES).toHaveLength(4)
    })

    it.each(['scheduled', 'inProgress', 'completed', 'cancelled'] as const)(
      '"%s" should be valid', (status) => {
        expect(MAINTENANCE_STATUSES).toContain(status)
      }
    )
  })

  describe('Status Transitions', () => {
    it('scheduled → inProgress ✓', () => {
      expect(isValidTransition('scheduled', 'inProgress')).toBe(true)
    })

    it('scheduled → cancelled ✓', () => {
      expect(isValidTransition('scheduled', 'cancelled')).toBe(true)
    })

    it('inProgress → completed ✓', () => {
      expect(isValidTransition('inProgress', 'completed')).toBe(true)
    })

    it('inProgress → cancelled ✓', () => {
      expect(isValidTransition('inProgress', 'cancelled')).toBe(true)
    })

    it('completed → any ✗ (terminal)', () => {
      expect(isValidTransition('completed', 'scheduled')).toBe(false)
      expect(isValidTransition('completed', 'inProgress')).toBe(false)
    })

    it('cancelled → any ✗ (terminal)', () => {
      expect(isValidTransition('cancelled', 'scheduled')).toBe(false)
      expect(isValidTransition('cancelled', 'inProgress')).toBe(false)
    })

    it('scheduled → completed ✗ (must go through inProgress)', () => {
      expect(isValidTransition('scheduled', 'completed')).toBe(false)
    })
  })

  describe('Duration Calculation', () => {
    it('same day → 0 or 1 day', () => {
      const start = new Date('2026-04-01')
      const end = new Date('2026-04-01')
      expect(maintenanceDurationDays(start, end)).toBe(0)
    })

    it('3 days apart → 3', () => {
      const start = new Date('2026-04-01')
      const end = new Date('2026-04-04')
      expect(maintenanceDurationDays(start, end)).toBe(3)
    })

    it('30 days apart → 30', () => {
      const start = new Date('2026-04-01')
      const end = new Date('2026-05-01')
      expect(maintenanceDurationDays(start, end)).toBe(30)
    })

    it('no completion date → null', () => {
      expect(maintenanceDurationDays(new Date(), null)).toBeNull()
    })

    it('undefined completion → null', () => {
      expect(maintenanceDurationDays(new Date(), undefined)).toBeNull()
    })
  })

  describe('Overdue Detection', () => {
    it('completed maintenance → never overdue', () => {
      const pastDate = new Date('2020-01-01')
      expect(isOverdue('completed', pastDate, 1)).toBe(false)
    })

    it('cancelled maintenance → never overdue', () => {
      const pastDate = new Date('2020-01-01')
      expect(isOverdue('cancelled', pastDate, 1)).toBe(false)
    })

    it('scheduled, started long ago with short max → overdue', () => {
      const pastDate = new Date('2020-01-01')
      expect(isOverdue('scheduled', pastDate, 30)).toBe(true)
    })

    it('inProgress, started recently → not overdue', () => {
      const recentDate = new Date()
      expect(isOverdue('inProgress', recentDate, 30)).toBe(false)
    })
  })
})
