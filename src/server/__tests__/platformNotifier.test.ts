import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


type PlatformEventType = 'org.registered' | 'user.joined' | 'org.planChanged' | 'user.deactivated'

const EVENT_LABELS: Record<PlatformEventType, string> = {
  'org.registered': '🏢 New Organization Registered',
  'user.joined': '👤 New User Joined Platform',
  'org.planChanged': '💳 Organization Plan Changed',
  'user.deactivated': '🚫 User Account Deactivated'
}

const SLACK_EVENT_EMOJI: Record<PlatformEventType, string> = {
  'org.registered': ':office:',
  'user.joined': ':bust_in_silhouette:',
  'org.planChanged': ':credit_card:',
  'user.deactivated': ':no_entry:'
}

const SLACK_EVENT_COLOR: Record<PlatformEventType, string> = {
  'org.registered': '#8b5cf6',
  'user.joined': '#3b82f6',
  'org.planChanged': '#f59e0b',
  'user.deactivated': '#ef4444'
}

function isSlackUrl(url: string): boolean {
  return url.includes('hooks.slack.com')
}

function computeHmacSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

function buildWebhookHeaders(event: PlatformEventType, timestamp: string, signature?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-AssetNode-Event': event,
    'X-AssetNode-Timestamp': timestamp
  }
  if (signature) headers['X-AssetNode-Signature'] = signature
  return headers
}


describe('Platform Notifier — Pure Logic', () => {
  describe('Event Labels', () => {
    it('should have labels for all 4 event types', () => {
      expect(Object.keys(EVENT_LABELS)).toHaveLength(4)
    })

    it.each([
      ['org.registered', '🏢 New Organization Registered'],
      ['user.joined', '👤 New User Joined Platform'],
      ['org.planChanged', '💳 Organization Plan Changed'],
      ['user.deactivated', '🚫 User Account Deactivated'],
    ] as const)('should map %s → "%s"', (event, label) => {
      expect(EVENT_LABELS[event]).toBe(label)
    })

    it('all labels should include emoji prefix', () => {
      Object.values(EVENT_LABELS).forEach(label => {
        expect(label.charCodeAt(0)).toBeGreaterThan(127)
      })
    })
  })

  describe('Slack Detection', () => {
    it('should detect Slack webhook URLs', () => {
      expect(isSlackUrl('https://hooks.slack.com/services/T00000/B00000/XXXXX')).toBe(true)
    })

    it('should not flag generic webhook URLs', () => {
      expect(isSlackUrl('https://automation.example.com/webhook/123')).toBe(false)
      expect(isSlackUrl('https://make.com/webhook/456')).toBe(false)
    })

    it('should not flag Google Chat URLs', () => {
      expect(isSlackUrl('https://chat.googleapis.com/v1/spaces/AAA/messages?key=xyz')).toBe(false)
    })
  })

  describe('Slack Emoji per event', () => {
    it('should have emoji for all 4 events', () => {
      expect(Object.keys(SLACK_EVENT_EMOJI)).toHaveLength(4)
    })

    it('all emojis should use Slack colon syntax', () => {
      Object.values(SLACK_EVENT_EMOJI).forEach(emoji => {
        expect(emoji).toMatch(/^:[a-z_]+:$/)
      })
    })
  })

  describe('Slack Colors', () => {
    it('should have colors for all 4 events', () => {
      expect(Object.keys(SLACK_EVENT_COLOR)).toHaveLength(4)
    })

    it('all colors should be valid hex', () => {
      Object.values(SLACK_EVENT_COLOR).forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/)
      })
    })

    it('should use distinct colors for different event severities', () => {
      const colors = new Set(Object.values(SLACK_EVENT_COLOR))
      expect(colors.size).toBe(4)
    })
  })

  describe('HMAC Webhook Signature', () => {
    const secret = 'test-webhook-secret'

    it('should produce consistent signatures for same input', () => {
      const body = JSON.stringify({ event: 'org.registered', data: {} })
      const sig1 = computeHmacSignature(body, secret)
      const sig2 = computeHmacSignature(body, secret)
      expect(sig1).toBe(sig2)
    })

    it('should produce different signatures for different payloads', () => {
      const sig1 = computeHmacSignature('payload1', secret)
      const sig2 = computeHmacSignature('payload2', secret)
      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different secrets', () => {
      const body = 'same-payload'
      const sig1 = computeHmacSignature(body, 'secret-1')
      const sig2 = computeHmacSignature(body, 'secret-2')
      expect(sig1).not.toBe(sig2)
    })

    it('signature should be 64 hex chars (SHA-256)', () => {
      const sig = computeHmacSignature('test', secret)
      expect(sig).toHaveLength(64)
      expect(sig).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('Webhook Headers', () => {
    it('should include Content-Type', () => {
      const headers = buildWebhookHeaders('org.registered', '2026-01-01T00:00:00Z')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include event name header', () => {
      const headers = buildWebhookHeaders('user.joined', '2026-01-01T00:00:00Z')
      expect(headers['X-AssetNode-Event']).toBe('user.joined')
    })

    it('should include timestamp header', () => {
      const ts = '2026-04-19T12:00:00Z'
      const headers = buildWebhookHeaders('org.registered', ts)
      expect(headers['X-AssetNode-Timestamp']).toBe(ts)
    })

    it('should include signature when provided', () => {
      const headers = buildWebhookHeaders('org.registered', '2026-01-01', 'abc123')
      expect(headers['X-AssetNode-Signature']).toBe('abc123')
    })

    it('should NOT include signature when not provided', () => {
      const headers = buildWebhookHeaders('org.registered', '2026-01-01')
      expect(headers['X-AssetNode-Signature']).toBeUndefined()
    })
  })
})
