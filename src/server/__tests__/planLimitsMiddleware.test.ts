import { describe, it, expect } from 'vitest'


type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'

const PLAN_HIERARCHY: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

function isPlanAtLeast(current: PlanKey, minimum: PlanKey): boolean {
  return PLAN_HIERARCHY.indexOf(current) >= PLAN_HIERARCHY.indexOf(minimum)
}

type BillingStatus = 'free' | 'trialing' | 'active' | 'canceled' | 'past_due'

function getEffectivePlan(plan: PlanKey, billingStatus: BillingStatus, trialEndsAt?: Date): PlanKey {
  if (billingStatus === 'trialing' && trialEndsAt && trialEndsAt < new Date()) return 'free'
  if (billingStatus === 'canceled' || billingStatus === 'past_due') return 'free'
  return plan
}

function shouldCheckRequirePlan(effectivePlan: PlanKey, minimumPlan: PlanKey): 'pass' | 'upgrade_required' {
  return isPlanAtLeast(effectivePlan, minimumPlan) ? 'pass' : 'upgrade_required'
}

type Feature = 'api' | 'scim' | 'sso'

const FEATURE_REQUIREMENTS: Record<Feature, PlanKey> = {
  api: 'starter',
  scim: 'pro',
  sso: 'pro'
}

function shouldCheckRequireFeature(plan: PlanKey, feature: Feature): 'pass' | 'feature_not_available' {
  return isPlanAtLeast(plan, FEATURE_REQUIREMENTS[feature]) ? 'pass' : 'feature_not_available'
}

function findUpgradePlan(currentPlan: PlanKey, resource: string, currentLimit: number): PlanKey {
  const limits: Record<PlanKey, Record<string, number>> = {
    free: { assets: 50, users: 3, integrations: 0, workflows: 0 },
    starter: { assets: 500, users: 10, integrations: 2, workflows: 3 },
    pro: { assets: -1, users: 50, integrations: -1, workflows: -1 },
    enterprise: { assets: -1, users: -1, integrations: -1, workflows: -1 }
  }

  const idx = PLAN_HIERARCHY.indexOf(currentPlan)
  return PLAN_HIERARCHY.slice(idx + 1).find(p => {
    const l = limits[p][resource]
    return l === -1 || l > currentLimit
  }) || 'enterprise'
}


describe('Plan Limits Middleware — Pure Logic', () => {
  describe('isPlanAtLeast', () => {
    it('free >= free', () => expect(isPlanAtLeast('free', 'free')).toBe(true))
    it('starter >= free', () => expect(isPlanAtLeast('starter', 'free')).toBe(true))
    it('pro >= starter', () => expect(isPlanAtLeast('pro', 'starter')).toBe(true))
    it('enterprise >= pro', () => expect(isPlanAtLeast('enterprise', 'pro')).toBe(true))
    it('free < starter', () => expect(isPlanAtLeast('free', 'starter')).toBe(false))
    it('starter < pro', () => expect(isPlanAtLeast('starter', 'pro')).toBe(false))
    it('pro < enterprise', () => expect(isPlanAtLeast('pro', 'enterprise')).toBe(false))
    it('enterprise >= everything', () => {
      expect(isPlanAtLeast('enterprise', 'free')).toBe(true)
      expect(isPlanAtLeast('enterprise', 'starter')).toBe(true)
      expect(isPlanAtLeast('enterprise', 'pro')).toBe(true)
      expect(isPlanAtLeast('enterprise', 'enterprise')).toBe(true)
    })
  })

  describe('getEffectivePlan — billing status enforcement', () => {
    it('active pro → pro', () => {
      expect(getEffectivePlan('pro', 'active')).toBe('pro')
    })

    it('canceled pro → free (downgraded)', () => {
      expect(getEffectivePlan('pro', 'canceled')).toBe('free')
    })

    it('past_due enterprise → free (downgraded)', () => {
      expect(getEffectivePlan('enterprise', 'past_due')).toBe('free')
    })

    it('trialing with valid trial → keeps plan', () => {
      const futureDate = new Date(Date.now() + 86400000)
      expect(getEffectivePlan('pro', 'trialing', futureDate)).toBe('pro')
    })

    it('trialing with expired trial → free', () => {
      const pastDate = new Date(Date.now() - 86400000)
      expect(getEffectivePlan('pro', 'trialing', pastDate)).toBe('free')
    })

    it('free plan is always free regardless of status', () => {
      expect(getEffectivePlan('free', 'free')).toBe('free')
      expect(getEffectivePlan('free', 'canceled')).toBe('free')
    })
  })

  describe('requirePlan decision', () => {
    it('pro org accessing starter feature → pass', () => {
      expect(shouldCheckRequirePlan('pro', 'starter')).toBe('pass')
    })

    it('free org accessing starter feature → upgrade_required', () => {
      expect(shouldCheckRequirePlan('free', 'starter')).toBe('upgrade_required')
    })

    it('enterprise org accessing pro feature → pass', () => {
      expect(shouldCheckRequirePlan('enterprise', 'pro')).toBe('pass')
    })

    it('starter org accessing pro feature → upgrade_required', () => {
      expect(shouldCheckRequirePlan('starter', 'pro')).toBe('upgrade_required')
    })
  })

  describe('requireFeature decision', () => {
    it('starter can use api', () => {
      expect(shouldCheckRequireFeature('starter', 'api')).toBe('pass')
    })

    it('free cannot use api', () => {
      expect(shouldCheckRequireFeature('free', 'api')).toBe('feature_not_available')
    })

    it('pro can use scim', () => {
      expect(shouldCheckRequireFeature('pro', 'scim')).toBe('pass')
    })

    it('starter cannot use scim', () => {
      expect(shouldCheckRequireFeature('starter', 'scim')).toBe('feature_not_available')
    })

    it('pro can use sso', () => {
      expect(shouldCheckRequireFeature('pro', 'sso')).toBe('pass')
    })

    it('free cannot use sso', () => {
      expect(shouldCheckRequireFeature('free', 'sso')).toBe('feature_not_available')
    })

    it('enterprise can use all features', () => {
      expect(shouldCheckRequireFeature('enterprise', 'api')).toBe('pass')
      expect(shouldCheckRequireFeature('enterprise', 'scim')).toBe('pass')
      expect(shouldCheckRequireFeature('enterprise', 'sso')).toBe('pass')
    })
  })

  describe('findUpgradePlan', () => {
    it('free at asset limit → suggests starter', () => {
      expect(findUpgradePlan('free', 'assets', 50)).toBe('starter')
    })

    it('starter at asset limit → suggests pro (unlimited)', () => {
      expect(findUpgradePlan('starter', 'assets', 500)).toBe('pro')
    })

    it('free at user limit → suggests starter', () => {
      expect(findUpgradePlan('free', 'users', 3)).toBe('starter')
    })

    it('starter at user limit → suggests pro', () => {
      expect(findUpgradePlan('starter', 'users', 10)).toBe('pro')
    })

    it('pro at user limit → suggests enterprise (unlimited)', () => {
      expect(findUpgradePlan('pro', 'users', 50)).toBe('enterprise')
    })

    it('free org at integration limit → suggests starter', () => {
      expect(findUpgradePlan('free', 'integrations', 0)).toBe('starter')
    })
  })
})
