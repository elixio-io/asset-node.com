import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api'


export type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'
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
  popular: boolean
}

export interface UsageItem {
  current: number
  limit: number
}

export interface BillingStatus {
  plan: PlanKey
  planName: string
  basePlan: PlanKey
  basePlanName: string
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled'
  interval: 'monthly' | 'annual'
  pricing: PlanPricing | null
  accessOverride: {
    plan: PlanKey
    planName: string
    grantedAt: string
    expiresAt: string
    daysRemaining: number
    reason?: string
  } | null
  trial: { startedAt: string; endsAt: string; daysRemaining: number } | null
  pendingSubscription: {
    plan: Exclude<PlanKey, 'free'>
    planName: string
    interval: 'monthly' | 'annual'
    state: 'creating' | 'finalizing' | 'awaiting_payment' | 'overdue' | 'canceled' | 'failed'
    requestedAt: string
  } | null
  currentPeriod: { start: string; end: string } | null
  lastPaymentAt: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  usage: {
    assets: UsageItem
    users: UsageItem
    integrations: UsageItem
    workflows: UsageItem
    customFields: UsageItem
    features: {
      api: boolean
      scim: boolean
      sso: boolean
      reports: ReportLevel
    }
  }
}

export interface InvoiceItem {
  id: string
  date: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'overdue'
  description: string
  downloadUrl?: string
}


export const useBillingStore = defineStore('billing', () => {
  const billingStatus = ref<BillingStatus | null>(null)
  const plans = ref<PlanDefinition[]>([])
  const invoices = ref<InvoiceItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  const currentPlan = computed(() => billingStatus.value?.plan || 'free')
  const currentPlanName = computed(() => billingStatus.value?.planName || 'Free')
  const basePlan = computed(() => billingStatus.value?.basePlan || currentPlan.value)
  const basePlanName = computed(() => billingStatus.value?.basePlanName || currentPlanName.value)
  const subscriptionStatus = computed(() => billingStatus.value?.status || 'free')
  const isTrialing = computed(() => billingStatus.value?.status === 'trialing')
  const isActive = computed(() => billingStatus.value?.status === 'active')
  const isPastDue = computed(() => billingStatus.value?.status === 'past_due')
  const isCanceled = computed(() => billingStatus.value?.cancelAtPeriodEnd === true)
  const trialDaysRemaining = computed(() => billingStatus.value?.trial?.daysRemaining ?? 0)
  const usage = computed(() => billingStatus.value?.usage || null)
  const features = computed(() => billingStatus.value?.usage?.features || { api: false, scim: false, sso: false, reports: 'basic' as ReportLevel })


  async function fetchPlans() {
    try {
      const res = await api.get<PlanDefinition[]>('/billing/plans')
      plans.value = res.data
    } catch {
      plans.value = []
    }
  }

  async function fetchStatus() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get<BillingStatus>('/billing/status')
      billingStatus.value = res.data
      initialized.value = true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load billing status'
    } finally {
      loading.value = false
    }
  }

  async function fetchInvoices() {
    try {
      const res = await api.get<InvoiceItem[]>('/billing/invoices')
      invoices.value = res.data
    } catch {
      invoices.value = []
    }
  }

  async function startTrial(plan: PlanKey, interval: 'monthly' | 'annual' = 'monthly') {
    loading.value = true
    error.value = null
    try {
      await api.post('/billing/start-trial', { plan, interval })
      await fetchStatus()
      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to start trial'
      return false
    } finally {
      loading.value = false
    }
  }

  async function subscribe(
    plan: PlanKey,
    interval: 'monthly' | 'annual' = 'monthly',
    billingAddress?: {
      companyName: string
      street: string
      city: string
      zipCode: string
      countryCode: string
      vatNumber?: string
    }
  ) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/billing/subscribe', { plan, interval, billingAddress })
      await fetchStatus()
      await fetchInvoices()
      return res.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to create subscription'
      return null
    } finally {
      loading.value = false
    }
  }

  async function cancelSubscription() {
    loading.value = true
    error.value = null
    try {
      await api.post('/billing/cancel', {})
      await fetchStatus()
      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to cancel subscription'
      return false
    } finally {
      loading.value = false
    }
  }

  async function reactivateSubscription() {
    loading.value = true
    error.value = null
    try {
      await api.post('/billing/reactivate', {})
      await fetchStatus()
      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to reactivate subscription'
      return false
    } finally {
      loading.value = false
    }
  }

  async function init() {
    if (initialized.value) return
    await Promise.all([fetchPlans(), fetchStatus()])
  }


  const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']

  function isPlanAtLeast(target: PlanKey): boolean {
    return PLAN_ORDER.indexOf(currentPlan.value) >= PLAN_ORDER.indexOf(target)
  }

  function canUse(feature: 'api' | 'scim' | 'sso'): boolean {
    return features.value[feature] === true
  }

  function isAtLimit(resource: 'assets' | 'users' | 'integrations' | 'workflows' | 'customFields'): boolean {
    const u = usage.value
    if (!u) return false
    const item = u[resource]
    if (item.limit === -1) return false
    return item.current >= item.limit
  }

  function usagePercent(resource: 'assets' | 'users' | 'integrations' | 'workflows' | 'customFields'): number {
    const u = usage.value
    if (!u) return 0
    const item = u[resource]
    if (item.limit === -1) return 0
    if (item.limit === 0) return 100
    return Math.min(100, Math.round((item.current / item.limit) * 100))
  }

  return {
    billingStatus,
    plans,
    invoices,
    loading,
    error,
    initialized,
    currentPlan,
    currentPlanName,
    basePlan,
    basePlanName,
    subscriptionStatus,
    isTrialing,
    isActive,
    isPastDue,
    isCanceled,
    trialDaysRemaining,
    usage,
    features,
    fetchPlans,
    fetchStatus,
    fetchInvoices,
    startTrial,
    subscribe,
    cancelSubscription,
    reactivateSubscription,
    init,
    isPlanAtLeast,
    canUse,
    isAtLimit,
    usagePercent,
  }
})
