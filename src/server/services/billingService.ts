
import crypto from 'crypto'
import { Organization } from '../../models/Organization'
import { type PlanKey, PLANS, PLAN_ORDER } from '../config/plans'
import { getOrgUsageSummary } from '../middleware/planLimits'
import * as qonto from './qontoClient'
import { sendInvoiceEmail, sendTrialExpiringEmail, sendTrialExpiredEmail } from './emailService'
import { getActivePlanOverride, resolveEffectivePlan } from './entitlementService'

export const DEFAULT_ENTERPRISE_TRIAL_DAYS = 30

export function buildTrialPeriod(days: number, now = new Date()) {
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)))
  return {
    status: 'trialing' as const,
    interval: 'monthly' as const,
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000),
    trialWarningsSent: [] as string[],
    guidanceEmailsSent: [] as string[],
    cancelAtPeriodEnd: false,
    canceledAt: null,
  }
}


function getSigningKey(): string {
  return process.env.JWT_SECRET || 'dev-jwt-secret-not-for-production-use-change-in-prod'
}

export function signInvoiceToken(invoiceId: string, orgId: string): string {
  const payload = Buffer.from(JSON.stringify({ invoiceId, orgId })).toString('base64url')
  const sig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyInvoiceToken(token: string, expectedOrgId: string): string | null {
  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return null

  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const { invoiceId, orgId } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (orgId !== expectedOrgId) return null
    return invoiceId
  } catch {
    return null
  }
}


export async function ensureQontoClient(
  orgId: string,
  billingInfo: {
    companyName: string
    email: string
    street: string
    city: string
    zipCode: string
    countryCode: string
    vatNumber?: string
  }
): Promise<string> {
  const org = await Organization.findById(orgId).lean()
  if (!org) throw new Error('Organization not found')

  const billing = (org as any).billing || {}

  if (billing.qontoClientId) {
    return billing.qontoClientId
  }

  const result = await qonto.createClient({
    name: billingInfo.companyName,
    type: 'company',
    email: billingInfo.email,
    currency: 'EUR',
    locale: 'de',
    billing_address: {
      street: billingInfo.street,
      city: billingInfo.city,
      zip_code: billingInfo.zipCode,
      country_code: billingInfo.countryCode,
    },
    ...(billingInfo.vatNumber ? { vat_number: billingInfo.vatNumber } : {}),
  })

  if (!result.ok || !result.data?.client?.id) {
    console.error('[Billing] Failed to create Qonto client:', result.error)
    throw new Error('Qonto client creation failed. No subscription was changed.')
  }

  const clientId = result.data.client.id

  await Organization.findByIdAndUpdate(orgId, {
    'billing.qontoClientId': clientId,
  })

  console.log(`[Billing] Created Qonto client ${clientId} for org ${(org as any).slug}`)
  return clientId
}


export async function startTrial(orgId: string, plan: PlanKey, interval: 'monthly' | 'annual' = 'monthly') {
  const planDef = PLANS[plan]
  if (!planDef || plan === 'free' || planDef.trialDays === 0) {
    throw new Error(`Plan "${plan}" does not offer a trial.`)
  }

  const trial = buildTrialPeriod(planDef.trialDays)
  const updated = await Organization.findOneAndUpdate({
    _id: orgId,
    'billing.trialStartedAt': { $exists: false },
    'billing.status': { $nin: ['active', 'past_due', 'trialing'] },
    'billing.pendingInvoiceId': { $exists: false },
  }, {
    $set: {
      plan,
      'billing.status': trial.status,
      'billing.interval': interval,
      'billing.trialStartedAt': trial.trialStartedAt,
      'billing.trialEndsAt': trial.trialEndsAt,
      'billing.trialWarningsSent': [],
      'billing.guidanceEmailsSent': [],
      'billing.cancelAtPeriodEnd': false,
    },
    $unset: {
      'billing.canceledAt': 1,
    }
  }, { new: true })

  if (!updated) {
    const current = await Organization.findById(orgId).select('billing').lean() as any
    if (!current) throw new Error('Organization not found')
    if (current.billing?.trialStartedAt || current.billing?.status === 'trialing') {
      throw new Error('This organization has already used its free trial.')
    }
    if (current.billing?.status === 'active' || current.billing?.status === 'past_due') {
      throw new Error('Cannot start a trial while a subscription is active or past due.')
    }
    if (current.billing?.pendingInvoiceId) {
      throw new Error('Cannot start a trial while an invoice is pending.')
    }
    throw new Error('Trial could not be started because the organization changed concurrently.')
  }

  return {
    plan,
    status: 'trialing',
    trialStartedAt: trial.trialStartedAt,
    trialEndsAt: trial.trialEndsAt,
    daysRemaining: planDef.trialDays,
  }
}


export interface SubscriptionInvoiceSelection {
  plan: Exclude<PlanKey, 'free'>
  interval: 'monthly' | 'annual'
}

const INVOICE_RESERVATION_LEASE_MS = 10 * 60 * 1000
const QONTO_IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000

function invoicePurchaseOrder(requestId: string) {
  return `AN-${requestId}`
}

function pendingInvoiceResult(billing: any, amountCents: number) {
  const pendingState = billing.pendingState || (billing.pendingInvoiceId ? 'awaiting_payment' : 'processing')
  return {
    invoiceId: billing.pendingInvoiceId || null,
    requestId: billing.pendingRequestId,
    amountCents,
    periodStart: billing.pendingPeriodStart,
    periodEnd: billing.pendingPeriodEnd,
    status: ['awaiting_payment', 'overdue', 'canceled'].includes(pendingState)
      ? pendingState as 'awaiting_payment' | 'overdue' | 'canceled'
      : 'processing' as const,
    reused: true,
  }
}

function reservationFields(
  requestId: string,
  plan: Exclude<PlanKey, 'free'>,
  interval: 'monthly' | 'annual',
  now: Date,
  periodEnd: Date
) {
  return {
    'billing.pendingPlan': plan,
    'billing.pendingInterval': interval,
    'billing.pendingState': 'creating',
    'billing.pendingRequestId': requestId,
    'billing.pendingLeaseExpiresAt': new Date(now.getTime() + INVOICE_RESERVATION_LEASE_MS),
    'billing.pendingRequestedAt': now,
    'billing.pendingPeriodStart': now,
    'billing.pendingPeriodEnd': periodEnd,
  }
}

async function markInvoiceRequestFailed(orgId: string, requestId: string, code: string) {
  await Organization.updateOne({
    _id: orgId,
    'billing.pendingRequestId': requestId,
  }, {
    $set: {
      'billing.pendingState': 'failed',
      'billing.pendingFailureAt': new Date(),
      'billing.pendingFailureCode': code,
    },
    $unset: { 'billing.pendingLeaseExpiresAt': 1 }
  })
}

async function findReservedQontoInvoice(billing: any) {
  const requestedAt = billing.pendingRequestedAt ? new Date(billing.pendingRequestedAt) : null
  if (!requestedAt || Number.isNaN(requestedAt.getTime()) || !billing.pendingRequestId) return null

  const result = await qonto.listClientInvoices({
    'filter[created_at_from]': new Date(requestedAt.getTime() - 60_000).toISOString(),
    'filter[created_at_to]': new Date(requestedAt.getTime() + QONTO_IDEMPOTENCY_WINDOW_MS).toISOString(),
    per_page: '100',
    sort_by: 'created_at:desc',
  })
  if (!result.ok) return null
  return (result.data?.client_invoices || []).find((invoice: any) =>
    invoice.purchase_order === invoicePurchaseOrder(billing.pendingRequestId)
  ) || null
}

async function executeInvoiceReservation(orgId: string, org: any, recovering: boolean) {
  const billing = org.billing || {}
  const plan = billing.pendingPlan as Exclude<PlanKey, 'free'>
  const interval = billing.pendingInterval as 'monthly' | 'annual'
  const requestId = String(billing.pendingRequestId || '')
  const planDef = PLANS[plan]
  if (!requestId || !planDef?.pricing || !billing.qontoClientId) {
    throw new Error('Invoice reservation is incomplete and cannot be processed safely.')
  }

  const amountCents = interval === 'annual' ? planDef.pricing.annual : planDef.pricing.monthly
  const amountEur = (amountCents / 100).toFixed(2)
  const periodLabel = interval === 'annual' ? 'Jahresabonnement' : 'Monatsabonnement'
  const periodStart = new Date(billing.pendingPeriodStart)
  const periodEnd = new Date(billing.pendingPeriodEnd)
  const dueDate = new Date(periodStart.getTime() + 14 * 24 * 60 * 60 * 1000)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  let qontoInvoiceId = billing.pendingInvoiceId as string | undefined
  if (!qontoInvoiceId && recovering) {
    const recovered = await findReservedQontoInvoice(billing)
    qontoInvoiceId = recovered?.id



    const age = Date.now() - new Date(billing.pendingRequestedAt).getTime()
    if (!qontoInvoiceId && age >= QONTO_IDEMPOTENCY_WINDOW_MS) {
      await markInvoiceRequestFailed(orgId, requestId, 'RECOVERY_REVIEW_REQUIRED')
      throw new Error('Invoice recovery requires review before another invoice can be issued.')
    }
  }

  if (!qontoInvoiceId) {
    const netAmountCents = Math.round(amountCents / 1.19)
    const createResult = await qonto.createClientInvoice({
      client_id: billing.qontoClientId,
      due_date: dueDateStr,
      purchase_order: invoicePurchaseOrder(requestId),
      terms: 'Zahlbar innerhalb von 14 Tagen per SEPA-Überweisung.',
      items: [{
        title: `AssetNode ${planDef.name} — ${periodLabel}`,
        description: `Abrechnungszeitraum: ${periodStart.toLocaleDateString('de-DE')} – ${periodEnd.toLocaleDateString('de-DE')}`,
        quantity: 1,
        unit_price: {
          value: (netAmountCents / 100).toFixed(2),
          currency: 'EUR',
        },
        vat_rate: '0.19',
      }],
    }, requestId)

    if (!createResult.ok || !createResult.data?.client_invoice?.id) {
      await markInvoiceRequestFailed(orgId, requestId, 'QONTO_CREATE_FAILED')
      console.error('[Billing] Failed to create Qonto invoice:', createResult.error)
      throw new Error('Qonto invoice creation failed. No subscription was changed.')
    }
    qontoInvoiceId = createResult.data.client_invoice.id

    const recorded = await Organization.updateOne({
      _id: orgId,
      'billing.pendingRequestId': requestId,
      'billing.pendingState': { $in: ['creating', 'failed'] },
    }, {
      $set: {
        'billing.pendingInvoiceId': qontoInvoiceId,
        'billing.pendingState': 'finalizing',
        'billing.lastQontoInvoiceId': qontoInvoiceId,
      },
      $unset: {
        'billing.pendingFailureAt': 1,
        'billing.pendingFailureCode': 1,
      }
    })
    if (recorded.modifiedCount !== 1) {
      throw new Error('Invoice was created but its reservation changed; recovery is required.')
    }
  }

  const finalizeResult = await qonto.finalizeClientInvoice(qontoInvoiceId)
  if (!finalizeResult.ok) {
    const current = await qonto.getClientInvoice(qontoInvoiceId)
    const currentStatus = current.data?.client_invoice?.status?.toLowerCase()
    if (!current.ok || !['unpaid', 'paid'].includes(currentStatus)) {
      await markInvoiceRequestFailed(orgId, requestId, 'QONTO_FINALIZE_FAILED')
      console.error('[Billing] Failed to finalize invoice:', finalizeResult.error)
      throw new Error('Qonto invoice finalization failed. No subscription was changed.')
    }
  }

  const finalized = await Organization.updateOne({
    _id: orgId,
    'billing.pendingRequestId': requestId,
    'billing.pendingInvoiceId': qontoInvoiceId,
  }, {
    $set: {
      'billing.pendingState': 'awaiting_payment',
      'billing.lastQontoInvoiceId': qontoInvoiceId,
    },
    $unset: {
      'billing.pendingLeaseExpiresAt': 1,
      'billing.pendingFailureAt': 1,
      'billing.pendingFailureCode': 1,
    }
  })
  if (finalized.modifiedCount !== 1) {
    throw new Error('Invoice finalization could not be attached to its reservation.')
  }

  emailInvoiceToAdmin(orgId, qontoInvoiceId, planDef.name, amountEur, periodLabel)
    .catch(err => console.error('[Billing] Invoice email failed:', err))

  return {
    invoiceId: qontoInvoiceId,
    requestId,
    amountCents,
    periodStart,
    periodEnd,
    status: 'awaiting_payment' as const,
  }
}

async function reserveReplacementAfterCanceledInvoice(
  orgId: string,
  billing: any,
  plan: Exclude<PlanKey, 'free'>,
  interval: 'monthly' | 'annual'
) {
  const oldInvoiceId = billing.pendingInvoiceId as string | undefined
  if (billing.pendingState === 'overdue' && oldInvoiceId) {
    const canceled = await qonto.cancelClientInvoice(oldInvoiceId)
    if (!canceled.ok) {
      const current = await qonto.getClientInvoice(oldInvoiceId)
      const currentStatus = current.data?.client_invoice?.status?.toLowerCase()
      if (current.ok && currentStatus === 'paid') {
        await activateSubscription(orgId, oldInvoiceId)
        return { activated: true as const }
      }
      if (!current.ok || currentStatus !== 'canceled') {
        throw new Error('The overdue invoice could not be canceled safely; no replacement was issued.')
      }
    }
  }

  const now = new Date()
  const periodEnd = new Date(now)
  interval === 'annual'
    ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    : periodEnd.setMonth(periodEnd.getMonth() + 1)
  const requestId = crypto.randomUUID()
  const replacement = await Organization.findOneAndUpdate({
    _id: orgId,
    'billing.pendingInvoiceId': oldInvoiceId,
    'billing.pendingState': { $in: ['overdue', 'canceled'] },
  }, {
    ...(oldInvoiceId ? { $addToSet: { 'billing.supersededInvoiceIds': oldInvoiceId } } : {}),
    $set: reservationFields(requestId, plan, interval, now, periodEnd),
    $unset: {
      'billing.pendingInvoiceId': 1,
      'billing.pendingFailureAt': 1,
      'billing.pendingFailureCode': 1,
    }
  }, { new: true }).select('plan billing slug').lean() as any
  if (!replacement) throw new Error('Pending invoice changed while a replacement was being reserved.')
  return { org: replacement, recovering: false as const }
}

export async function generateInvoice(orgId: string, selection?: SubscriptionInvoiceSelection) {
  let org = await Organization.findById(orgId).lean() as any
  if (!org) throw new Error('Organization not found')

  let billing = org.billing || {}
  const plan = (selection?.plan || org.plan) as Exclude<PlanKey, 'free'>
  const planDef = PLANS[plan]
  if (!planDef?.pricing) throw new Error('Cannot invoice for the free plan.')

  const interval = (selection?.interval || billing.interval || 'monthly') as 'monthly' | 'annual'
  const amountCents = interval === 'annual' ? planDef.pricing.annual : planDef.pricing.monthly
  if (!billing.qontoClientId) {
    throw new Error('Qonto client is missing. No subscription was changed.')
  }

  const pendingState = billing.pendingState || (billing.pendingInvoiceId ? 'awaiting_payment' : undefined)
  if (pendingState === 'awaiting_payment') {
    if (billing.pendingPlan === plan && billing.pendingInterval === interval) {
      return pendingInvoiceResult(billing, amountCents)
    }
    throw new Error('A different invoice is already awaiting payment for this organization.')
  }

  if (pendingState === 'overdue' || pendingState === 'canceled') {
    const replacement = await reserveReplacementAfterCanceledInvoice(orgId, billing, plan, interval)
    if ('activated' in replacement) {
      return { status: 'active' as const, reused: true }
    }
    return executeInvoiceReservation(orgId, replacement.org, replacement.recovering)
  }

  if (['creating', 'finalizing', 'failed'].includes(pendingState)) {
    if (billing.pendingPlan !== plan || billing.pendingInterval !== interval) {
      throw new Error('A different invoice request is already in progress for this organization.')
    }
    const leaseExpiresAt = billing.pendingLeaseExpiresAt ? new Date(billing.pendingLeaseExpiresAt) : null
    if (pendingState !== 'failed' && leaseExpiresAt && leaseExpiresAt > new Date()) {
      return pendingInvoiceResult(billing, amountCents)
    }

    const recovered = await Organization.findOneAndUpdate({
      _id: orgId,
      'billing.pendingRequestId': billing.pendingRequestId,
      'billing.pendingState': pendingState,
    }, {
      $set: {
        'billing.pendingState': billing.pendingInvoiceId ? 'finalizing' : 'creating',
        'billing.pendingLeaseExpiresAt': new Date(Date.now() + INVOICE_RESERVATION_LEASE_MS),
      },
      $unset: {
        'billing.pendingFailureAt': 1,
        'billing.pendingFailureCode': 1,
      }
    }, { new: true }).select('plan billing slug').lean() as any
    if (!recovered) throw new Error('Invoice recovery is already running in another request.')
    return executeInvoiceReservation(orgId, recovered, true)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  interval === 'annual'
    ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    : periodEnd.setMonth(periodEnd.getMonth() + 1)
  const requestId = crypto.randomUUID()
  const reserved = await Organization.findOneAndUpdate({
    _id: orgId,
    'billing.qontoClientId': billing.qontoClientId,
    $and: [
      { $or: [
        { 'billing.pendingRequestId': { $exists: false } },
        { 'billing.pendingRequestId': null },
      ] },
      { $or: [
        { 'billing.pendingInvoiceId': { $exists: false } },
        { 'billing.pendingInvoiceId': null },
      ] },
    ]
  }, {
    $set: reservationFields(requestId, plan, interval, now, periodEnd),
    $unset: {
      'billing.pendingFailureAt': 1,
      'billing.pendingFailureCode': 1,
    }
  }, { new: true }).select('plan billing slug').lean() as any

  if (!reserved) {


    org = await Organization.findById(orgId).lean() as any
    if (!org) throw new Error('Organization not found')
    billing = org.billing || {}
    if (billing.pendingPlan === plan && billing.pendingInterval === interval) {
      return pendingInvoiceResult(billing, amountCents)
    }
    throw new Error('A different invoice request was reserved concurrently.')
  }

  return executeInvoiceReservation(orgId, reserved, false)
}

async function emailInvoiceToAdmin(
  orgId: string,
  invoiceId: string,
  planName: string,
  amountEur: string,
  periodLabel: string
) {
  const invoiceResult = await qonto.getClientInvoice(invoiceId)
  if (!invoiceResult.ok) return

  const invoice = invoiceResult.data?.client_invoice
  const attachmentId = invoice?.attachment_id || invoice?.file_url

  let downloadUrl = ''
  if (attachmentId && typeof attachmentId === 'string') {
    const attachResult = await qonto.getAttachment(attachmentId)
    if (attachResult.ok && attachResult.data?.attachment?.url) {
      downloadUrl = attachResult.data.attachment.url
    }
  }

  const { User } = await import('../../models/User')
  const org = await Organization.findById(orgId).lean() as any
  if (!org) return

  const admin = await User.findOne({ orgId, role: 'admin' }).lean() as any
  if (!admin?.email) return

  await sendInvoiceEmail(
    admin.email,
    admin.firstName || 'Nutzer',
    planName,
    amountEur,
    periodLabel,
    downloadUrl || undefined
  )
}


export async function activateSubscription(orgId: string, invoiceId?: string) {
  if (!invoiceId) throw new Error('A paid invoice ID is required to activate a subscription.')

  const org = await Organization.findById(orgId)
    .select('billing.pendingPlan billing.pendingInterval billing.pendingInvoiceId billing.pendingState billing.pendingRequestId billing.pendingPeriodStart billing.pendingPeriodEnd')
    .lean() as any
  if (!org) throw new Error('Organization not found')

  const billing = org.billing || {}
  const pendingPlan = billing.pendingPlan as PlanKey | undefined
  const pendingInterval = billing.pendingInterval as 'monthly' | 'annual' | undefined
  const periodStart = new Date(billing.pendingPeriodStart)
  const periodEnd = new Date(billing.pendingPeriodEnd)
  if (
    !pendingPlan || pendingPlan === 'free' || !pendingInterval ||
    billing.pendingInvoiceId !== invoiceId ||
    billing.pendingState === 'canceled' ||
    Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())
  ) {
    throw new Error('Paid invoice does not match a pending subscription.')
  }

  const now = new Date()
  const result = await Organization.updateOne({
    _id: orgId,
    'billing.pendingPlan': pendingPlan,
    'billing.pendingInterval': pendingInterval,
    'billing.pendingInvoiceId': invoiceId,
    $or: [
      { 'billing.pendingState': { $in: ['finalizing', 'awaiting_payment', 'overdue'] } },
      { 'billing.pendingState': { $exists: false } },
    ]
  }, {
    $set: {
      plan: pendingPlan,
      'billing.interval': pendingInterval,
      'billing.status': 'active',
      'billing.lastPaymentAt': now,
      'billing.lastInvoiceId': invoiceId,
      'billing.currentPeriodStart': periodStart,
      'billing.currentPeriodEnd': periodEnd,
      'billing.cancelAtPeriodEnd': false,
      'billing.canceledAt': null,
    },
    $unset: {
      'billing.pendingPlan': 1,
      'billing.pendingInterval': 1,
      'billing.pendingInvoiceId': 1,
      'billing.pendingState': 1,
      'billing.pendingRequestId': 1,
      'billing.pendingLeaseExpiresAt': 1,
      'billing.pendingRequestedAt': 1,
      'billing.pendingPeriodStart': 1,
      'billing.pendingPeriodEnd': 1,
      'billing.pendingFailureAt': 1,
      'billing.pendingFailureCode': 1,
    }
  })

  if (result.modifiedCount !== 1) {
    throw new Error('Pending subscription changed before payment activation could complete.')
  }

  return { status: 'active', plan: pendingPlan, interval: pendingInterval, activatedAt: now }
}


export async function cancelSubscription(orgId: string) {
  const org = await Organization.findById(orgId).lean()
  if (!org) throw new Error('Organization not found')

  const billing = (org as any).billing || {}

  if (billing.status === 'free') {
    throw new Error('No active subscription to cancel.')
  }

  await Organization.findByIdAndUpdate(orgId, {
    'billing.cancelAtPeriodEnd': true,
    'billing.canceledAt': new Date(),
  })

  return {
    canceledAt: new Date(),
    accessUntil: billing.currentPeriodEnd || billing.trialEndsAt,
  }
}

export async function reactivateSubscription(orgId: string) {
  await Organization.findByIdAndUpdate(orgId, {
    'billing.cancelAtPeriodEnd': false,
    'billing.canceledAt': null,
  })

  return { reactivated: true }
}


export async function getBillingStatus(orgId: string) {
  const org = await Organization.findById(orgId)
    .select('plan billing name slug')
    .lean()
  if (!org) throw new Error('Organization not found')

  const basePlan = ((org as any).plan as PlanKey) || 'free'
  const billing = (org as any).billing || {}
  const plan = resolveEffectivePlan(basePlan, billing)
  const activeOverride = getActivePlanOverride(billing)
  const planDef = PLANS[plan]
  const basePlanDef = PLANS[basePlan]
  const usage = await getOrgUsageSummary(orgId, plan)

  const now = new Date()
  let trialDaysRemaining = 0
  if (billing.status === 'trialing' && billing.trialEndsAt) {
    trialDaysRemaining = Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  return {
    plan,
    planName: planDef.name,
    basePlan,
    basePlanName: basePlanDef.name,
    status: billing.status || 'free',
    interval: billing.interval || 'monthly',
    pricing: basePlanDef.pricing,
    accessOverride: activeOverride ? {
      plan: activeOverride.plan,
      planName: PLANS[activeOverride.plan].name,
      grantedAt: activeOverride.grantedAt,
      expiresAt: activeOverride.expiresAt,
      daysRemaining: Math.max(0, Math.ceil((activeOverride.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      reason: activeOverride.reason
    } : null,
    trial: billing.status === 'trialing' ? {
      startedAt: billing.trialStartedAt,
      endsAt: billing.trialEndsAt,
      daysRemaining: trialDaysRemaining,
    } : null,
    pendingSubscription: billing.pendingPlan && billing.pendingInterval && billing.pendingInvoiceId ? {
      plan: billing.pendingPlan,
      planName: PLANS[billing.pendingPlan as PlanKey]?.name || billing.pendingPlan,
      interval: billing.pendingInterval,
      state: billing.pendingState || 'awaiting_payment',
      requestedAt: billing.pendingRequestedAt,
    } : null,
    currentPeriod: billing.currentPeriodStart ? {
      start: billing.currentPeriodStart,
      end: billing.currentPeriodEnd,
    } : null,
    lastPaymentAt: billing.lastPaymentAt,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd || false,
    canceledAt: billing.canceledAt,
    usage,
  }
}


export async function getInvoiceHistory(orgId: string) {
  const org = await Organization.findById(orgId).select('billing slug').lean()
  if (!org) return []

  const billing = (org as any).billing || {}
  if (!billing.qontoClientId) return []

  const result = await qonto.listClientInvoices({ client_id: billing.qontoClientId })
  if (!result.ok) return []

  const invoices = result.data?.client_invoices || []



  return invoices.map((inv: any) => ({
    id: signInvoiceToken(inv.id, orgId),
    number: inv.number,
    status: inv.status,
    amountCents: inv.total_amount_cents || inv.amount_cents,
    currency: inv.currency || 'EUR',
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    paidAt: inv.paid_at,
    hasAttachment: !!inv.attachment_id,
  }))
}

export async function getInvoiceDownloadUrl(invoiceId: string): Promise<string | null> {
  const invoiceResult = await qonto.getClientInvoice(invoiceId)
  if (!invoiceResult.ok) return null

  const invoice = invoiceResult.data?.client_invoice
  const attachmentId = invoice?.attachment_id

  if (!attachmentId) return null

  const attachResult = await qonto.getAttachment(attachmentId)
  if (!attachResult.ok) return null

  return attachResult.data?.attachment?.url || null
}


export async function downgradeExpiredTrials() {
  const now = new Date()





  const expired = await Organization.find({
    'billing.status': 'trialing',
    'billing.trialEndsAt': { $lt: now },
    $or: [
      { 'billing.lastPaymentAt': { $exists: false } },
      { 'billing.lastPaymentAt': null },
    ],
  }).lean()

  if (expired.length === 0) return 0

  const { User } = await import('../../models/User')
  let downgraded = 0

  for (const org of expired) {
    const plan = ((org as any).plan as PlanKey) || 'free'
    const planDef = PLANS[plan]




    const result = await Organization.updateOne({
      _id: org._id,
      'billing.status': 'trialing',
      'billing.trialEndsAt': { $lt: now },
      $or: [
        { 'billing.lastPaymentAt': { $exists: false } },
        { 'billing.lastPaymentAt': null }
      ]
    }, {
      $set: { plan: 'free', 'billing.status': 'free' }
    })
    if (result.modifiedCount !== 1) continue
    downgraded++



    try {
      const admin = await User.findOne({ orgId: org._id, role: 'admin' }).lean() as any
      if (admin?.email) {
        await sendTrialExpiredEmail(
          admin.email,
          admin.firstName || 'Nutzer',
          planDef?.name || plan
        )
      }
    } catch (err) {
      console.error('[Billing] Trial-expired email failed:', err)
    }
  }

  if (downgraded > 0) {
    console.log(`[Billing] Downgraded ${downgraded} expired trial(s) to free.`)
  }

  return downgraded
}

export async function sendTrialWarningEmails() {
  const now = new Date()
  const oneDayMs = 24 * 60 * 60 * 1000

  const candidates = await Organization.find({
    'billing.status': 'trialing',
    'billing.trialEndsAt': {
      $gt: now,
      $lt: new Date(now.getTime() + 5 * oneDayMs),
    },
  }).lean()

  if (candidates.length === 0) return 0

  const { User } = await import('../../models/User')
  let sent = 0

  for (const org of candidates) {
    const billing = (org as any).billing || {}
    const endsAt = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null
    if (!endsAt) continue

    const msRemaining = endsAt.getTime() - now.getTime()
    const daysRemaining = Math.ceil(msRemaining / oneDayMs)

    const alreadySent: string[] = billing.trialWarningsSent || []
    let bucket: '4d' | '1d' | null = null
    if (daysRemaining <= 1 && !alreadySent.includes('1d')) bucket = '1d'
    else if (daysRemaining <= 4 && !alreadySent.includes('4d')) bucket = '4d'
    if (!bucket) continue

    try {
      const admin = await User.findOne({ orgId: org._id, role: 'admin' }).lean() as any
      if (!admin?.email) continue

      const plan = ((org as any).plan as PlanKey) || 'free'
      const planDef = PLANS[plan]
      const ok = await sendTrialExpiringEmail(
        admin.email,
        admin.firstName || 'Nutzer',
        planDef?.name || plan,
        daysRemaining
      )

      if (ok) {
        await Organization.findByIdAndUpdate(org._id, {
          $addToSet: { 'billing.trialWarningsSent': bucket },
        })
        sent++
      }
    } catch (err) {
      console.error('[Billing] Trial-warning email failed:', err)
    }
  }

  if (sent > 0) {
    console.log(`[Billing] Sent ${sent} trial-expiry warning email(s).`)
  }
  return sent
}

export async function flagPastDue(now = new Date()) {
  const gracePeriodMs = 7 * 24 * 60 * 60 * 1000



  const canceled = await Organization.updateMany(
    {
      'billing.status': 'active',
      'billing.cancelAtPeriodEnd': true,
      'billing.currentPeriodEnd': { $lte: now },
    },
    {
      $set: { 'billing.status': 'canceled' },
    }
  )




  const pastDue = await Organization.updateMany(
    {
      'billing.status': 'active',
      'billing.cancelAtPeriodEnd': { $ne: true },
      'billing.currentPeriodEnd': { $lte: new Date(now.getTime() - gracePeriodMs) },
    },
    {
      $set: { 'billing.status': 'past_due' },
    }
  )

  const modifiedCount = canceled.modifiedCount + pastDue.modifiedCount
  if (modifiedCount > 0) {
    console.log(`[Billing] Ended ${canceled.modifiedCount} canceled subscription(s); flagged ${pastDue.modifiedCount} past due.`)
  }

  return modifiedCount
}

const BILLING_LIFECYCLE_INTERVAL_MS = 60 * 60 * 1000
let billingLifecycleStarted = false

export function startBillingLifecycleCron() {
  if (billingLifecycleStarted) return
  billingLifecycleStarted = true

  setTimeout(() => {
    flagPastDue().catch(err => console.error('[Billing] Initial lifecycle reconciliation failed:', err))
  }, 10_000)
  setInterval(() => {
    flagPastDue().catch(err => console.error('[Billing] Lifecycle reconciliation failed:', err))
  }, BILLING_LIFECYCLE_INTERVAL_MS)
}
