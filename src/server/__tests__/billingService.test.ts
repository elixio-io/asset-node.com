import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-invoice-signing-secret-32chars!')

const { buildTrialPeriod, signInvoiceToken, verifyInvoiceToken } = await import('../../server/services/billingService')

describe('Billing Service — Invoice Token Security', () => {
  const ORG_A = 'org-aaa-111'
  const ORG_B = 'org-bbb-222'
  const INVOICE_ID = 'qonto-inv-12345'

  describe('signInvoiceToken + verifyInvoiceToken roundtrip', () => {
    it('should sign and verify a valid token', () => {
      const token = signInvoiceToken(INVOICE_ID, ORG_A)
      const result = verifyInvoiceToken(token, ORG_A)
      expect(result).toBe(INVOICE_ID)
    })

    it('should produce a dotted format (payload.signature)', () => {
      const token = signInvoiceToken(INVOICE_ID, ORG_A)
      expect(token).toContain('.')
      expect(token.split('.')).toHaveLength(2)
    })

    it('should produce different tokens for different orgIds', () => {
      const tokenA = signInvoiceToken(INVOICE_ID, ORG_A)
      const tokenB = signInvoiceToken(INVOICE_ID, ORG_B)
      expect(tokenA).not.toBe(tokenB)
    })

    it('should produce different tokens for different invoiceIds', () => {
      const token1 = signInvoiceToken('inv-1', ORG_A)
      const token2 = signInvoiceToken('inv-2', ORG_A)
      expect(token1).not.toBe(token2)
    })
  })

  describe('IDOR protection — cross-org verification', () => {
    it('should reject token when verified with wrong orgId', () => {
      const token = signInvoiceToken(INVOICE_ID, ORG_A)
      const result = verifyInvoiceToken(token, ORG_B)
      expect(result).toBeNull()
    })

    it('should reject token when payload orgId doesn\'t match expected', () => {
      const token = signInvoiceToken(INVOICE_ID, ORG_A)
      expect(verifyInvoiceToken(token, 'org-attacker')).toBeNull()
    })
  })

  describe('Tamper detection', () => {
    it('should reject token with modified signature', () => {
      const token = signInvoiceToken(INVOICE_ID, ORG_A)
      const [payload, sig] = token.split('.')
      const tamperedToken = `${payload}.${sig.slice(0, -3)}XXX`
      expect(verifyInvoiceToken(tamperedToken, ORG_A)).toBeNull()
    })

    it('should reject token with modified payload', () => {
      const token = signInvoiceToken(INVOICE_ID, ORG_A)
      const [, sig] = token.split('.')
      const fakePayload = Buffer.from(JSON.stringify({ invoiceId: 'fake-id', orgId: ORG_A })).toString('base64url')
      expect(verifyInvoiceToken(`${fakePayload}.${sig}`, ORG_A)).toBeNull()
    })

    it('should reject token without dot separator', () => {
      expect(verifyInvoiceToken('nodothere', ORG_A)).toBeNull()
    })

    it('should reject empty token', () => {
      expect(verifyInvoiceToken('', ORG_A)).toBeNull()
    })

    it('should reject malformed base64 payload', () => {
      expect(verifyInvoiceToken('!!!invalid.base64sig', ORG_A)).toBeNull()
    })
  })
})

describe('Billing Service — Trial Periods', () => {
  it('builds an exact 30-day trial without mutating the input date', () => {
    const start = new Date('2026-07-21T12:00:00.000Z')
    const trial = buildTrialPeriod(30, start)

    expect(trial.status).toBe('trialing')
    expect(trial.trialStartedAt).toBe(start)
    expect(trial.trialEndsAt.toISOString()).toBe('2026-08-20T12:00:00.000Z')
    expect(trial.trialWarningsSent).toEqual([])
  })

  it('clamps manually granted trials to the supported range', () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    expect(buildTrialPeriod(0, start).trialEndsAt.toISOString()).toBe('2026-01-02T00:00:00.000Z')
    expect(buildTrialPeriod(999, start).trialEndsAt.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})
