import { describe, it, expect } from 'vitest'


type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'
type ReportLevel = 'basic' | 'full' | 'export'

interface PlanLimits {
  assets: number; users: number; integrations: number
  workflows: number; customFields: number
  api: boolean; scim: boolean; sso: boolean; reports: ReportLevel
}

interface PlanDefinition {
  key: PlanKey; name: string; tagline: string; limits: PlanLimits
  pricing: { monthly: number; annual: number; currency: string } | null
  trialDays: number; popular?: boolean
}

const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free', name: 'Free', tagline: 'Für kleine Teams zum Einstieg',
    limits: { assets: 50, users: 3, integrations: 0, workflows: 0, customFields: 0, api: false, scim: false, sso: false, reports: 'basic' },
    pricing: null, trialDays: 0,
  },
  starter: {
    key: 'starter', name: 'Starter', tagline: 'Für wachsende Unternehmen',
    limits: { assets: 500, users: 10, integrations: 2, workflows: 3, customFields: 5, api: true, scim: false, sso: false, reports: 'full' },
    pricing: { monthly: 2000, annual: 20000, currency: 'EUR' }, trialDays: 14,
  },
  pro: {
    key: 'pro', name: 'Pro', tagline: 'Für professionelles IT-Management',
    limits: { assets: -1, users: 50, integrations: -1, workflows: -1, customFields: -1, api: true, scim: true, sso: true, reports: 'export' },
    pricing: { monthly: 5000, annual: 50000, currency: 'EUR' }, trialDays: 14, popular: true,
  },
  enterprise: {
    key: 'enterprise', name: 'Enterprise', tagline: 'Für Konzerne mit besonderen Anforderungen',
    limits: { assets: -1, users: -1, integrations: -1, workflows: -1, customFields: -1, api: true, scim: true, sso: true, reports: 'export' },
    pricing: { monthly: 15000, annual: 150000, currency: 'EUR' }, trialDays: 30,
  },
}

function isPlanAtLeast(a: PlanKey, b: PlanKey): boolean {
  return PLAN_ORDER.indexOf(a) >= PLAN_ORDER.indexOf(b)
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


describe('Plans Config — Single Source of Truth', () => {
  describe('Plan Definitions', () => {
    it('should have exactly 4 plans', () => {
      expect(Object.keys(PLANS)).toHaveLength(4)
    })

    it.each(['free', 'starter', 'pro', 'enterprise'] as PlanKey[])(
      '%s should have key matching its name', (key) => {
        expect(PLANS[key].key).toBe(key)
      }
    )

    it('only Pro should be marked popular', () => {
      expect(PLANS.pro.popular).toBe(true)
      expect(PLANS.free.popular).toBeUndefined()
      expect(PLANS.starter.popular).toBeUndefined()
      expect(PLANS.enterprise.popular).toBeUndefined()
    })
  })

  describe('Free Plan Limits', () => {
    const limits = PLANS.free.limits

    it('50 assets', () => expect(limits.assets).toBe(50))
    it('3 users', () => expect(limits.users).toBe(3))
    it('0 integrations', () => expect(limits.integrations).toBe(0))
    it('0 workflows', () => expect(limits.workflows).toBe(0))
    it('0 custom fields', () => expect(limits.customFields).toBe(0))
    it('no API', () => expect(limits.api).toBe(false))
    it('no SCIM', () => expect(limits.scim).toBe(false))
    it('no SSO', () => expect(limits.sso).toBe(false))
    it('basic reports', () => expect(limits.reports).toBe('basic'))
  })

  describe('Starter Plan Limits', () => {
    const limits = PLANS.starter.limits

    it('500 assets', () => expect(limits.assets).toBe(500))
    it('10 users', () => expect(limits.users).toBe(10))
    it('2 integrations', () => expect(limits.integrations).toBe(2))
    it('3 workflows', () => expect(limits.workflows).toBe(3))
    it('5 custom fields', () => expect(limits.customFields).toBe(5))
    it('API enabled', () => expect(limits.api).toBe(true))
    it('no SCIM', () => expect(limits.scim).toBe(false))
    it('no SSO', () => expect(limits.sso).toBe(false))
    it('full reports', () => expect(limits.reports).toBe('full'))
  })

  describe('Pro Plan Limits', () => {
    const limits = PLANS.pro.limits

    it('unlimited assets', () => expect(limits.assets).toBe(-1))
    it('50 users', () => expect(limits.users).toBe(50))
    it('unlimited integrations', () => expect(limits.integrations).toBe(-1))
    it('unlimited workflows', () => expect(limits.workflows).toBe(-1))
    it('unlimited custom fields', () => expect(limits.customFields).toBe(-1))
    it('API enabled', () => expect(limits.api).toBe(true))
    it('SCIM enabled', () => expect(limits.scim).toBe(true))
    it('SSO enabled', () => expect(limits.sso).toBe(true))
    it('export reports', () => expect(limits.reports).toBe('export'))
  })

  describe('Enterprise Plan Limits', () => {
    const limits = PLANS.enterprise.limits

    it('unlimited everything', () => {
      expect(limits.assets).toBe(-1)
      expect(limits.users).toBe(-1)
      expect(limits.integrations).toBe(-1)
      expect(limits.workflows).toBe(-1)
      expect(limits.customFields).toBe(-1)
    })

    it('all features enabled', () => {
      expect(limits.api).toBe(true)
      expect(limits.scim).toBe(true)
      expect(limits.sso).toBe(true)
    })
  })

  describe('Pricing', () => {
    it('Free has null pricing', () => {
      expect(PLANS.free.pricing).toBeNull()
    })

    it('Starter: €20/mo, €200/yr (2 months free)', () => {
      expect(PLANS.starter.pricing?.monthly).toBe(2000)
      expect(PLANS.starter.pricing?.annual).toBe(20000)
      expect(PLANS.starter.pricing?.currency).toBe('EUR')
    })

    it('Pro: €50/mo, €500/yr', () => {
      expect(PLANS.pro.pricing?.monthly).toBe(5000)
      expect(PLANS.pro.pricing?.annual).toBe(50000)
    })

    it('Enterprise: €150/mo, €1500/yr', () => {
      expect(PLANS.enterprise.pricing?.monthly).toBe(15000)
      expect(PLANS.enterprise.pricing?.annual).toBe(150000)
    })

    it('annual pricing gives ~2 months free', () => {
      expect(PLANS.starter.pricing!.annual).toBe(PLANS.starter.pricing!.monthly * 10)
      expect(PLANS.pro.pricing!.annual).toBe(PLANS.pro.pricing!.monthly * 10)
      expect(PLANS.enterprise.pricing!.annual).toBe(PLANS.enterprise.pricing!.monthly * 10)
    })
  })

  describe('Trial Days', () => {
    it('Free: no trial', () => expect(PLANS.free.trialDays).toBe(0))
    it('Starter: 14-day trial', () => expect(PLANS.starter.trialDays).toBe(14))
    it('Pro: 14-day trial', () => expect(PLANS.pro.trialDays).toBe(14))
    it('Enterprise: 30-day trial', () => expect(PLANS.enterprise.trialDays).toBe(30))
  })

  describe('isPlanAtLeast', () => {
    it('enterprise ≥ all plans', () => {
      PLAN_ORDER.forEach(p => expect(isPlanAtLeast('enterprise', p)).toBe(true))
    })

    it('free < everything except free', () => {
      expect(isPlanAtLeast('free', 'starter')).toBe(false)
      expect(isPlanAtLeast('free', 'pro')).toBe(false)
      expect(isPlanAtLeast('free', 'enterprise')).toBe(false)
    })
  })

  describe('getLimits', () => {
    it('should return free limits for "free"', () => {
      expect(getLimits('free').assets).toBe(50)
    })

    it('should return pro limits for "pro"', () => {
      expect(getLimits('pro').assets).toBe(-1)
    })

    it('should fallback to free for unknown plan', () => {
      expect(getLimits('nonexistent' as any).assets).toBe(50)
    })
  })

  describe('isLimitReached', () => {
    it('50/50 → reached', () => expect(isLimitReached(50, 50)).toBe(true))
    it('49/50 → not reached', () => expect(isLimitReached(49, 50)).toBe(false))
    it('unlimited (-1) → never reached', () => expect(isLimitReached(99999, -1)).toBe(false))
    it('0/0 → reached', () => expect(isLimitReached(0, 0)).toBe(true))
  })

  describe('requiredPlanFor (Feature Discovery)', () => {
    it('API requires Starter', () => expect(requiredPlanFor('api')).toBe('starter'))
    it('SCIM requires Pro', () => expect(requiredPlanFor('scim')).toBe('pro'))
    it('SSO requires Pro', () => expect(requiredPlanFor('sso')).toBe('pro'))
    it('assets require Free (always > 0)', () => expect(requiredPlanFor('assets')).toBe('free'))
    it('integrations require Starter', () => expect(requiredPlanFor('integrations')).toBe('starter'))
    it('workflows require Starter', () => expect(requiredPlanFor('workflows')).toBe('starter'))
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

    it('should return 4 plans', () => {
      expect(publicPlans).toHaveLength(4)
    })

    it('should be in order: free, starter, pro, enterprise', () => {
      expect(publicPlans.map(p => p.key)).toEqual(['free', 'starter', 'pro', 'enterprise'])
    })

    it('popular should default to false when undefined', () => {
      expect(publicPlans[0].popular).toBe(false)
      expect(publicPlans[2].popular).toBe(true)
    })
  })
})
