import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


const SIGNING_KEY = 'dev-jwt-secret-not-for-production-use-change-in-prod'

function signInvoiceToken(invoiceId: string, orgId: string): string {
  const payload = Buffer.from(JSON.stringify({ invoiceId, orgId })).toString('base64url')
  const sig = crypto.createHmac('sha256', SIGNING_KEY).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyInvoiceToken(token: string, expectedOrgId: string): string | null {
  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return null

  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const expectedSig = crypto.createHmac('sha256', SIGNING_KEY).update(payload).digest('base64url')
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

function calculateTrialEnd(startDate: Date, trialDays: number): Date {
  return new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000)
}

function calculateTrialDaysRemaining(trialEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function calculateInvoiceAmount(monthlyPriceCents: number, annualPriceCents: number, interval: 'monthly' | 'annual'): number {
  return interval === 'annual' ? annualPriceCents : monthlyPriceCents
}

function calculateNetAmount(grossCents: number, vatRate: number): number {
  return Math.round(grossCents / (1 + vatRate))
}

function calculateDueDate(now: Date, daysDue: number): Date {
  return new Date(now.getTime() + daysDue * 24 * 60 * 60 * 1000)
}

function calculatePeriodEnd(now: Date, interval: 'monthly' | 'annual'): Date {
  const end = new Date(now)
  if (interval === 'annual') {
    end.setFullYear(end.getFullYear() + 1)
  } else {
    end.setMonth(end.getMonth() + 1)
  }
  return end
}

function isGracePeriodExceeded(periodEnd: Date, now: Date, graceDays: number): boolean {
  const graceMs = graceDays * 24 * 60 * 60 * 1000
  return now.getTime() > periodEnd.getTime() + graceMs
}


describe('Billing Service — Deep Logic', () => {
  describe('Invoice Token Signing (HMAC-SHA256)', () => {
    it('should sign and verify round-trip', () => {
      const token = signInvoiceToken('inv-123', 'org-456')
      const result = verifyInvoiceToken(token, 'org-456')
      expect(result).toBe('inv-123')
    })

    it('should produce different tokens for different invoices', () => {
      const t1 = signInvoiceToken('inv-1', 'org-1')
      const t2 = signInvoiceToken('inv-2', 'org-1')
      expect(t1).not.toBe(t2)
    })

    it('should produce different tokens for different orgs', () => {
      const t1 = signInvoiceToken('inv-1', 'org-1')
      const t2 = signInvoiceToken('inv-1', 'org-2')
      expect(t1).not.toBe(t2)
    })

    it('should contain exactly one dot separator', () => {
      const token = signInvoiceToken('inv-1', 'org-1')
      expect(token.split('.').length).toBe(2)
    })

    it('should reject token from wrong org (IDOR prevention)', () => {
      const token = signInvoiceToken('inv-123', 'org-A')
      const result = verifyInvoiceToken(token, 'org-B')
      expect(result).toBeNull()
    })

    it('should reject tampered payload', () => {
      const token = signInvoiceToken('inv-123', 'org-1')
      const [, sig] = token.split('.')
      const fakePayload = Buffer.from(JSON.stringify({ invoiceId: 'inv-999', orgId: 'org-1' })).toString('base64url')
      const result = verifyInvoiceToken(`${fakePayload}.${sig}`, 'org-1')
      expect(result).toBeNull()
    })

    it('should reject tampered signature', () => {
      const token = signInvoiceToken('inv-123', 'org-1')
      const [payload] = token.split('.')
      const result = verifyInvoiceToken(`${payload}.fakesig`, 'org-1')
      expect(result).toBeNull()
    })

    it('should reject token without dot', () => {
      expect(verifyInvoiceToken('nodothere', 'org-1')).toBeNull()
    })

    it('should reject empty token', () => {
      expect(verifyInvoiceToken('', 'org-1')).toBeNull()
    })

    it('should reject garbage base64', () => {
      expect(verifyInvoiceToken('!!!.!!!', 'org-1')).toBeNull()
    })
  })

  describe('Trial Day Calculations', () => {
    it('14-day trial end date', () => {
      const start = new Date('2026-01-01T00:00:00Z')
      const end = calculateTrialEnd(start, 14)
      expect(end.toISOString().split('T')[0]).toBe('2026-01-15')
    })

    it('0-day trial (no trial)', () => {
      const start = new Date('2026-01-01T00:00:00Z')
      const end = calculateTrialEnd(start, 0)
      expect(end.getTime()).toBe(start.getTime())
    })

    it('remaining days: 14 days from start', () => {
      const now = new Date('2026-01-01T00:00:00Z')
      const end = new Date('2026-01-15T00:00:00Z')
      expect(calculateTrialDaysRemaining(end, now)).toBe(14)
    })

    it('remaining days: halfway through', () => {
      const now = new Date('2026-01-08T00:00:00Z')
      const end = new Date('2026-01-15T00:00:00Z')
      expect(calculateTrialDaysRemaining(end, now)).toBe(7)
    })

    it('remaining days: expired returns 0', () => {
      const now = new Date('2026-01-20T00:00:00Z')
      const end = new Date('2026-01-15T00:00:00Z')
      expect(calculateTrialDaysRemaining(end, now)).toBe(0)
    })

    it('remaining days: today is last day', () => {
      const now = new Date('2026-01-14T12:00:00Z')
      const end = new Date('2026-01-15T00:00:00Z')
      expect(calculateTrialDaysRemaining(end, now)).toBe(1)
    })
  })

  describe('Invoice Amount Calculations', () => {
    it('monthly billing: uses monthly price', () => {
      expect(calculateInvoiceAmount(2000, 20000, 'monthly')).toBe(2000)
    })

    it('annual billing: uses annual price', () => {
      expect(calculateInvoiceAmount(2000, 20000, 'annual')).toBe(20000)
    })

    it('net amount: 19% German VAT from €20 gross', () => {
      expect(calculateNetAmount(2000, 0.19)).toBe(1681)
    })

    it('net amount: 19% VAT from €50 gross', () => {
      expect(calculateNetAmount(5000, 0.19)).toBe(4202)
    })

    it('net amount: 0% VAT (B2B reverse charge)', () => {
      expect(calculateNetAmount(5000, 0)).toBe(5000)
    })
  })

  describe('Due Date & Period Calculations', () => {
    it('due date: 14 days from now', () => {
      const now = new Date('2026-04-01T00:00:00Z')
      const due = calculateDueDate(now, 14)
      expect(due.toISOString().split('T')[0]).toBe('2026-04-15')
    })

    it('monthly period end', () => {
      const now = new Date('2026-04-01T00:00:00Z')
      const end = calculatePeriodEnd(now, 'monthly')
      expect(end.getMonth()).toBe(4)
    })

    it('annual period end', () => {
      const now = new Date('2026-04-01T00:00:00Z')
      const end = calculatePeriodEnd(now, 'annual')
      expect(end.getFullYear()).toBe(2027)
    })
  })

  describe('Grace Period', () => {
    it('should NOT be exceeded within grace period', () => {
      const periodEnd = new Date('2026-04-01T00:00:00Z')
      const now = new Date('2026-04-05T00:00:00Z')
      expect(isGracePeriodExceeded(periodEnd, now, 7)).toBe(false)
    })

    it('should be exceeded after grace period', () => {
      const periodEnd = new Date('2026-04-01T00:00:00Z')
      const now = new Date('2026-04-10T00:00:00Z')
      expect(isGracePeriodExceeded(periodEnd, now, 7)).toBe(true)
    })

    it('should NOT be exceeded on exactly grace day boundary', () => {
      const periodEnd = new Date('2026-04-01T00:00:00Z')
      const now = new Date('2026-04-08T00:00:00Z')
      expect(isGracePeriodExceeded(periodEnd, now, 7)).toBe(false)
    })

    it('should be exceeded 1ms after grace period', () => {
      const periodEnd = new Date('2026-04-01T00:00:00Z')
      const graceMs = 7 * 24 * 60 * 60 * 1000
      const now = new Date(periodEnd.getTime() + graceMs + 1)
      expect(isGracePeriodExceeded(periodEnd, now, 7)).toBe(true)
    })
  })
})
