import { describe, it, expect } from 'vitest'


type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'
type ReportLevel = 'basic' | 'full' | 'export'

interface PlanLimits {
  assets: number; users: number; integrations: number; workflows: number
  customFields: number; api: boolean; scim: boolean; sso: boolean; reports: ReportLevel
}

interface PlanPricing { monthly: number; annual: number; currency: string }

interface PlanDefinition {
  key: PlanKey; name: string; tagline: string
  limits: PlanLimits; pricing: PlanPricing | null
  trialDays: number; popular?: boolean
}

const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free', name: 'Free', tagline: 'Für kleine Teams zum Einstieg',
    limits: { assets: 50, users: 3, integrations: 0, workflows: 0, customFields: 0, api: false, scim: false, sso: false, reports: 'basic' },
    pricing: null, trialDays: 0
  },
  starter: {
    key: 'starter', name: 'Starter', tagline: 'Für wachsende Unternehmen',
    limits: { assets: 500, users: 10, integrations: 2, workflows: 3, customFields: 5, api: true, scim: false, sso: false, reports: 'full' },
    pricing: { monthly: 2000, annual: 20000, currency: 'EUR' }, trialDays: 14
  },
  pro: {
    key: 'pro', name: 'Pro', tagline: 'Für professionelles IT-Management',
    limits: { assets: -1, users: 50, integrations: -1, workflows: -1, customFields: -1, api: true, scim: true, sso: true, reports: 'export' },
    pricing: { monthly: 5000, annual: 50000, currency: 'EUR' }, trialDays: 14, popular: true
  },
  enterprise: {
    key: 'enterprise', name: 'Enterprise', tagline: 'Für Konzerne mit besonderen Anforderungen',
    limits: { assets: -1, users: -1, integrations: -1, workflows: -1, customFields: -1, api: true, scim: true, sso: true, reports: 'export' },
    pricing: { monthly: 15000, annual: 150000, currency: 'EUR' }, trialDays: 30
  }
}

const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

function isPlanAtLeast(planA: PlanKey, planB: PlanKey): boolean {
  return PLAN_ORDER.indexOf(planA) >= PLAN_ORDER.indexOf(planB)
}

function getLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan]?.limits ?? PLANS.free.limits
}

function isLimitReached(current: number, limit: number): boolean {
  if (limit === -1) return false
  return current >= limit
}

function requiredPlanFor(feature: keyof PlanLimits): PlanKey {
  for (const planKey of PLAN_ORDER) {
    const val = PLANS[planKey].limits[feature]
    if (val === true || val === -1 || (typeof val === 'number' && val > 0)) return planKey
  }
  return 'enterprise'
}

function formatEurCents(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace('.', ',')
  return `${euros} €`
}

function getPublicPlans() {
  return PLAN_ORDER.map(key => {
    const p = PLANS[key]
    return { key: p.key, name: p.name, tagline: p.tagline, limits: p.limits, pricing: p.pricing, trialDays: p.trialDays, popular: p.popular ?? false }
  })
}


describe('Plans Config — Pure Logic', () => {
  describe('Plan Definitions', () => {
    it('should have 4 plans', () => {
      expect(Object.keys(PLANS)).toHaveLength(4)
    })

    it('free plan should have no pricing', () => {
      expect(PLANS.free.pricing).toBeNull()
    })

    it('free plan should have 0 trial days', () => {
      expect(PLANS.free.trialDays).toBe(0)
    })

    it('should expose the configured trial durations', () => {
      expect(PLANS.starter.trialDays).toBe(14)
      expect(PLANS.pro.trialDays).toBe(14)
      expect(PLANS.enterprise.trialDays).toBe(30)
    })

    it('pro should be the popular plan', () => {
      expect(PLANS.pro.popular).toBe(true)
      expect(PLANS.free.popular).toBeUndefined()
      expect(PLANS.starter.popular).toBeUndefined()
    })

    it('all plans should have German taglines', () => {
      Object.values(PLANS).forEach(p => {
        expect(p.tagline).toMatch(/^Für/)
      })
    })
  })

  describe('Plan Limits — Free Tier', () => {
    const limits = PLANS.free.limits

    it('50 assets max', () => expect(limits.assets).toBe(50))
    it('3 users max', () => expect(limits.users).toBe(3))
    it('0 integrations', () => expect(limits.integrations).toBe(0))
    it('0 workflows', () => expect(limits.workflows).toBe(0))
    it('0 custom fields', () => expect(limits.customFields).toBe(0))
    it('no API access', () => expect(limits.api).toBe(false))
    it('no SCIM', () => expect(limits.scim).toBe(false))
    it('no SSO', () => expect(limits.sso).toBe(false))
    it('basic reports only', () => expect(limits.reports).toBe('basic'))
  })

  describe('Plan Limits — Starter Tier', () => {
    const limits = PLANS.starter.limits

    it('500 assets max', () => expect(limits.assets).toBe(500))
    it('10 users max', () => expect(limits.users).toBe(10))
    it('2 integrations', () => expect(limits.integrations).toBe(2))
    it('3 workflows', () => expect(limits.workflows).toBe(3))
    it('5 custom fields', () => expect(limits.customFields).toBe(5))
    it('API access enabled', () => expect(limits.api).toBe(true))
    it('no SCIM', () => expect(limits.scim).toBe(false))
    it('no SSO', () => expect(limits.sso).toBe(false))
    it('full reports', () => expect(limits.reports).toBe('full'))
  })

  describe('Plan Limits — Pro Tier', () => {
    const limits = PLANS.pro.limits

    it('unlimited assets (-1)', () => expect(limits.assets).toBe(-1))
    it('50 users max', () => expect(limits.users).toBe(50))
    it('unlimited integrations', () => expect(limits.integrations).toBe(-1))
    it('unlimited workflows', () => expect(limits.workflows).toBe(-1))
    it('unlimited custom fields', () => expect(limits.customFields).toBe(-1))
    it('API + SCIM + SSO enabled', () => {
      expect(limits.api).toBe(true)
      expect(limits.scim).toBe(true)
      expect(limits.sso).toBe(true)
    })
    it('export-level reports', () => expect(limits.reports).toBe('export'))
  })

  describe('Plan Limits — Enterprise Tier', () => {
    const limits = PLANS.enterprise.limits

    it('everything unlimited', () => {
      expect(limits.assets).toBe(-1)
      expect(limits.users).toBe(-1)
      expect(limits.integrations).toBe(-1)
      expect(limits.workflows).toBe(-1)
      expect(limits.customFields).toBe(-1)
    })
  })

  describe('Pricing', () => {
    it('starter: €20/mo, €200/yr', () => {
      expect(PLANS.starter.pricing!.monthly).toBe(2000)
      expect(PLANS.starter.pricing!.annual).toBe(20000)
    })

    it('pro: €50/mo, €500/yr', () => {
      expect(PLANS.pro.pricing!.monthly).toBe(5000)
      expect(PLANS.pro.pricing!.annual).toBe(50000)
    })

    it('enterprise: €150/mo, €1500/yr', () => {
      expect(PLANS.enterprise.pricing!.monthly).toBe(15000)
      expect(PLANS.enterprise.pricing!.annual).toBe(150000)
    })

    it('annual should be ≤ monthly × 12 (discount)', () => {
      ['starter', 'pro', 'enterprise'].forEach(key => {
        const p = PLANS[key as PlanKey].pricing!
        expect(p.annual).toBeLessThanOrEqual(p.monthly * 12)
      })
    })

    it('all paid plans should use EUR', () => {
      ['starter', 'pro', 'enterprise'].forEach(key => {
        expect(PLANS[key as PlanKey].pricing!.currency).toBe('EUR')
      })
    })
  })

  describe('isPlanAtLeast', () => {
    it('each plan is at least itself', () => {
      PLAN_ORDER.forEach(p => expect(isPlanAtLeast(p, p)).toBe(true))
    })

    it('higher plans are at least lower plans', () => {
      expect(isPlanAtLeast('enterprise', 'free')).toBe(true)
      expect(isPlanAtLeast('pro', 'starter')).toBe(true)
      expect(isPlanAtLeast('starter', 'free')).toBe(true)
    })

    it('lower plans are NOT at least higher plans', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
      expect(isPlanAtLeast('starter', 'pro')).toBe(false)
      expect(isPlanAtLeast('pro', 'enterprise')).toBe(false)
    })
  })

  describe('isLimitReached', () => {
    it('unlimited (-1) is never reached', () => {
      expect(isLimitReached(999999, -1)).toBe(false)
    })

    it('at limit is reached', () => {
      expect(isLimitReached(50, 50)).toBe(true)
    })

    it('over limit is reached', () => {
      expect(isLimitReached(51, 50)).toBe(true)
    })

    it('under limit is not reached', () => {
      expect(isLimitReached(49, 50)).toBe(false)
    })

    it('zero is not reached for positive limit', () => {
      expect(isLimitReached(0, 50)).toBe(false)
    })

    it('zero IS reached for zero limit', () => {
      expect(isLimitReached(0, 0)).toBe(true)
    })
  })

  describe('requiredPlanFor', () => {
    it('api requires starter', () => {
      expect(requiredPlanFor('api')).toBe('starter')
    })

    it('scim requires pro', () => {
      expect(requiredPlanFor('scim')).toBe('pro')
    })

    it('sso requires pro', () => {
      expect(requiredPlanFor('sso')).toBe('pro')
    })

    it('assets requires free (free has 50 > 0)', () => {
      expect(requiredPlanFor('assets')).toBe('free')
    })

    it('integrations requires starter (free has 0)', () => {
      expect(requiredPlanFor('integrations')).toBe('starter')
    })
  })

  describe('formatEurCents', () => {
    it('2000 → "20,00 €"', () => expect(formatEurCents(2000)).toBe('20,00 €'))
    it('5000 → "50,00 €"', () => expect(formatEurCents(5000)).toBe('50,00 €'))
    it('15000 → "150,00 €"', () => expect(formatEurCents(15000)).toBe('150,00 €'))
    it('0 → "0,00 €"', () => expect(formatEurCents(0)).toBe('0,00 €'))
    it('99 → "0,99 €"', () => expect(formatEurCents(99)).toBe('0,99 €'))
    it('150000 → "1500,00 €"', () => expect(formatEurCents(150000)).toBe('1500,00 €'))
  })

  describe('getPublicPlans', () => {
    const publicPlans = getPublicPlans()

    it('should return 4 plans in order', () => {
      expect(publicPlans).toHaveLength(4)
      expect(publicPlans[0].key).toBe('free')
      expect(publicPlans[1].key).toBe('starter')
      expect(publicPlans[2].key).toBe('pro')
      expect(publicPlans[3].key).toBe('enterprise')
    })

    it('should include limits', () => {
      publicPlans.forEach(p => expect(p.limits).toBeDefined())
    })

    it('should include trialDays', () => {
      publicPlans.forEach(p => expect(typeof p.trialDays).toBe('number'))
    })

    it('popular should default to false', () => {
      expect(publicPlans[0].popular).toBe(false)
      expect(publicPlans[2].popular).toBe(true)
    })
  })
})
