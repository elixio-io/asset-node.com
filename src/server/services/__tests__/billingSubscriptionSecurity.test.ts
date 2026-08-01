import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const Organization = {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
  }
  const qonto = {
    createClient: vi.fn(),
    createClientInvoice: vi.fn(),
    finalizeClientInvoice: vi.fn(),
    getClientInvoice: vi.fn(),
    getAttachment: vi.fn(),
    listClientInvoices: vi.fn(),
    cancelClientInvoice: vi.fn(),
  }
  return { Organization, qonto }
})

vi.mock('../../../models/Organization', () => ({ Organization: mocks.Organization }))
vi.mock('../qontoClient', () => mocks.qonto)
vi.mock('../../middleware/planLimits', () => ({ getOrgUsageSummary: vi.fn() }))
vi.mock('../emailService', () => ({
  sendInvoiceEmail: vi.fn(),
  sendTrialExpiringEmail: vi.fn(),
  sendTrialExpiredEmail: vi.fn(),
}))

const {
  activateSubscription,
  downgradeExpiredTrials,
  ensureQontoClient,
  flagPastDue,
  generateInvoice,
  startTrial,
} = await import('../billingService')
const { matchPayments } = await import('../paymentMatcher')

const ORG_ID = '64b000000000000000000001'

function orgQuery(value: unknown) {
  const promise = Promise.resolve(value)
  return {
    lean: vi.fn().mockResolvedValue(value),
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  }
}

function setOrg(value: unknown) {
  mocks.Organization.findById.mockImplementation(() => orgQuery(value))
}

describe('Billing subscription entitlement safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      slug: 'safe-org',
      billing: { status: 'free', qontoClientId: 'client-1', interval: 'monthly' },
    })
    mocks.Organization.findByIdAndUpdate.mockResolvedValue({})
    mocks.Organization.findOneAndUpdate.mockImplementation((_filter, update) => orgQuery({
      _id: ORG_ID,
      plan: 'free',
      slug: 'safe-org',
      billing: {
        status: 'free',
        qontoClientId: 'client-1',
        pendingPlan: update.$set['billing.pendingPlan'],
        pendingInterval: update.$set['billing.pendingInterval'],
        pendingState: update.$set['billing.pendingState'],
        pendingRequestId: update.$set['billing.pendingRequestId'],
        pendingLeaseExpiresAt: update.$set['billing.pendingLeaseExpiresAt'],
        pendingRequestedAt: update.$set['billing.pendingRequestedAt'],
        pendingPeriodStart: update.$set['billing.pendingPeriodStart'],
        pendingPeriodEnd: update.$set['billing.pendingPeriodEnd'],
      },
    }))
    mocks.Organization.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
    mocks.Organization.updateMany.mockResolvedValue({ modifiedCount: 0 })
    mocks.Organization.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })
    mocks.qonto.createClient.mockResolvedValue({ ok: true, data: { client: { id: 'client-1' } } })
    mocks.qonto.createClientInvoice.mockResolvedValue({ ok: true, data: { client_invoice: { id: 'invoice-1' } } })
    mocks.qonto.finalizeClientInvoice.mockResolvedValue({ ok: true, data: {} })
    mocks.qonto.listClientInvoices.mockResolvedValue({ ok: true, data: { client_invoices: [] } })
    mocks.qonto.cancelClientInvoice.mockResolvedValue({ ok: true, data: {} })
    mocks.qonto.getClientInvoice.mockResolvedValue({ ok: false, data: null })
  })

  it('throws when no Qonto client exists and does not mutate billing or plan state', async () => {
    setOrg({ _id: ORG_ID, plan: 'free', billing: { status: 'free' } })

    await expect(generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }))
      .rejects.toThrow('Qonto client is missing')

    expect(mocks.qonto.createClientInvoice).not.toHaveBeenCalled()
    expect(mocks.Organization.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('treats Qonto client creation failure as a hard error', async () => {
    setOrg({ _id: ORG_ID, slug: 'safe-org', billing: {} })
    mocks.qonto.createClient.mockResolvedValue({ ok: false, data: null, error: 'unavailable' })

    await expect(ensureQontoClient(ORG_ID, {
      companyName: 'Safe GmbH',
      email: 'billing@example.com',
      street: 'Street 1',
      city: 'Berlin',
      zipCode: '10115',
      countryCode: 'DE',
    })).rejects.toThrow('Qonto client creation failed')

    expect(mocks.Organization.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('does not persist a requested plan when invoice creation fails', async () => {
    mocks.qonto.createClientInvoice.mockResolvedValue({ ok: false, data: null, error: 'create failed' })

    await expect(generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }))
      .rejects.toThrow('invoice creation failed')

    const reservation = mocks.Organization.findOneAndUpdate.mock.calls[0]?.[1]
    expect(reservation.$set).not.toHaveProperty('plan')
    expect(reservation.$set).not.toHaveProperty('billing.status')
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: ORG_ID }),
      expect.objectContaining({ $set: expect.objectContaining({ 'billing.pendingState': 'failed' }) })
    )
  })

  it('does not persist a requested plan when invoice finalization fails', async () => {
    mocks.qonto.finalizeClientInvoice.mockResolvedValue({ ok: false, data: null, error: 'finalize failed' })

    await expect(generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }))
      .rejects.toThrow('invoice finalization failed')

    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: ORG_ID }),
      expect.objectContaining({ $set: expect.objectContaining({ 'billing.pendingState': 'failed' }) })
    )
  })

  it('stores only non-entitling pending metadata after invoice finalization', async () => {
    const result = await generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' })

    expect(result.status).toBe('awaiting_payment')
    expect(mocks.Organization.findOneAndUpdate).toHaveBeenCalledTimes(1)
    const reservation = mocks.Organization.findOneAndUpdate.mock.calls[0]?.[1]
    expect(reservation.$set).toMatchObject({
      'billing.pendingPlan': 'enterprise',
      'billing.pendingInterval': 'annual',
      'billing.pendingState': 'creating',
    })
    expect(reservation.$set).not.toHaveProperty('plan')
    expect(reservation.$set).not.toHaveProperty('billing.interval')
    expect(reservation.$set).not.toHaveProperty('billing.status')
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'billing.pendingRequestId': expect.any(String) }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'billing.pendingInvoiceId': 'invoice-1',
          'billing.pendingState': 'finalizing',
        })
      })
    )
  })

  it('returns the matching pending invoice on a subscribe retry without creating a duplicate', async () => {
    const periodStart = new Date('2026-07-21T12:00:00.000Z')
    const periodEnd = new Date('2027-07-21T12:00:00.000Z')
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      billing: {
        status: 'free',
        qontoClientId: 'client-1',
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingInvoiceId: 'invoice-existing',
        pendingState: 'awaiting_payment',
        pendingPeriodStart: periodStart,
        pendingPeriodEnd: periodEnd,
      },
    })

    const result = await generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' })

    expect(result).toMatchObject({
      invoiceId: 'invoice-existing',
      status: 'awaiting_payment',
      reused: true,
      periodStart,
      periodEnd,
    })
    expect(mocks.qonto.createClientInvoice).not.toHaveBeenCalled()
    expect(mocks.qonto.finalizeClientInvoice).not.toHaveBeenCalled()
    expect(mocks.Organization.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('refuses to replace a pending invoice with a different unpaid selection', async () => {
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      billing: {
        status: 'free',
        qontoClientId: 'client-1',
        pendingPlan: 'pro',
        pendingInterval: 'monthly',
        pendingInvoiceId: 'invoice-existing',
        pendingState: 'awaiting_payment',
      },
    })

    await expect(generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }))
      .rejects.toThrow('A different invoice is already awaiting payment')
    expect(mocks.qonto.createClientInvoice).not.toHaveBeenCalled()
  })

  it('atomically promotes exactly the plan and interval bound to the paid invoice', async () => {
    const periodStart = new Date('2026-07-21T12:00:00.000Z')
    const periodEnd = new Date('2027-07-21T12:00:00.000Z')
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      billing: {
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingInvoiceId: 'invoice-1',
        pendingState: 'awaiting_payment',
        pendingPeriodStart: periodStart,
        pendingPeriodEnd: periodEnd,
      },
    })

    const result = await activateSubscription(ORG_ID, 'invoice-1')

    expect(result).toMatchObject({ status: 'active', plan: 'enterprise', interval: 'annual' })
    expect(mocks.Organization.updateOne).toHaveBeenCalledTimes(1)
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      {
        _id: ORG_ID,
        'billing.pendingPlan': 'enterprise',
        'billing.pendingInterval': 'annual',
        'billing.pendingInvoiceId': 'invoice-1',
        $or: [
          { 'billing.pendingState': { $in: ['finalizing', 'awaiting_payment', 'overdue'] } },
          { 'billing.pendingState': { $exists: false } },
        ],
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          plan: 'enterprise',
          'billing.interval': 'annual',
          'billing.status': 'active',
          'billing.lastInvoiceId': 'invoice-1',
          'billing.currentPeriodStart': periodStart,
          'billing.currentPeriodEnd': periodEnd,
        }),
        $unset: expect.objectContaining({
          'billing.pendingPlan': 1,
          'billing.pendingInterval': 1,
          'billing.pendingInvoiceId': 1,
        }),
      })
    )
  })

  it('rejects a paid invoice that is not bound to the pending selection', async () => {
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      billing: {
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingInvoiceId: 'invoice-expected',
      },
    })

    await expect(activateSubscription(ORG_ID, 'invoice-attacker'))
      .rejects.toThrow('does not match a pending subscription')
    expect(mocks.Organization.updateOne).not.toHaveBeenCalled()
  })

  it('does not let the expiry cron overwrite a concurrent payment activation', async () => {
    const expiredAt = new Date('2026-07-20T12:00:00.000Z')
    mocks.Organization.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{
        _id: ORG_ID,
        plan: 'enterprise',
        billing: { status: 'trialing', trialEndsAt: expiredAt, lastPaymentAt: null },
      }]),
    })
    mocks.Organization.updateOne.mockResolvedValue({ modifiedCount: 0 })

    await expect(downgradeExpiredTrials()).resolves.toBe(0)

    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: ORG_ID,
        'billing.status': 'trialing',
        'billing.trialEndsAt': expect.any(Object),
        $or: [
          { 'billing.lastPaymentAt': { $exists: false } },
          { 'billing.lastPaymentAt': null },
        ],
      }),
      { $set: { plan: 'free', 'billing.status': 'free' } }
    )
  })

  it('reserves before Qonto so two concurrent subscribe calls create only one invoice', async () => {
    const state: any = {
      _id: ORG_ID,
      plan: 'free',
      slug: 'safe-org',
      billing: { status: 'free', qontoClientId: 'client-1', interval: 'monthly' },
    }
    const cloneState = () => structuredClone(state)
    const setPath = (path: string, value: unknown) => {
      const key = path.replace(/^billing\./, '')
      state.billing[key] = value
    }

    let initialReads = 0
    let releaseInitialReads!: () => void
    const bothInitialReads = new Promise<void>(resolve => { releaseInitialReads = resolve })
    mocks.Organization.findById.mockImplementation(() => ({
      lean: vi.fn(async () => {
        const snapshot = cloneState()
        initialReads++
        if (initialReads <= 2) {
          if (initialReads === 2) releaseInitialReads()
          await bothInitialReads
        }
        return snapshot
      }),
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockImplementation(async () => cloneState()) }),
    }))
    mocks.Organization.findOneAndUpdate.mockImplementation((_filter, update) => {
      if (state.billing.pendingRequestId) return orgQuery(null)
      for (const [path, value] of Object.entries(update.$set || {})) setPath(path, value)
      return orgQuery(cloneState())
    })
    mocks.Organization.updateOne.mockImplementation((_filter, update) => {
      for (const [path, value] of Object.entries(update.$set || {})) setPath(path, value)
      for (const path of Object.keys(update.$unset || {})) delete state.billing[path.replace(/^billing\./, '')]
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 })
    })

    const results = await Promise.all([
      generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }),
      generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }),
    ])

    expect(mocks.qonto.createClientInvoice).toHaveBeenCalledTimes(1)
    expect(mocks.qonto.finalizeClientInvoice).toHaveBeenCalledTimes(1)
    expect(results.every(result => ['processing', 'awaiting_payment'].includes(result.status))).toBe(true)
    expect(state.plan).toBe('free')
    expect(state.billing.status).toBe('free')
  })

  it('recovers a Qonto invoice created before the reservation was persisted', async () => {
    const requestedAt = new Date(Date.now() - 60_000)
    const periodStart = requestedAt
    const periodEnd = new Date('2027-07-21T12:00:00.000Z')
    const recoveringOrg = {
      _id: ORG_ID,
      plan: 'free',
      slug: 'safe-org',
      billing: {
        status: 'free',
        qontoClientId: 'client-1',
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingState: 'creating',
        pendingRequestId: 'request-recover-1',
        pendingRequestedAt: requestedAt,
        pendingLeaseExpiresAt: new Date(Date.now() - 1),
        pendingPeriodStart: periodStart,
        pendingPeriodEnd: periodEnd,
      },
    }
    setOrg(recoveringOrg)
    mocks.Organization.findOneAndUpdate.mockImplementation(() => orgQuery(recoveringOrg))
    mocks.qonto.listClientInvoices.mockResolvedValue({
      ok: true,
      data: { client_invoices: [{ id: 'invoice-recovered', purchase_order: 'AN-request-recover-1' }] },
    })

    const result = await generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' })

    expect(result).toMatchObject({ invoiceId: 'invoice-recovered', status: 'awaiting_payment' })
    expect(mocks.qonto.createClientInvoice).not.toHaveBeenCalled()
    expect(mocks.qonto.finalizeClientInvoice).toHaveBeenCalledWith('invoice-recovered')
  })

  it('cancels an overdue provider invoice before issuing its replacement', async () => {
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      slug: 'safe-org',
      billing: {
        status: 'free',
        qontoClientId: 'client-1',
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingState: 'overdue',
        pendingInvoiceId: 'invoice-overdue',
      },
    })

    await expect(generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }))
      .resolves.toMatchObject({ invoiceId: 'invoice-1', status: 'awaiting_payment' })

    expect(mocks.qonto.cancelClientInvoice).toHaveBeenCalledWith('invoice-overdue')
    expect(mocks.qonto.cancelClientInvoice.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.qonto.createClientInvoice.mock.invocationCallOrder[0])
  })

  it('activates a late-paid overdue invoice instead of issuing a replacement', async () => {
    const periodStart = new Date('2026-07-21T12:00:00.000Z')
    const periodEnd = new Date('2027-07-21T12:00:00.000Z')
    setOrg({
      _id: ORG_ID,
      plan: 'free',
      slug: 'safe-org',
      billing: {
        status: 'free',
        qontoClientId: 'client-1',
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingState: 'overdue',
        pendingInvoiceId: 'invoice-overdue',
        pendingPeriodStart: periodStart,
        pendingPeriodEnd: periodEnd,
      },
    })
    mocks.qonto.cancelClientInvoice.mockResolvedValue({ ok: false, data: null })
    mocks.qonto.getClientInvoice.mockResolvedValue({
      ok: true,
      data: { client_invoice: { id: 'invoice-overdue', status: 'paid' } },
    })

    await expect(generateInvoice(ORG_ID, { plan: 'enterprise', interval: 'annual' }))
      .resolves.toMatchObject({ status: 'active', reused: true })
    expect(mocks.qonto.createClientInvoice).not.toHaveBeenCalled()
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'billing.pendingInvoiceId': 'invoice-overdue' }),
      expect.objectContaining({ $set: expect.objectContaining({ plan: 'enterprise' }) })
    )
  })

  it('starts a trial with one compare-and-set winner and preserves unrelated billing metadata', async () => {
    const state: any = {
      _id: ORG_ID,
      plan: 'free',
      billing: { status: 'free', qontoClientId: 'client-1', taxCountry: 'DE' },
    }
    let won = false
    mocks.Organization.findOneAndUpdate.mockImplementation((_filter, update) => {
      if (won) return Promise.resolve(null)
      won = true
      for (const [path, value] of Object.entries(update.$set || {})) {
        if (path === 'plan') state.plan = value
        else state.billing[path.replace(/^billing\./, '')] = value
      }
      return Promise.resolve(structuredClone(state))
    })
    mocks.Organization.findById.mockImplementation(() => orgQuery(structuredClone(state)))

    const results = await Promise.allSettled([
      startTrial(ORG_ID, 'enterprise', 'annual'),
      startTrial(ORG_ID, 'enterprise', 'annual'),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(state.billing.qontoClientId).toBe('client-1')
    expect(state.billing.taxCountry).toBe('DE')
    const update = mocks.Organization.findOneAndUpdate.mock.calls[0]?.[1]
    expect(update.$set).not.toHaveProperty('billing')
    expect(update.$set).toHaveProperty('billing.trialStartedAt')
  })

  it('ends canceled access at period end and flags only non-canceled accounts after seven days', async () => {
    const now = new Date('2026-07-21T12:00:00.000Z')
    mocks.Organization.updateMany
      .mockResolvedValueOnce({ modifiedCount: 2 })
      .mockResolvedValueOnce({ modifiedCount: 3 })

    await expect(flagPastDue(now)).resolves.toBe(5)

    expect(mocks.Organization.updateMany).toHaveBeenNthCalledWith(1, {
      'billing.status': 'active',
      'billing.cancelAtPeriodEnd': true,
      'billing.currentPeriodEnd': { $lte: now },
    }, { $set: { 'billing.status': 'canceled' } })
    expect(mocks.Organization.updateMany).toHaveBeenNthCalledWith(2, {
      'billing.status': 'active',
      'billing.cancelAtPeriodEnd': { $ne: true },
      'billing.currentPeriodEnd': { $lte: new Date('2026-07-14T12:00:00.000Z') },
    }, { $set: { 'billing.status': 'past_due' } })
  })

  it('payment polling activates only the plan bound to the paid pending invoice', async () => {
    const periodStart = new Date('2026-07-21T12:00:00.000Z')
    const periodEnd = new Date('2027-07-21T12:00:00.000Z')
    const org = {
      _id: ORG_ID,
      slug: 'safe-org',
      plan: 'free',
      billing: {
        status: 'free',
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingState: 'awaiting_payment',
        pendingInvoiceId: 'invoice-paid',
        pendingPeriodStart: periodStart,
        pendingPeriodEnd: periodEnd,
      },
    }
    setOrg(org)
    mocks.Organization.find.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([org]) }),
    })
    mocks.qonto.getClientInvoice.mockResolvedValue({
      ok: true,
      data: { client_invoice: { id: 'invoice-paid', status: 'paid' } },
    })

    await expect(matchPayments()).resolves.toEqual({ checked: 1, activated: 1, overdue: 0 })
    expect(mocks.Organization.find).toHaveBeenCalledWith(expect.objectContaining({
      'billing.pendingInvoiceId': { $exists: true, $ne: null },
      'billing.pendingState': { $ne: 'canceled' },
    }))
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'billing.pendingInvoiceId': 'invoice-paid' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          plan: 'enterprise',
          'billing.status': 'active',
          'billing.currentPeriodEnd': periodEnd,
        })
      })
    )
  })

  it('payment polling records overdue state without changing current entitlements', async () => {
    const org = {
      _id: ORG_ID,
      slug: 'safe-org',
      plan: 'starter',
      billing: {
        status: 'active',
        pendingPlan: 'enterprise',
        pendingInterval: 'annual',
        pendingState: 'awaiting_payment',
        pendingInvoiceId: 'invoice-overdue',
      },
    }
    mocks.Organization.find.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([org]) }),
    })
    mocks.qonto.getClientInvoice.mockResolvedValue({
      ok: true,
      data: { client_invoice: { id: 'invoice-overdue', status: 'overdue' } },
    })

    await expect(matchPayments()).resolves.toEqual({ checked: 1, activated: 0, overdue: 1 })
    const update = mocks.Organization.updateOne.mock.calls[0]?.[1]
    expect(update.$set).toEqual({ 'billing.pendingState': 'overdue' })
    expect(update.$set).not.toHaveProperty('plan')
    expect(update.$set).not.toHaveProperty('billing.status')
  })
})
