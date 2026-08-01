
import { computed, onMounted } from 'vue'
import { useBillingStore, type PlanKey } from '../stores/billing'

export function usePlanLimits() {
  const billing = useBillingStore()

  onMounted(() => {
    billing.init()
  })

  return {
    currentPlan: computed(() => billing.currentPlan),
    currentPlanName: computed(() => billing.currentPlanName),
    subscriptionStatus: computed(() => billing.subscriptionStatus),
    isTrialing: computed(() => billing.isTrialing),
    isActive: computed(() => billing.isActive),
    isPastDue: computed(() => billing.isPastDue),
    isCanceled: computed(() => billing.isCanceled),
    trialDaysRemaining: computed(() => billing.trialDaysRemaining),
    usage: computed(() => billing.usage),
    loading: computed(() => billing.loading),



    canUse: (feature: 'api' | 'scim' | 'sso') => billing.canUse(feature),

    isPlanAtLeast: (plan: PlanKey) => billing.isPlanAtLeast(plan),

    isAtLimit: (resource: 'assets' | 'users' | 'integrations' | 'workflows' | 'customFields') =>
      billing.isAtLimit(resource),

    usagePercent: (resource: 'assets' | 'users' | 'integrations' | 'workflows' | 'customFields') =>
      billing.usagePercent(resource),

    refresh: () => billing.fetchStatus(),
  }
}
