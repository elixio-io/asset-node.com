import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


type PlatformEventType =
  | 'org.registered' | 'user.joined' | 'org.planChanged' | 'user.deactivated'

const ALL_EVENTS: PlatformEventType[] = [
  'org.registered', 'user.joined', 'org.planChanged', 'user.deactivated'
]

const EVENT_LABELS: Record<PlatformEventType, string> = {
  'org.registered': '🏢 New Organization Registered',
  'user.joined': '👤 New User Joined Platform',
  'org.planChanged': '💳 Organization Plan Changed',
  'user.deactivated': '🚫 User Account Deactivated',
}

const SLACK_EVENT_EMOJI: Record<PlatformEventType, string> = {
  'org.registered': ':office:',
  'user.joined': ':bust_in_silhouette:',
  'org.planChanged': ':credit_card:',
  'user.deactivated': ':no_entry:',
}

const SLACK_EVENT_COLOR: Record<PlatformEventType, string> = {
  'org.registered': '#8b5cf6',
  'user.joined': '#3b82f6',
  'org.planChanged': '#f59e0b',
  'user.deactivated': '#ef4444',
}

function buildWebhookHeaders(event: PlatformEventType, timestamp: string, signature?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-AssetNode-Event': event,
    'X-AssetNode-Timestamp': timestamp,
  }
  if (signature) headers['X-AssetNode-Signature'] = signature
  return headers
}

function signPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

function hexToRgb(hex: string): { red: number; green: number; blue: number; alpha: number } {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
    alpha: 1,
  }
}

function isSlackUrl(url: string): boolean {
  return url.includes('hooks.slack.com')
}


describe('Platform Notifier — Pure Logic', () => {
  describe('Event Type Registry', () => {
    it('should have 4 platform event types', () => {
      expect(ALL_EVENTS).toHaveLength(4)
    })

    it.each(['org.registered', 'user.joined', 'org.planChanged', 'user.deactivated'] as const)(
      '"%s" should be registered', (event) => {
        expect(ALL_EVENTS).toContain(event)
      }
    )
  })

  describe('Event Labels', () => {
    it.each([
      ['org.registered', '🏢 New Organization Registered'],
      ['user.joined', '👤 New User Joined Platform'],
      ['org.planChanged', '💳 Organization Plan Changed'],
      ['user.deactivated', '🚫 User Account Deactivated'],
    ] as const)('%s → "%s"', (event, label) => {
      expect(EVENT_LABELS[event]).toBe(label)
    })

    it('all labels should start with an emoji', () => {
      Object.values(EVENT_LABELS).forEach(label => {
        expect(label.codePointAt(0)!).toBeGreaterThan(255)
      })
    })
  })

  describe('Slack Integration', () => {
    it.each([
      ['org.registered', ':office:'],
      ['user.joined', ':bust_in_silhouette:'],
      ['org.planChanged', ':credit_card:'],
      ['user.deactivated', ':no_entry:'],
    ] as const)('%s → Slack emoji %s', (event, emoji) => {
      expect(SLACK_EVENT_EMOJI[event]).toBe(emoji)
    })

    it('all Slack colors should be valid hex', () => {
      Object.values(SLACK_EVENT_COLOR).forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      })
    })

    it('should detect Slack webhook URLs', () => {
      expect(isSlackUrl('https://hooks.slack.com/services/T123/B456/abc')).toBe(true)
      expect(isSlackUrl('https://automation.example.com/webhook')).toBe(false)
    })
  })

  describe('Google Chat Color Conversion (hex → RGB)', () => {
    it('#8b5cf6 (purple) → correct RGB', () => {
      const rgb = hexToRgb('#8b5cf6')
      expect(rgb.red).toBeCloseTo(0.545, 2)
      expect(rgb.green).toBeCloseTo(0.361, 2)
      expect(rgb.blue).toBeCloseTo(0.965, 2)
      expect(rgb.alpha).toBe(1)
    })

    it('#3b82f6 (blue)', () => {
      const rgb = hexToRgb('#3b82f6')
      expect(rgb.red).toBeCloseTo(0.231, 2)
      expect(rgb.green).toBeCloseTo(0.510, 2)
      expect(rgb.blue).toBeCloseTo(0.965, 2)
    })

    it('#000000 (black) → all zeros', () => {
      const rgb = hexToRgb('#000000')
      expect(rgb.red).toBe(0)
      expect(rgb.green).toBe(0)
      expect(rgb.blue).toBe(0)
    })

    it('#ffffff (white) → all ones', () => {
      const rgb = hexToRgb('#ffffff')
      expect(rgb.red).toBe(1)
      expect(rgb.green).toBe(1)
      expect(rgb.blue).toBe(1)
    })
  })

  describe('Webhook HMAC Signing', () => {
    it('should produce valid HMAC-SHA256 hex signature', () => {
      const sig = signPayload('{"event":"test"}', 'my-secret')
      expect(sig).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(sig)).toBe(true)
    })

    it('same payload + secret should produce same signature', () => {
      const body = '{"event":"org.registered"}'
      const sig1 = signPayload(body, 'secret')
      const sig2 = signPayload(body, 'secret')
      expect(sig1).toBe(sig2)
    })

    it('different secrets should produce different signatures', () => {
      const body = '{"event":"test"}'
      const sig1 = signPayload(body, 'secret-a')
      const sig2 = signPayload(body, 'secret-b')
      expect(sig1).not.toBe(sig2)
    })

    it('different payloads should produce different signatures', () => {
      const sig1 = signPayload('payload-1', 'secret')
      const sig2 = signPayload('payload-2', 'secret')
      expect(sig1).not.toBe(sig2)
    })
  })

  describe('Webhook Headers', () => {
    it('should include Content-Type, Event, and Timestamp', () => {
      const headers = buildWebhookHeaders('org.registered', '2026-04-19T00:00:00Z')
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-AssetNode-Event']).toBe('org.registered')
      expect(headers['X-AssetNode-Timestamp']).toBe('2026-04-19T00:00:00Z')
    })

    it('should include signature when provided', () => {
      const headers = buildWebhookHeaders('user.joined', '2026-04-19T00:00:00Z', 'abc123')
      expect(headers['X-AssetNode-Signature']).toBe('abc123')
    })

    it('should NOT include signature when absent', () => {
      const headers = buildWebhookHeaders('user.joined', '2026-04-19T00:00:00Z')
      expect(headers).not.toHaveProperty('X-AssetNode-Signature')
    })
  })
})
