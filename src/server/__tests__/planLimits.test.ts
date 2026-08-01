import { describe, it, expect, vi } from 'vitest'
import { PLANS, PLAN_ORDER, getLimits, isLimitReached, getPlanByKey, formatEurCents, requiredPlanFor } from '../../server/config/plans'
import type { PlanKey } from '../../server/config/plans'

describe('Plan Limits Middleware — Deep Tests', () => {
  describe('Plan hierarchy', () => {
    it('should have PLAN_ORDER from free to enterprise', () => {
      expect(PLAN_ORDER).toEqual(['free', 'starter', 'pro', 'enterprise'])
    })

    it('every plan in PLAN_ORDER should exist in PLANS', () => {
      PLAN_ORDER.forEach(key => {
        expect(PLANS[key], `Plan ${key} should exist`).toBeDefined()
      })
    })
  })

  describe('getLimits', () => {
    it('should return limits for each plan', () => {
      PLAN_ORDER.forEach(key => {
        const limits = getLimits(key)
        expect(limits).toBeDefined()
        expect(limits.assets).toBeDefined()
        expect(limits.users).toBeDefined()
        expect(limits.integrations).toBeDefined()
      })
    })

    it('free should have the most restrictive limits', () => {
      const free = getLimits('free')
      const starter = getLimits('starter')
      expect(free.assets).toBeLessThanOrEqual(starter.assets === -1 ? Infinity : starter.assets)
    })

    it('enterprise should have unlimited assets (-1)', () => {
      const enterprise = getLimits('enterprise')
      expect(enterprise.assets).toBe(-1)
    })

    it('should fall back to free for unknown plan key', () => {
      const result = getLimits('nonexistent' as PlanKey)
      expect(result).toEqual(getLimits('free'))
    })
  })

  describe('isLimitReached', () => {
    it('should return false when well below limit', () => {
      expect(isLimitReached(5, 50)).toBe(false)
    })

    it('should return true when at limit', () => {
      expect(isLimitReached(50, 50)).toBe(true)
    })

    it('should return true when over limit', () => {
      expect(isLimitReached(55, 50)).toBe(true)
    })

    it('should never be reached when limit is -1 (unlimited)', () => {
      expect(isLimitReached(99999, -1)).toBe(false)
    })

    it('should handle zero count', () => {
      expect(isLimitReached(0, 50)).toBe(false)
    })

    it('should be reached when limit is 0', () => {
      expect(isLimitReached(0, 0)).toBe(true)
    })
  })

  describe('Feature gating via limits', () => {
    it('free should have API access (read-only)', () => {
      expect(getLimits('free').api).toBe(true)
    })

    it('free should NOT have SSO', () => {
      expect(getLimits('free').sso).toBe(false)
    })

    it('free should NOT have SCIM', () => {
      expect(getLimits('free').scim).toBe(false)
    })

    it('starter should have API access', () => {
      expect(getLimits('starter').api).toBe(true)
    })

    it('enterprise should have all boolean features', () => {
      const limits = getLimits('enterprise')
      expect(limits.api).toBe(true)
      expect(limits.sso).toBe(true)
      expect(limits.scim).toBe(true)
    })
  })

  describe('Plan pricing consistency', () => {
    it('free plan should have null pricing', () => {
      expect(PLANS.free.pricing).toBeNull()
    })

    it('paid plans should have pricing with monthly > 0', () => {
      ;(['starter', 'pro', 'enterprise'] as PlanKey[]).forEach(key => {
        const pricing = PLANS[key].pricing
        expect(pricing, `${key} should have pricing`).toBeDefined()
        expect(pricing!.monthly).toBeGreaterThan(0)
      })
    })

    it('annual pricing should be less per month than monthly', () => {
      ;(['starter', 'pro', 'enterprise'] as PlanKey[]).forEach(key => {
        const pricing = PLANS[key].pricing
        if (!pricing) return
        const monthlyPerMonth = pricing.monthly
        const annualPerMonth = pricing.annual / 12
        expect(annualPerMonth, `${key} annual should be cheaper per month`).toBeLessThan(monthlyPerMonth)
      })
    })

    it('all pricing should be in EUR', () => {
      ;(['starter', 'pro', 'enterprise'] as PlanKey[]).forEach(key => {
        const pricing = PLANS[key].pricing
        if (!pricing) return
        expect(pricing.currency).toBe('EUR')
      })
    })
  })

  describe('Trial days', () => {
    it('free should have 0 trial days', () => {
      expect(PLANS.free.trialDays).toBe(0)
    })

    it('paid plans should have trial days > 0', () => {
      ;(['starter', 'pro', 'enterprise'] as PlanKey[]).forEach(key => {
        expect(PLANS[key].trialDays, `${key} should have trial days`).toBeGreaterThan(0)
      })
    })
  })

  describe('Limit escalation (each tier should be >= previous)', () => {
    const resources = ['assets', 'users', 'integrations', 'workflows', 'customFields'] as const

    resources.forEach(resource => {
      it(`${resource} limits should increase or stay unlimited across tiers`, () => {
        for (let i = 1; i < PLAN_ORDER.length; i++) {
          const prev = getLimits(PLAN_ORDER[i - 1])[resource]
          const curr = getLimits(PLAN_ORDER[i])[resource]
          if (curr === -1) continue
          if (prev === -1) {
            expect(curr).toBe(-1)
          } else {
            expect(curr, `${resource}: ${PLAN_ORDER[i]} >= ${PLAN_ORDER[i - 1]}`).toBeGreaterThanOrEqual(prev)
          }
        }
      })
    })
  })
})
