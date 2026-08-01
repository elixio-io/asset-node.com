
export type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'
export type BillingInterval = 'monthly' | 'annual'
export type ReportLevel = 'basic' | 'full' | 'export'

export interface PlanLimits {
  assets: number
  users: number
  integrations: number
  workflows: number
  customFields: number
  api: boolean
  scim: boolean
  sso: boolean
  reports: ReportLevel
}

export interface PlanPricing {
  monthly: number
  annual: number
  currency: string
}

export interface PlanDefinition {
  key: PlanKey
  name: string
  tagline: string
  limits: PlanLimits
  pricing: PlanPricing | null
  trialDays: number
  popular?: boolean
}


export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    tagline: 'For small teams getting started',
    limits: {
      assets: 100,
      users: 5,
      integrations: 1,
      workflows: 1,
      customFields: -1,
      api: true,
      scim: false,
      sso: false,
      reports: 'basic',
    },
    pricing: null,
    trialDays: 0,
  },

  starter: {
    key: 'starter',
    name: 'Starter',
    tagline: 'For growing companies',
    limits: {
      assets: 500,
      users: 10,
      integrations: 2,
      workflows: 3,
      customFields: -1,
      api: true,
      scim: false,
      sso: false,
      reports: 'full',
    },
    pricing: {
      monthly: 2000,
      annual: 20000,
      currency: 'EUR',
    },
    trialDays: 14,
  },

  pro: {
    key: 'pro',
    name: 'Pro',
    tagline: 'For professional IT management',
    limits: {
      assets: -1,
      users: 50,
      integrations: -1,
      workflows: -1,
      customFields: -1,
      api: true,
      scim: true,
      sso: true,
      reports: 'export',
    },
    pricing: {
      monthly: 5000,
      annual: 50000,
      currency: 'EUR',
    },
    trialDays: 14,
    popular: true,
  },

  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'For enterprises with custom requirements',
    limits: {
      assets: -1,
      users: -1,
      integrations: -1,
      workflows: -1,
      customFields: -1,
      api: true,
      scim: true,
      sso: true,
      reports: 'export',
    },
    pricing: {
      monthly: 15000,
      annual: 150000,
      currency: 'EUR',
    },
    trialDays: 30,
  },
}


export const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

export function isPlanAtLeast(planA: PlanKey, planB: PlanKey): boolean {
  return PLAN_ORDER.indexOf(planA) >= PLAN_ORDER.indexOf(planB)
}

export function getLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan]?.limits ?? PLANS.free.limits
}

export function isLimitReached(current: number, limit: number): boolean {
  if (limit === -1) return false
  return current >= limit
}

export function requiredPlanFor(feature: keyof PlanLimits): PlanKey {
  for (const planKey of PLAN_ORDER) {
    const val = PLANS[planKey].limits[feature]
    if (val === true || val === -1 || (typeof val === 'number' && val > 0)) {
      return planKey
    }
  }
  return 'enterprise'
}

export function formatEurCents(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace('.', ',')
  return `${euros} €`
}

export function getPublicPlans() {
  return PLAN_ORDER.map(key => {
    const p = PLANS[key]
    return {
      key: p.key,
      name: p.name,
      tagline: p.tagline,
      limits: p.limits,
      pricing: p.pricing,
      trialDays: p.trialDays,
      popular: p.popular ?? false,
    }
  })
}
