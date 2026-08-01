
import { Organization } from '../../models/Organization'
import { activateSubscription } from './billingService'
import * as qonto from './qontoClient'

const POLL_INTERVAL_MS = 15 * 60 * 1000

export async function matchPayments(): Promise<{ checked: number; activated: number; overdue: number }> {
  const stats = { checked: 0, activated: 0, overdue: 0 }



  const orgs = await Organization.find({
    'billing.pendingInvoiceId': { $exists: true, $ne: null },
    'billing.pendingPlan': { $in: ['starter', 'pro', 'enterprise'] },
    'billing.pendingInterval': { $in: ['monthly', 'annual'] },
    'billing.pendingState': { $ne: 'canceled' },
  })
    .select('billing slug name')
    .lean()

  for (const org of orgs) {
    const billing = (org as any).billing || {}
    const invoiceId = billing.pendingInvoiceId

    if (!invoiceId) continue
    stats.checked++

    try {
      const result = await qonto.getClientInvoice(invoiceId)
      if (!result.ok || !result.data?.client_invoice) {
        console.warn(`[PaymentMatcher] Failed to fetch invoice ${invoiceId} for org ${(org as any).slug}`)
        continue
      }

      const invoice = result.data.client_invoice
      const status = invoice.status?.toLowerCase()

      if (status === 'paid') {
        await activateSubscription((org as any)._id.toString(), invoiceId)
        stats.activated++
        console.log(`[PaymentMatcher] ✅ Payment confirmed for ${(org as any).slug} (invoice ${invoiceId})`)
      } else if (status === 'overdue' || status === 'canceled') {



        await Organization.updateOne({
          _id: (org as any)._id,
          'billing.pendingInvoiceId': invoiceId,
        }, {
          $set: { 'billing.pendingState': status },
          $unset: { 'billing.pendingLeaseExpiresAt': 1 },
        })
        stats.overdue++
        console.warn(`[PaymentMatcher] ⚠️ Invoice ${status} for ${(org as any).slug}`)
      }
    } catch (err) {
      console.error(`[PaymentMatcher] Error checking invoice for ${(org as any).slug}:`, err)
    }
  }

  if (stats.checked > 0) {
    console.log(
      `[PaymentMatcher] Checked ${stats.checked} invoice(s): ${stats.activated} paid, ${stats.overdue} overdue`
    )
  }

  return stats
}

export function startPaymentMatcher() {
  console.log('[PaymentMatcher] Started — polling every 15 minutes')

  setTimeout(() => {
    matchPayments().catch(err => console.error('[PaymentMatcher] Initial run failed:', err))
  }, 10_000)

  setInterval(() => {
    matchPayments().catch(err => console.error('[PaymentMatcher] Scheduled run failed:', err))
  }, POLL_INTERVAL_MS)
}
