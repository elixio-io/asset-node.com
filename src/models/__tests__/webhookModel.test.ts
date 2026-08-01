import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


const WEBHOOK_EVENTS = [
  'asset.assigned', 'asset.returned', 'asset.created', 'asset.deleted',
  'maintenance.completed', 'audit.completed',
  'employee.onboarded', 'employee.offboarded',
  'lowStock.alert'
] as const

function generateSigningSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}


describe('Webhook Model — Events & Signing', () => {
  describe('Event Type Registry', () => {
    it('should have 9 event types', () => {
      expect(WEBHOOK_EVENTS).toHaveLength(9)
    })

    it.each([
      'asset.assigned', 'asset.returned', 'asset.created', 'asset.deleted',
      'maintenance.completed', 'audit.completed',
      'employee.onboarded', 'employee.offboarded',
      'lowStock.alert',
    ])('"%s" should be registered', (event) => {
      expect(WEBHOOK_EVENTS).toContain(event)
    })

    it('asset events should be 4', () => {
      const assetEvents = WEBHOOK_EVENTS.filter(e => e.startsWith('asset.'))
      expect(assetEvents).toHaveLength(4)
    })

    it('employee events should be 2', () => {
      const empEvents = WEBHOOK_EVENTS.filter(e => e.startsWith('employee.'))
      expect(empEvents).toHaveLength(2)
    })
  })

  describe('Signing Secret Generation', () => {
    it('should produce 64-char hex string (32 bytes)', () => {
      const secret = generateSigningSecret()
      expect(secret).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(secret)).toBe(true)
    })

    it('should be unique per call', () => {
      const s1 = generateSigningSecret()
      const s2 = generateSigningSecret()
      expect(s1).not.toBe(s2)
    })
  })

  describe('HMAC-SHA256 Payload Signing', () => {
    const secret = 'test-secret-key-abc123'
    const payload = JSON.stringify({ event: 'asset.assigned', assetId: '123' })

    it('should produce 64-char hex signature', () => {
      const sig = signPayload(payload, secret)
      expect(sig).toHaveLength(64)
    })

    it('should be deterministic', () => {
      const sig1 = signPayload(payload, secret)
      const sig2 = signPayload(payload, secret)
      expect(sig1).toBe(sig2)
    })

    it('different payload → different signature', () => {
      const sig1 = signPayload('payload-a', secret)
      const sig2 = signPayload('payload-b', secret)
      expect(sig1).not.toBe(sig2)
    })

    it('different secret → different signature', () => {
      const sig1 = signPayload(payload, 'secret-a')
      const sig2 = signPayload(payload, 'secret-b')
      expect(sig1).not.toBe(sig2)
    })
  })

  describe('Signature Verification', () => {
    const secret = generateSigningSecret()
    const payload = '{"event":"asset.created","id":"abc"}'

    it('should verify correct signature', () => {
      const sig = signPayload(payload, secret)
      expect(verifySignature(payload, secret, sig)).toBe(true)
    })

    it('should reject tampered payload', () => {
      const sig = signPayload(payload, secret)
      expect(verifySignature(payload + 'x', secret, sig)).toBe(false)
    })

    it('should reject wrong secret', () => {
      const sig = signPayload(payload, secret)
      expect(verifySignature(payload, 'wrong-secret'.padEnd(64, '0'), sig)).toBe(false)
    })
  })
})
