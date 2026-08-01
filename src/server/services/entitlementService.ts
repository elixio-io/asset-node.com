import type { PlanKey } from '../config/plans'

export interface PlanAccessOverride {
  plan: PlanKey
  grantedAt: Date
  expiresAt: Date
  grantedBy?: string
  reason?: string
}

const DAY_MS = 24 * 60 * 60 * 1000
export const PAID_ACCESS_GRACE_MS = 7 * DAY_MS

export function buildPlanAccessOverride(
  plan: PlanKey,
  days: number,
  options: {
    now?: Date
    currentExpiresAt?: Date | string | null
    grantedBy?: string
    reason?: string
  } = {}
): PlanAccessOverride {
  const now = options.now ?? new Date()
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)))
  const currentExpiry = options.currentExpiresAt ? new Date(options.currentExpiresAt) : null
  const extensionBase = currentExpiry && currentExpiry > now ? currentExpiry : now

  return {
    plan,
    grantedAt: now,
    expiresAt: new Date(extensionBase.getTime() + safeDays * DAY_MS),
    ...(options.grantedBy ? { grantedBy: options.grantedBy } : {}),
    ...(options.reason ? { reason: options.reason } : {})
  }
}

export function getActivePlanOverride(billing: any, now = new Date()): PlanAccessOverride | null {
  const override = billing?.accessOverride
  if (!override?.plan || !override?.expiresAt) return null

  const expiresAt = new Date(override.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return null

  return {
    plan: override.plan as PlanKey,
    grantedAt: override.grantedAt ? new Date(override.grantedAt) : now,
    expiresAt,
    ...(override.grantedBy ? { grantedBy: String(override.grantedBy) } : {}),
    ...(override.reason ? { reason: String(override.reason) } : {})
  }
}

export function resolveEffectivePlan(basePlan: PlanKey | null | undefined, billing: any, now = new Date()): PlanKey {
  const activeOverride = getActivePlanOverride(billing, now)
  if (activeOverride) return activeOverride.plan

  const status = billing?.status
  if (status === 'trialing') {
    if (!billing.trialEndsAt) return 'free'
    const trialEndsAt = new Date(billing.trialEndsAt)
    if (Number.isNaN(trialEndsAt.getTime()) || trialEndsAt <= now) return 'free'
    return basePlan || 'free'
  }

  if (status === 'active' || status === 'canceled') {
    if (!billing.currentPeriodEnd) return 'free'
    const periodEnd = new Date(billing.currentPeriodEnd)
    if (Number.isNaN(periodEnd.getTime())) return 'free'




    const accessEndsAt = status === 'canceled' || billing.cancelAtPeriodEnd === true
      ? periodEnd
      : new Date(periodEnd.getTime() + PAID_ACCESS_GRACE_MS)
    return now < accessEndsAt ? (basePlan || 'free') : 'free'
  }



  if (status === undefined || status === null) return basePlan || 'free'
  return 'free'
}
