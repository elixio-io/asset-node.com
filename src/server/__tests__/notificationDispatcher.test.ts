import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


type NotificationEventType =
  | 'checkInOut' | 'lowStock' | 'licenseExpiry' | 'warrantyExpiry'
  | 'assetAudit' | 'assetDueBack' | 'endOfLife' | 'maintenanceDone'
  | 'componentAttach' | 'importComplete' | 'recycleBin'

type WebhookEventType =
  | 'asset.assigned' | 'asset.returned' | 'asset.created' | 'asset.updated' | 'asset.deleted' | 'asset.restored'
  | 'maintenance.created' | 'maintenance.completed'
  | 'audit.created' | 'audit.completed'
  | 'employee.created' | 'employee.updated' | 'employee.onboarded' | 'employee.offboarded'
  | 'component.attached' | 'component.detached' | 'component.created'
  | 'license.expired' | 'license.seatAssigned' | 'license.seatReleased'
  | 'lowStock.alert'
  | 'import.completed'
  | 'recycleBin.restored' | 'recycleBin.permanentlyDeleted'

const EVENT_TO_WEBHOOK: Record<NotificationEventType, WebhookEventType | null> = {
  checkInOut: 'asset.assigned',
  lowStock: 'lowStock.alert',
  licenseExpiry: 'license.expired',
  warrantyExpiry: null,
  assetAudit: 'audit.completed',
  assetDueBack: null,
  endOfLife: null,
  maintenanceDone: 'maintenance.completed',
  componentAttach: 'component.attached',
  importComplete: 'import.completed',
  recycleBin: 'recycleBin.restored'
}


function signWebhookPayload(body: string, signingSecret: string): string {
  return crypto.createHmac('sha256', signingSecret).update(body).digest('hex')
}

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = signWebhookPayload(body, secret)
  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expectedBuf)
}


describe('Notification Dispatcher — Pure Logic', () => {
  describe('Event to Webhook mapping', () => {
    it('checkInOut should map to asset.assigned', () => {
      expect(EVENT_TO_WEBHOOK.checkInOut).toBe('asset.assigned')
    })

    it('lowStock should map to lowStock.alert', () => {
      expect(EVENT_TO_WEBHOOK.lowStock).toBe('lowStock.alert')
    })

    it('licenseExpiry should map to license.expired', () => {
      expect(EVENT_TO_WEBHOOK.licenseExpiry).toBe('license.expired')
    })

    it('maintenanceDone should map to maintenance.completed', () => {
      expect(EVENT_TO_WEBHOOK.maintenanceDone).toBe('maintenance.completed')
    })

    it('warrantyExpiry should NOT have a webhook event', () => {
      expect(EVENT_TO_WEBHOOK.warrantyExpiry).toBeNull()
    })

    it('assetDueBack should NOT have a webhook event', () => {
      expect(EVENT_TO_WEBHOOK.assetDueBack).toBeNull()
    })

    it('endOfLife should NOT have a webhook event', () => {
      expect(EVENT_TO_WEBHOOK.endOfLife).toBeNull()
    })

    it('all notification events should be mapped', () => {
      const events: NotificationEventType[] = [
        'checkInOut', 'lowStock', 'licenseExpiry', 'warrantyExpiry',
        'assetAudit', 'assetDueBack', 'endOfLife', 'maintenanceDone',
        'componentAttach', 'importComplete', 'recycleBin'
      ]
      events.forEach(e => {
        expect(e in EVENT_TO_WEBHOOK, `${e} should be in mapping`).toBe(true)
      })
    })
  })

  describe('Webhook HMAC signing', () => {
    const secret = 'webhook-signing-secret-test'
    const body = JSON.stringify({
      event: 'asset.assigned',
      timestamp: '2026-04-19T12:00:00Z',
      data: { title: 'Laptop Assigned', message: 'MacBook Pro assigned to Jane Doe' }
    })

    it('should produce a valid HMAC-SHA256 hex digest', () => {
      const sig = signWebhookPayload(body, secret)
      expect(sig).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should verify valid signature', () => {
      const sig = signWebhookPayload(body, secret)
      expect(verifyWebhookSignature(body, sig, secret)).toBe(true)
    })

    it('should reject tampered body', () => {
      const sig = signWebhookPayload(body, secret)
      const tampered = body.replace('Jane Doe', 'Evil User')
      expect(verifyWebhookSignature(tampered, sig, secret)).toBe(false)
    })

    it('should reject wrong secret', () => {
      const sig = signWebhookPayload(body, secret)
      expect(verifyWebhookSignature(body, sig, 'wrong-secret')).toBe(false)
    })

    it('should produce different signatures for different secrets', () => {
      const sig1 = signWebhookPayload(body, 'secret-1')
      const sig2 = signWebhookPayload(body, 'secret-2')
      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different payloads', () => {
      const sig1 = signWebhookPayload('payload-1', secret)
      const sig2 = signWebhookPayload('payload-2', secret)
      expect(sig1).not.toBe(sig2)
    })
  })
})
