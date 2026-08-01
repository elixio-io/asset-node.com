import { describe, expect, it } from 'vitest'
import {
  buildPlanAccessOverride,
  getActivePlanOverride,
  resolveEffectivePlan
} from '../services/entitlementService'

describe('Enterprise access overrides', () => {
  const now = new Date('2026-07-21T12:00:00.000Z')

  it('grants exactly 30 days without changing subscription data', () => {
    const billing = {
      status: 'active',
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      lastInvoiceId: 'invoice-123'
    }
    const override = buildPlanAccessOverride('enterprise', 30, {
      now,
      grantedBy: 'admin-1',
      reason: 'super_admin_unlock'
    })

    expect(override.expiresAt.toISOString()).toBe('2026-08-20T12:00:00.000Z')
    expect(resolveEffectivePlan('starter', { ...billing, accessOverride: override }, now)).toBe('enterprise')
    expect(billing).toEqual({
      status: 'active',
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      lastInvoiceId: 'invoice-123'
    })
  })

  it('also unlocks a past-due organization while preserving its billing status', () => {
    const billing = {
      status: 'past_due',
      accessOverride: buildPlanAccessOverride('enterprise', 30, { now })
    }

    expect(resolveEffectivePlan('pro', billing, now)).toBe('enterprise')
    expect(billing.status).toBe('past_due')
  })

  it('extends an active grant from its current expiry instead of shortening it', () => {
    const override = buildPlanAccessOverride('enterprise', 30, {
      now,
      currentExpiresAt: '2026-08-20T12:00:00.000Z'
    })

    expect(override.expiresAt.toISOString()).toBe('2026-09-19T12:00:00.000Z')
  })

  it('falls back to the paid plan after an override expires', () => {
    const billing = {
      status: 'active',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z',
      accessOverride: {
        plan: 'enterprise',
        grantedAt: '2026-06-01T00:00:00.000Z',
        expiresAt: '2026-07-21T11:59:59.000Z'
      }
    }

    expect(getActivePlanOverride(billing, now)).toBeNull()
    expect(resolveEffectivePlan('starter', billing, now)).toBe('starter')
  })

  it('keeps a live Enterprise registration trial and expires it to Free', () => {
    const trialing = {
      status: 'trialing',
      trialStartedAt: '2026-07-01T00:00:00.000Z',
      trialEndsAt: '2026-07-31T00:00:00.000Z'
    }

    expect(resolveEffectivePlan('enterprise', trialing, now)).toBe('enterprise')
    expect(resolveEffectivePlan('enterprise', trialing, new Date('2026-07-31T00:00:00.000Z'))).toBe('free')
  })

  it('never treats an unpaid pending plan as an entitlement', () => {
    const pendingEnterprise = {
      status: 'free',
      pendingPlan: 'enterprise',
      pendingInterval: 'annual',
      pendingInvoiceId: 'invoice-unpaid'
    }

    expect(resolveEffectivePlan('free', pendingEnterprise, now)).toBe('free')
    expect(resolveEffectivePlan('starter', {
      ...pendingEnterprise,
      status: 'active',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z'
    }, now)).toBe('starter')
  })

  it('fails closed for every explicit non-active billing state', () => {
    expect(resolveEffectivePlan('enterprise', { status: 'free' }, now)).toBe('free')
    expect(resolveEffectivePlan('enterprise', { status: 'past_due' }, now)).toBe('free')
    expect(resolveEffectivePlan('enterprise', { status: 'canceled' }, now)).toBe('free')
    expect(resolveEffectivePlan('enterprise', { status: 'trialing' }, now)).toBe('free')
    expect(resolveEffectivePlan('enterprise', { status: 'trialing', trialEndsAt: 'not-a-date' }, now)).toBe('free')
  })

  it('allows active and valid trial plans and preserves legacy records without a status', () => {
    expect(resolveEffectivePlan('pro', {
      status: 'active',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z'
    }, now)).toBe('pro')
    expect(resolveEffectivePlan('pro', {
      status: 'trialing',
      trialEndsAt: '2026-07-22T12:00:00.000Z'
    }, now)).toBe('pro')
    expect(resolveEffectivePlan('starter', {}, now)).toBe('starter')
  })

  it('grants a non-canceled paid subscription at most seven days of grace', () => {
    const periodEnd = '2026-07-21T00:00:00.000Z'

    expect(resolveEffectivePlan('pro', { status: 'active', currentPeriodEnd: periodEnd },
      new Date('2026-07-27T23:59:59.999Z'))).toBe('pro')
    expect(resolveEffectivePlan('pro', { status: 'active', currentPeriodEnd: periodEnd },
      new Date('2026-07-28T00:00:00.000Z'))).toBe('free')
  })

  it('ends canceled and cancel-at-period-end access exactly at the paid period boundary', () => {
    const periodEnd = '2026-07-22T00:00:00.000Z'

    expect(resolveEffectivePlan('pro', { status: 'canceled', currentPeriodEnd: periodEnd }, now)).toBe('pro')
    expect(resolveEffectivePlan('pro', {
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd
    }, now)).toBe('pro')
    expect(resolveEffectivePlan('pro', { status: 'canceled', currentPeriodEnd: periodEnd },
      new Date(periodEnd))).toBe('free')
    expect(resolveEffectivePlan('pro', {
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd
    }, new Date(periodEnd))).toBe('free')
  })

  it('fails closed when an explicit paid state has no valid period end', () => {
    expect(resolveEffectivePlan('enterprise', { status: 'active' }, now)).toBe('free')
    expect(resolveEffectivePlan('enterprise', { status: 'active', currentPeriodEnd: 'invalid' }, now)).toBe('free')
    expect(resolveEffectivePlan('enterprise', { status: 'canceled' }, now)).toBe('free')
  })

  it('keeps a live support override ahead of a malformed trial state', () => {
    const billing = {
      status: 'trialing',
      accessOverride: buildPlanAccessOverride('enterprise', 30, { now })
    }
    expect(resolveEffectivePlan('free', billing, now)).toBe('enterprise')
  })

  it('clamps support grants to the supported 1-365 day range', () => {
    expect(buildPlanAccessOverride('enterprise', 0, { now }).expiresAt.toISOString()).toBe('2026-07-22T12:00:00.000Z')
    expect(buildPlanAccessOverride('enterprise', 999, { now }).expiresAt.toISOString()).toBe('2027-07-21T12:00:00.000Z')
  })
})
