import { describe, it, expect } from 'vitest'


type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'canceled'
type BillingAction = 'activate' | 'keep_pending' | 'no_action'

function decideAction(invoiceStatus: InvoiceStatus): BillingAction {
  const status = invoiceStatus.toLowerCase() as InvoiceStatus
  if (status === 'paid') return 'activate'
  if (status === 'overdue' || status === 'canceled') return 'keep_pending'
  return 'no_action'
}

type BillingStatus = 'free' | 'trialing' | 'active' | 'past_due'

function canCheckPayment(hasPendingInvoice: boolean, hasPendingSelection: boolean): boolean {
  return hasPendingInvoice && hasPendingSelection
}

function nextBillingStatus(current: BillingStatus, action: BillingAction): BillingStatus {
  if (action === 'activate') return 'active'
  return current
}

const POLL_INTERVAL_MS = 15 * 60 * 1000


describe('Payment Matcher — Pure Logic', () => {
  describe('Invoice status → action', () => {
    it('paid → activate', () => {
      expect(decideAction('paid')).toBe('activate')
    })

    it('overdue → keep pending without changing current access', () => {
      expect(decideAction('overdue')).toBe('keep_pending')
    })

    it('canceled → keep pending without changing current access', () => {
      expect(decideAction('canceled')).toBe('keep_pending')
    })

    it('unpaid → no_action', () => {
      expect(decideAction('unpaid')).toBe('no_action')
    })

    it('draft → no_action', () => {
      expect(decideAction('draft')).toBe('no_action')
    })
  })

  describe('canCheckPayment filter', () => {
    it('checks a pending selection regardless of the current billing status', () => {
      expect(canCheckPayment(true, true)).toBe(true)
    })

    it('does not check an invoice without a bound plan and interval', () => {
      expect(canCheckPayment(true, false)).toBe(false)
    })

    it('does not check a historical selection without a pending invoice', () => {
      expect(canCheckPayment(false, true)).toBe(false)
    })
  })

  describe('Billing status state machine', () => {
    it('trialing + paid → active', () => {
      expect(nextBillingStatus('trialing', 'activate')).toBe('active')
    })

    it('trialing + overdue → keeps the valid trial', () => {
      expect(nextBillingStatus('trialing', 'keep_pending')).toBe('trialing')
    })

    it('active + no_action → stays active', () => {
      expect(nextBillingStatus('active', 'no_action')).toBe('active')
    })

    it('trialing + no_action → stays trialing', () => {
      expect(nextBillingStatus('trialing', 'no_action')).toBe('trialing')
    })

    it('active + paid (renewal) → active', () => {
      expect(nextBillingStatus('active', 'activate')).toBe('active')
    })
  })

  describe('Polling configuration', () => {
    it('should poll every 15 minutes (900,000ms)', () => {
      expect(POLL_INTERVAL_MS).toBe(900_000)
    })

    it('should be at least 5 minutes to avoid rate limiting', () => {
      expect(POLL_INTERVAL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000)
    })
  })
})
