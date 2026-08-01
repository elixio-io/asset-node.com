import { describe, it, expect } from 'vitest'


type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'

const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

function isPlanAtLeast(current: PlanKey, target: PlanKey): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(target)
}

function isAtLimit(current: number, limit: number): boolean {
  if (limit === -1) return false
  return current >= limit
}

function usagePercent(current: number, limit: number): number {
  if (limit === -1) return 0
  if (limit === 0) return 100
  return Math.min(100, Math.round((current / limit) * 100))
}


describe('Billing Store — Pure Logic', () => {
  describe('isPlanAtLeast', () => {
    it('free is at least free', () => {
      expect(isPlanAtLeast('free', 'free')).toBe(true)
    })

    it('free is NOT at least starter', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
    })

    it('starter is at least starter', () => {
      expect(isPlanAtLeast('starter', 'starter')).toBe(true)
    })

    it('starter is at least free', () => {
      expect(isPlanAtLeast('starter', 'free')).toBe(true)
    })

    it('pro is at least starter', () => {
      expect(isPlanAtLeast('pro', 'starter')).toBe(true)
    })

    it('pro is NOT at least enterprise', () => {
      expect(isPlanAtLeast('pro', 'enterprise')).toBe(false)
    })

    it('enterprise is at least everything', () => {
      PLAN_ORDER.forEach(plan => {
        expect(isPlanAtLeast('enterprise', plan)).toBe(true)
      })
    })

    it('free is at least nothing above free', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
      expect(isPlanAtLeast('free', 'pro')).toBe(false)
      expect(isPlanAtLeast('free', 'enterprise')).toBe(false)
    })
  })

  describe('isAtLimit', () => {
    it('0/50 is not at limit', () => {
      expect(isAtLimit(0, 50)).toBe(false)
    })

    it('49/50 is not at limit', () => {
      expect(isAtLimit(49, 50)).toBe(false)
    })

    it('50/50 IS at limit', () => {
      expect(isAtLimit(50, 50)).toBe(true)
    })

    it('51/50 IS at limit (over)', () => {
      expect(isAtLimit(51, 50)).toBe(true)
    })

    it('unlimited (-1) is never at limit', () => {
      expect(isAtLimit(999999, -1)).toBe(false)
    })

    it('0/0 IS at limit (zero limit)', () => {
      expect(isAtLimit(0, 0)).toBe(true)
    })
  })

  describe('usagePercent', () => {
    it('0/50 = 0%', () => {
      expect(usagePercent(0, 50)).toBe(0)
    })

    it('25/50 = 50%', () => {
      expect(usagePercent(25, 50)).toBe(50)
    })

    it('50/50 = 100%', () => {
      expect(usagePercent(50, 50)).toBe(100)
    })

    it('capped at 100% when over limit', () => {
      expect(usagePercent(75, 50)).toBe(100)
    })

    it('unlimited (-1) = 0% (never shows as full)', () => {
      expect(usagePercent(999, -1)).toBe(0)
    })

    it('0 limit = 100% (can never add anything)', () => {
      expect(usagePercent(0, 0)).toBe(100)
    })

    it('1/3 = 33% (rounds correctly)', () => {
      expect(usagePercent(1, 3)).toBe(33)
    })

    it('2/3 = 67% (rounds correctly)', () => {
      expect(usagePercent(2, 3)).toBe(67)
    })
  })
})
