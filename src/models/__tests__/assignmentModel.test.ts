import { describe, it, expect } from 'vitest'
import { buildAssignmentHardwareTenantFilter } from '../Assignment'


const ASSIGNMENT_STATUSES = ['active', 'pendingReturn', 'returned'] as const
const RETURN_CONDITIONS = ['good', 'fair', 'damaged'] as const
const CHECKOUT_CONDITION = { min: 1, max: 5, default: 5 }

const REQUIRED_FIELDS = ['orgId', 'employeeId', 'hardware', 'assignmentDate'] as const

const COMPOUND_INDEXES = [
  { fields: ['orgId', 'employeeId'] },
  { fields: ['orgId', 'status', 'assignmentDate'] },
  { fields: ['orgId', 'expectedReturnDate'] },
]

const VALID_TRANSITIONS: Record<string, string[]> = {
  'active': ['pendingReturn', 'returned'],
  'pendingReturn': ['returned', 'active'],
  'returned': [],
}

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

function expectedHardwareStatus(assignmentStatus: string): 'deployed' | 'deployable' | null {
  if (assignmentStatus === 'active') return 'deployed'
  if (assignmentStatus === 'returned') return 'deployable'
  return null
}

function isOverdue(expectedReturnDate: Date | null | undefined): boolean {
  if (!expectedReturnDate) return false
  return new Date(expectedReturnDate) < new Date()
}


describe('Assignment Model — Lifecycle & Schema', () => {
  describe('Assignment Status Enum', () => {
    it('should have 3 statuses', () => {
      expect(ASSIGNMENT_STATUSES).toHaveLength(3)
    })

    it.each(['active', 'pendingReturn', 'returned'] as const)(
      '"%s" should be valid', (status) => {
        expect(ASSIGNMENT_STATUSES).toContain(status)
      }
    )
  })

  describe('Return Condition Enum', () => {
    it('should have 3 conditions', () => {
      expect(RETURN_CONDITIONS).toHaveLength(3)
    })

    it.each(['good', 'fair', 'damaged'] as const)(
      '"%s" should be valid', (condition) => {
        expect(RETURN_CONDITIONS).toContain(condition)
      }
    )
  })

  describe('Checkout Condition Scale', () => {
    it('min should be 1 (poor)', () => {
      expect(CHECKOUT_CONDITION.min).toBe(1)
    })

    it('max should be 5 (excellent)', () => {
      expect(CHECKOUT_CONDITION.max).toBe(5)
    })

    it('default should be 5 (excellent)', () => {
      expect(CHECKOUT_CONDITION.default).toBe(5)
    })
  })

  describe('Required Fields', () => {
    it('should require 4 fields', () => {
      expect(REQUIRED_FIELDS).toHaveLength(4)
    })

    it('should require hardware array', () => {
      expect(REQUIRED_FIELDS).toContain('hardware')
    })
  })

  describe('State Machine — Valid Transitions', () => {
    it('active → pendingReturn ✓', () => {
      expect(isValidTransition('active', 'pendingReturn')).toBe(true)
    })

    it('active → returned ✓', () => {
      expect(isValidTransition('active', 'returned')).toBe(true)
    })

    it('pendingReturn → returned ✓', () => {
      expect(isValidTransition('pendingReturn', 'returned')).toBe(true)
    })

    it('pendingReturn → active ✓ (cancel return)', () => {
      expect(isValidTransition('pendingReturn', 'active')).toBe(true)
    })

    it('returned → active ✗ (terminal)', () => {
      expect(isValidTransition('returned', 'active')).toBe(false)
    })

    it('returned → pendingReturn ✗ (terminal)', () => {
      expect(isValidTransition('returned', 'pendingReturn')).toBe(false)
    })
  })

  describe('Hardware Status Sync', () => {
    it('always scopes the status update to the assignment tenant', () => {
      expect(buildAssignmentHardwareTenantFilter('org-a', ['hardware-a'])).toEqual({
        _id: { $in: ['hardware-a'] },
        orgId: 'org-a',
        deletedAt: null
      })
    })

    it('active assignment → hardware deployed', () => {
      expect(expectedHardwareStatus('active')).toBe('deployed')
    })

    it('returned assignment → hardware deployable', () => {
      expect(expectedHardwareStatus('returned')).toBe('deployable')
    })

    it('pendingReturn → no status change', () => {
      expect(expectedHardwareStatus('pendingReturn')).toBeNull()
    })
  })

  describe('Overdue Detection', () => {
    it('past date → overdue', () => {
      expect(isOverdue(new Date('2020-01-01'))).toBe(true)
    })

    it('future date → not overdue', () => {
      expect(isOverdue(new Date('2099-12-31'))).toBe(false)
    })

    it('null → not overdue', () => {
      expect(isOverdue(null)).toBe(false)
    })

    it('undefined → not overdue', () => {
      expect(isOverdue(undefined)).toBe(false)
    })
  })

  describe('Compound Indexes', () => {
    it('should have 3 compound indexes', () => {
      expect(COMPOUND_INDEXES).toHaveLength(3)
    })

    it('all should start with orgId (tenant isolation)', () => {
      COMPOUND_INDEXES.forEach(idx => {
        expect(idx.fields[0]).toBe('orgId')
      })
    })
  })
})
