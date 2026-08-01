import { describe, it, expect } from 'vitest'
import {
  PLANS, PLAN_ORDER,
  isPlanAtLeast, getLimits, isLimitReached,
  requiredPlanFor, formatEurCents, getPublicPlans,
  type PlanKey,
} from '../../server/config/plans'

describe('Plan Configuration', () => {
  describe('PLANS definitions', () => {
    it('should have all 4 plan tiers defined', () => {
      expect(Object.keys(PLANS)).toEqual(['free', 'starter', 'pro', 'enterprise'])
    })

    it('free plan should have no pricing', () => {
      expect(PLANS.free.pricing).toBeNull()
    })

    it('free plan should have 100 asset limit', () => {
      expect(PLANS.free.limits.assets).toBe(100)
    })

    it('free plan should have 5 user limit', () => {
      expect(PLANS.free.limits.users).toBe(5)
    })

    it('free plan should have API but NOT SCIM or SSO', () => {
      expect(PLANS.free.limits.api).toBe(true)
      expect(PLANS.free.limits.scim).toBe(false)
      expect(PLANS.free.limits.sso).toBe(false)
    })

    it('pro plan should have unlimited assets (-1)', () => {
      expect(PLANS.pro.limits.assets).toBe(-1)
    })

    it('pro plan should have SCIM and SSO', () => {
      expect(PLANS.pro.limits.scim).toBe(true)
      expect(PLANS.pro.limits.sso).toBe(true)
    })

    it('enterprise plan should have ALL unlimited', () => {
      expect(PLANS.enterprise.limits.assets).toBe(-1)
      expect(PLANS.enterprise.limits.users).toBe(-1)
      expect(PLANS.enterprise.limits.integrations).toBe(-1)
      expect(PLANS.enterprise.limits.workflows).toBe(-1)
    })

    it('starter plan should cost €20/month', () => {
      expect(PLANS.starter.pricing?.monthly).toBe(2000)
    })

    it('pro plan should be marked as popular', () => {
      expect(PLANS.pro.popular).toBe(true)
    })

    it('free plan should have 0 trial days', () => {
      expect(PLANS.free.trialDays).toBe(0)
    })

    it('starter/pro have 14 days and Enterprise has 30 days', () => {
      expect(PLANS.starter.trialDays).toBe(14)
      expect(PLANS.pro.trialDays).toBe(14)
      expect(PLANS.enterprise.trialDays).toBe(30)
    })
  })

  describe('isPlanAtLeast', () => {
    it('enterprise >= free', () => {
      expect(isPlanAtLeast('enterprise', 'free')).toBe(true)
    })

    it('free >= free', () => {
      expect(isPlanAtLeast('free', 'free')).toBe(true)
    })

    it('free < starter', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
    })

    it('pro >= starter', () => {
      expect(isPlanAtLeast('pro', 'starter')).toBe(true)
    })

    it('starter < pro', () => {
      expect(isPlanAtLeast('starter', 'pro')).toBe(false)
    })
  })

  describe('getLimits', () => {
    it('should return correct limits for pro plan', () => {
      const limits = getLimits('pro')
      expect(limits.assets).toBe(-1)
      expect(limits.scim).toBe(true)
    })

    it('should fall back to free plan limits for unknown plan', () => {
      const limits = getLimits('nonexistent' as PlanKey)
      expect(limits).toEqual(PLANS.free.limits)
    })
  })

  describe('isLimitReached', () => {
    it('returns true when current equals limit', () => {
      expect(isLimitReached(50, 50)).toBe(true)
    })

    it('returns true when current exceeds limit', () => {
      expect(isLimitReached(100, 50)).toBe(true)
    })

    it('returns false when current is below limit', () => {
      expect(isLimitReached(10, 50)).toBe(false)
    })

    it('returns false for unlimited (-1)', () => {
      expect(isLimitReached(99999, -1)).toBe(false)
    })
  })

  describe('requiredPlanFor', () => {
    it('API is available on free plan', () => {
      expect(requiredPlanFor('api')).toBe('free')
    })

    it('SCIM requires pro plan', () => {
      expect(requiredPlanFor('scim')).toBe('pro')
    })

    it('SSO requires pro plan', () => {
      expect(requiredPlanFor('sso')).toBe('pro')
    })
  })

  describe('formatEurCents', () => {
    it('formats 2000 cents as "20,00 €"', () => {
      expect(formatEurCents(2000)).toBe('20,00 €')
    })

    it('formats 5000 cents as "50,00 €"', () => {
      expect(formatEurCents(5000)).toBe('50,00 €')
    })

    it('formats 0 as "0,00 €"', () => {
      expect(formatEurCents(0)).toBe('0,00 €')
    })

    it('formats 150000 cents as "1500,00 €"', () => {
      expect(formatEurCents(150000)).toBe('1500,00 €')
    })
  })

  describe('getPublicPlans', () => {
    it('should return all 4 plans in order', () => {
      const plans = getPublicPlans()
      expect(plans).toHaveLength(4)
      expect(plans.map(p => p.key)).toEqual(PLAN_ORDER)
    })

    it('should not leak internal fields', () => {
      const plans = getPublicPlans()
      plans.forEach(p => {
        expect(p).toHaveProperty('key')
        expect(p).toHaveProperty('name')
        expect(p).toHaveProperty('limits')
        expect(p).toHaveProperty('pricing')
        expect(p).toHaveProperty('trialDays')
        expect(p).toHaveProperty('popular')
      })
    })
  })
})
