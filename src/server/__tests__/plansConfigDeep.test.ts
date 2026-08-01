import { describe, it, expect } from 'vitest'
import {
  PLANS,
  PLAN_ORDER,
  isPlanAtLeast,
  getLimits,
  isLimitReached,
  requiredPlanFor,
  formatEurCents,
  getPublicPlans,
  type PlanKey,
} from '../../server/config/plans'

describe('Plans Config Deep — Single Source of Truth', () => {
  describe('Plan Registry', () => {
    it('should define exactly 4 plans', () => {
      expect(Object.keys(PLANS)).toHaveLength(4)
    })

    it.each(['free', 'starter', 'pro', 'enterprise'] as PlanKey[])(
      '"%s" should exist with matching key', (plan) => {
        expect(PLANS[plan]).toBeDefined()
        expect(PLANS[plan].key).toBe(plan)
      }
    )

    it('free plan should have null pricing', () => {
      expect(PLANS.free.pricing).toBeNull()
    })

    it('paid plans should have EUR pricing', () => {
      expect(PLANS.starter.pricing?.currency).toBe('EUR')
      expect(PLANS.pro.pricing?.currency).toBe('EUR')
      expect(PLANS.enterprise.pricing?.currency).toBe('EUR')
    })

    it('pro plan should be popular', () => {
      expect(PLANS.pro.popular).toBe(true)
    })

    it('free plan should have 0 trial days', () => {
      expect(PLANS.free.trialDays).toBe(0)
    })

    it('should expose the configured trial durations', () => {
      expect(PLANS.starter.trialDays).toBe(14)
      expect(PLANS.pro.trialDays).toBe(14)
      expect(PLANS.enterprise.trialDays).toBe(30)
    })
  })

  describe('PLAN_ORDER', () => {
    it('should have 4 entries', () => {
      expect(PLAN_ORDER).toHaveLength(4)
    })

    it('should be in ascending order', () => {
      expect(PLAN_ORDER).toEqual(['free', 'starter', 'pro', 'enterprise'])
    })
  })

  describe('isPlanAtLeast()', () => {
    it('enterprise >= enterprise', () => {
      expect(isPlanAtLeast('enterprise', 'enterprise')).toBe(true)
    })

    it('enterprise >= free', () => {
      expect(isPlanAtLeast('enterprise', 'free')).toBe(true)
    })

    it('free >= free', () => {
      expect(isPlanAtLeast('free', 'free')).toBe(true)
    })

    it('free < starter', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
    })

    it('starter < pro', () => {
      expect(isPlanAtLeast('starter', 'pro')).toBe(false)
    })

    it('pro >= starter', () => {
      expect(isPlanAtLeast('pro', 'starter')).toBe(true)
    })

    it('pro < enterprise', () => {
      expect(isPlanAtLeast('pro', 'enterprise')).toBe(false)
    })
  })

  describe('getLimits()', () => {
    it('free -> 100 assets', () => {
      expect(getLimits('free').assets).toBe(100)
    })

    it('starter -> 500 assets', () => {
      expect(getLimits('starter').assets).toBe(500)
    })

    it('pro -> unlimited assets (-1)', () => {
      expect(getLimits('pro').assets).toBe(-1)
    })

    it('enterprise -> unlimited everything', () => {
      const limits = getLimits('enterprise')
      expect(limits.assets).toBe(-1)
      expect(limits.users).toBe(-1)
      expect(limits.integrations).toBe(-1)
      expect(limits.workflows).toBe(-1)
      expect(limits.customFields).toBe(-1)
    })

    it('free -> API yes, SCIM no, SSO no', () => {
      const limits = getLimits('free')
      expect(limits.api).toBe(true)
      expect(limits.scim).toBe(false)
      expect(limits.sso).toBe(false)
    })

    it('starter -> API yes, SCIM no, SSO no', () => {
      const limits = getLimits('starter')
      expect(limits.api).toBe(true)
      expect(limits.scim).toBe(false)
      expect(limits.sso).toBe(false)
    })

    it('pro -> API yes, SCIM yes, SSO yes', () => {
      const limits = getLimits('pro')
      expect(limits.api).toBe(true)
      expect(limits.scim).toBe(true)
      expect(limits.sso).toBe(true)
    })

    it('invalid plan -> free limits fallback', () => {
      expect(getLimits('nonexistent' as PlanKey).assets).toBe(100)
    })
  })

  describe('isLimitReached()', () => {
    it('49/50 -> not reached', () => {
      expect(isLimitReached(49, 50)).toBe(false)
    })

    it('50/50 -> reached', () => {
      expect(isLimitReached(50, 50)).toBe(true)
    })

    it('51/50 -> reached (over limit)', () => {
      expect(isLimitReached(51, 50)).toBe(true)
    })

    it('0/50 -> not reached', () => {
      expect(isLimitReached(0, 50)).toBe(false)
    })

    it('-1 (unlimited) -> never reached', () => {
      expect(isLimitReached(999999, -1)).toBe(false)
    })

    it('0/0 -> reached', () => {
      expect(isLimitReached(0, 0)).toBe(true)
    })
  })

  describe('requiredPlanFor()', () => {
    it('api -> free (now included in free plan)', () => {
      expect(requiredPlanFor('api')).toBe('free')
    })

    it('scim -> pro', () => {
      expect(requiredPlanFor('scim')).toBe('pro')
    })

    it('sso -> pro', () => {
      expect(requiredPlanFor('sso')).toBe('pro')
    })

    it('assets -> free', () => {
      expect(requiredPlanFor('assets')).toBe('free')
    })

    it('integrations -> free (1 included in free)', () => {
      expect(requiredPlanFor('integrations')).toBe('free')
    })

    it('workflows -> free (1 included in free)', () => {
      expect(requiredPlanFor('workflows')).toBe('free')
    })

    it('customFields -> free (3 included in free)', () => {
      expect(requiredPlanFor('customFields')).toBe('free')
    })
  })

  describe('formatEurCents()', () => {
    it('2000 -> "20,00 \u20ac"', () => {
      expect(formatEurCents(2000)).toBe('20,00 \u20ac')
    })

    it('5000 -> "50,00 \u20ac"', () => {
      expect(formatEurCents(5000)).toBe('50,00 \u20ac')
    })

    it('15000 -> "150,00 \u20ac"', () => {
      expect(formatEurCents(15000)).toBe('150,00 \u20ac')
    })

    it('0 -> "0,00 \u20ac"', () => {
      expect(formatEurCents(0)).toBe('0,00 \u20ac')
    })

    it('99 -> "0,99 \u20ac"', () => {
      expect(formatEurCents(99)).toBe('0,99 \u20ac')
    })

    it('100050 -> "1000,50 \u20ac"', () => {
      expect(formatEurCents(100050)).toBe('1000,50 \u20ac')
    })
  })

  describe('getPublicPlans()', () => {
    it('should return 4 plans', () => {
      expect(getPublicPlans()).toHaveLength(4)
    })

    it('should be in plan order', () => {
      const keys = getPublicPlans().map(p => p.key)
      expect(keys).toEqual(['free', 'starter', 'pro', 'enterprise'])
    })

    it('each plan should have required public fields', () => {
      for (const plan of getPublicPlans()) {
        expect(plan).toHaveProperty('key')
        expect(plan).toHaveProperty('name')
        expect(plan).toHaveProperty('tagline')
        expect(plan).toHaveProperty('limits')
        expect(plan).toHaveProperty('pricing')
        expect(plan).toHaveProperty('trialDays')
        expect(plan).toHaveProperty('popular')
      }
    })

    it('popular should default to false when not set', () => {
      const plans = getPublicPlans()
      expect(plans[0].popular).toBe(false)
      expect(plans[1].popular).toBe(false)
      expect(plans[2].popular).toBe(true)
      expect(plans[3].popular).toBe(false)
    })
  })

  describe('Plan Limit Escalation', () => {
    it('asset limits should increase across plans', () => {
      expect(getLimits('free').assets).toBe(100)
      expect(getLimits('starter').assets).toBe(500)
      expect(getLimits('pro').assets).toBe(-1)
      expect(getLimits('enterprise').assets).toBe(-1)
    })

    it('user limits should increase across plans', () => {
      expect(getLimits('free').users).toBe(5)
      expect(getLimits('starter').users).toBe(10)
      expect(getLimits('pro').users).toBe(50)
      expect(getLimits('enterprise').users).toBe(-1)
    })

    it('report levels should escalate: basic -> full -> export', () => {
      expect(getLimits('free').reports).toBe('basic')
      expect(getLimits('starter').reports).toBe('full')
      expect(getLimits('pro').reports).toBe('export')
      expect(getLimits('enterprise').reports).toBe('export')
    })
  })

  describe('Pricing Integrity', () => {
    it('annual should be cheaper per month than monthly', () => {
      for (const key of ['starter', 'pro', 'enterprise'] as PlanKey[]) {
        const pricing = PLANS[key].pricing!
        const monthlyPerYear = pricing.monthly * 12
        expect(pricing.annual).toBeLessThan(monthlyPerYear)
      }
    })

    it('prices should increase with plan tier', () => {
      expect(PLANS.starter.pricing!.monthly).toBeLessThan(PLANS.pro.pricing!.monthly)
      expect(PLANS.pro.pricing!.monthly).toBeLessThan(PLANS.enterprise.pricing!.monthly)
    })
  })
})
