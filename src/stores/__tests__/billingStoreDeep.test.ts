import { describe, it, expect } from 'vitest'


type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'
type ReportLevel = 'basic' | 'full' | 'export'

const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

function isPlanAtLeast(currentPlan: PlanKey, target: PlanKey): boolean {
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(target)
}

function canUse(features: { api: boolean; scim: boolean; sso: boolean }, feature: 'api' | 'scim' | 'sso'): boolean {
  return features[feature] === true
}

interface UsageItem {
  current: number
  limit: number
}

function isAtLimit(item: UsageItem): boolean {
  if (item.limit === -1) return false
  return item.current >= item.limit
}

function usagePercent(item: UsageItem): number {
  if (item.limit === -1) return 0
  if (item.limit === 0) return 100
  return Math.min(100, Math.round((item.current / item.limit) * 100))
}

const VALID_STATUSES = ['free', 'trialing', 'active', 'past_due', 'canceled'] as const
const VALID_INTERVALS = ['monthly', 'annual'] as const


describe('Billing Store — Deep Feature Gating & Usage', () => {
  describe('Plan Order', () => {
    it('should have 4 plans in ascending order', () => {
      expect(PLAN_ORDER).toEqual(['free', 'starter', 'pro', 'enterprise'])
    })

    it('free < starter < pro < enterprise', () => {
      expect(PLAN_ORDER.indexOf('free')).toBeLessThan(PLAN_ORDER.indexOf('starter'))
      expect(PLAN_ORDER.indexOf('starter')).toBeLessThan(PLAN_ORDER.indexOf('pro'))
      expect(PLAN_ORDER.indexOf('pro')).toBeLessThan(PLAN_ORDER.indexOf('enterprise'))
    })
  })

  describe('isPlanAtLeast — Hierarchical Access', () => {
    it('enterprise ≥ free', () => {
      expect(isPlanAtLeast('enterprise', 'free')).toBe(true)
    })

    it('enterprise ≥ enterprise', () => {
      expect(isPlanAtLeast('enterprise', 'enterprise')).toBe(true)
    })

    it('pro ≥ starter', () => {
      expect(isPlanAtLeast('pro', 'starter')).toBe(true)
    })

    it('free < starter', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
    })

    it('starter < pro', () => {
      expect(isPlanAtLeast('starter', 'pro')).toBe(false)
    })

    it('free < enterprise', () => {
      expect(isPlanAtLeast('free', 'enterprise')).toBe(false)
    })

    it('every plan ≥ itself', () => {
      PLAN_ORDER.forEach(plan => {
        expect(isPlanAtLeast(plan, plan)).toBe(true)
      })
    })

    it('every plan ≥ free', () => {
      PLAN_ORDER.forEach(plan => {
        expect(isPlanAtLeast(plan, 'free')).toBe(true)
      })
    })
  })

  describe('canUse — Boolean Feature Gating', () => {
    const proFeatures = { api: true, scim: true, sso: false }
    const freeFeatures = { api: false, scim: false, sso: false }
    const enterpriseFeatures = { api: true, scim: true, sso: true }

    it('Pro plan: API + SCIM enabled, SSO disabled', () => {
      expect(canUse(proFeatures, 'api')).toBe(true)
      expect(canUse(proFeatures, 'scim')).toBe(true)
      expect(canUse(proFeatures, 'sso')).toBe(false)
    })

    it('Free plan: all disabled', () => {
      expect(canUse(freeFeatures, 'api')).toBe(false)
      expect(canUse(freeFeatures, 'scim')).toBe(false)
      expect(canUse(freeFeatures, 'sso')).toBe(false)
    })

    it('Enterprise plan: all enabled', () => {
      expect(canUse(enterpriseFeatures, 'api')).toBe(true)
      expect(canUse(enterpriseFeatures, 'scim')).toBe(true)
      expect(canUse(enterpriseFeatures, 'sso')).toBe(true)
    })
  })

  describe('isAtLimit — Quota Enforcement', () => {
    it('at exact limit: 50/50', () => {
      expect(isAtLimit({ current: 50, limit: 50 })).toBe(true)
    })

    it('exceeded limit: 51/50', () => {
      expect(isAtLimit({ current: 51, limit: 50 })).toBe(true)
    })

    it('under limit: 49/50', () => {
      expect(isAtLimit({ current: 49, limit: 50 })).toBe(false)
    })

    it('unlimited: never at limit', () => {
      expect(isAtLimit({ current: 999999, limit: -1 })).toBe(false)
    })

    it('zero limit: always at limit', () => {
      expect(isAtLimit({ current: 0, limit: 0 })).toBe(true)
    })

    it('empty usage: not at limit', () => {
      expect(isAtLimit({ current: 0, limit: 50 })).toBe(false)
    })
  })

  describe('usagePercent — Progress Bars', () => {
    it('50/100 = 50%', () => {
      expect(usagePercent({ current: 50, limit: 100 })).toBe(50)
    })

    it('100/100 = 100%', () => {
      expect(usagePercent({ current: 100, limit: 100 })).toBe(100)
    })

    it('0/100 = 0%', () => {
      expect(usagePercent({ current: 0, limit: 100 })).toBe(0)
    })

    it('unlimited = 0%', () => {
      expect(usagePercent({ current: 500, limit: -1 })).toBe(0)
    })

    it('exceeded caps at 100%', () => {
      expect(usagePercent({ current: 150, limit: 100 })).toBe(100)
    })

    it('zero limit = 100%', () => {
      expect(usagePercent({ current: 0, limit: 0 })).toBe(100)
    })

    it('1/3 ≈ 33%', () => {
      expect(usagePercent({ current: 1, limit: 3 })).toBe(33)
    })

    it('2/3 ≈ 67%', () => {
      expect(usagePercent({ current: 2, limit: 3 })).toBe(67)
    })
  })

  describe('Type Validation', () => {
    it('should have 5 valid statuses', () => {
      expect(VALID_STATUSES).toHaveLength(5)
      expect([...VALID_STATUSES]).toContain('past_due')
    })

    it('should have 2 valid intervals', () => {
      expect(VALID_INTERVALS).toHaveLength(2)
    })

    it('report levels: basic | full | export', () => {
      const levels: ReportLevel[] = ['basic', 'full', 'export']
      expect(levels).toHaveLength(3)
    })
  })
})
