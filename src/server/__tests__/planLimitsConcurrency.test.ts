import { beforeEach, describe, expect, it, vi } from 'vitest'

const organization = vi.hoisted(() => ({
  findById: vi.fn(),
  updateOne: vi.fn(),
}))

vi.mock('../../models/Organization', () => ({ Organization: organization }))

const { requirePlan } = await import('../middleware/planLimits')

function query(value: unknown) {
  return {
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
  }
}

describe('Plan-limit trial expiry concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('re-reads entitlements when a concurrent payment wins the downgrade CAS', async () => {
    const orgId = '64b000000000000000000001'
    const expiredTrial = {
      _id: orgId,
      plan: 'enterprise',
      billing: {
        status: 'trialing',
        trialEndsAt: new Date(Date.now() - 60_000),
        lastPaymentAt: null,
      },
    }
    const paidSubscription = {
      _id: orgId,
      plan: 'enterprise',
      billing: {
        status: 'active',
        lastPaymentAt: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }
    organization.findById
      .mockImplementationOnce(() => query(expiredTrial))
      .mockImplementationOnce(() => query(paidSubscription))
    organization.updateOne.mockResolvedValue({ modifiedCount: 0 })

    const send = vi.fn()
    const code = vi.fn().mockReturnValue({ send })
    const handler = requirePlan('enterprise')
    await handler({ user: { orgId } } as any, { code } as any)

    expect(organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: orgId,
        'billing.status': 'trialing',
        $or: [
          { 'billing.lastPaymentAt': { $exists: false } },
          { 'billing.lastPaymentAt': null },
        ],
      }),
      { $set: { plan: 'free', 'billing.status': 'free' } }
    )
    expect(organization.findById).toHaveBeenCalledTimes(2)
    expect(code).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
