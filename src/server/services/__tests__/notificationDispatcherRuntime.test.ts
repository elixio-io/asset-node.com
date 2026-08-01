import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../models/NotificationPreference', () => ({
  NotificationPreference: { findOne: vi.fn() }
}))
vi.mock('../../../models/Webhook', () => ({
  Webhook: { find: vi.fn(async () => []) }
}))
vi.mock('../workflowWebhookSecurity', () => ({
  postSecureWebhook: vi.fn()
}))

import { NotificationPreference } from '../../../models/NotificationPreference'
import { postSecureWebhook } from '../workflowWebhookSecurity'
import { dispatchNotification } from '../notificationDispatcher'

const findPreference = vi.mocked(NotificationPreference.findOne)
const securePost = vi.mocked(postSecureWebhook)

function preferences(overrides: Record<string, unknown> = {}) {
  return {
    channels: {
      email: { enabled: true, address: 'it@example.com' },
      slack: { enabled: true, webhookUrl: 'https://hooks.example.com/slack' },
      teams: { enabled: true, webhookUrl: 'https://hooks.example.com/teams' }
    },
    events: {
      assetAudit: { email: true, slack: true, teams: true }
    },
    ...overrides
  }
}

describe('notification dispatcher runtime results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    securePost.mockResolvedValue({ status: 204, ok: true, body: '' })
  })

  it('delivers only the channel explicitly selected by a workflow', async () => {
    findPreference.mockResolvedValue(preferences() as any)

    const result = await dispatchNotification('org-a', 'assetAudit', {
      title: 'Workflow alert',
      message: 'Review this event'
    }, { channels: ['slack'], respectEventPreferences: false })

    expect(securePost).toHaveBeenCalledTimes(1)
    expect(securePost).toHaveBeenCalledWith(
      'https://hooks.example.com/slack',
      expect.any(String),
      { 'Content-Type': 'application/json' }
    )
    expect(result.delivered).toEqual(['slack'])
    expect(result.failed).toEqual([])
  })

  it('reports a disabled selected channel as skipped instead of success', async () => {
    const prefs = preferences()
    prefs.channels.slack.enabled = false
    findPreference.mockResolvedValue(prefs as any)

    const result = await dispatchNotification('org-a', 'assetAudit', {
      title: 'Workflow alert',
      message: 'Review this event'
    }, { channels: ['slack'], respectEventPreferences: false })

    expect(result.delivered).toEqual([])
    expect(result.skipped).toEqual([{ channel: 'slack', reason: 'Channel is disabled' }])
    expect(securePost).not.toHaveBeenCalled()
  })

  it('surfaces transport failure without recording false delivery', async () => {
    findPreference.mockResolvedValue(preferences() as any)
    securePost.mockRejectedValue(new Error('DNS target is private'))

    const result = await dispatchNotification('org-a', 'assetAudit', {
      title: 'Workflow alert',
      message: 'Review this event'
    }, { channels: ['teams'], respectEventPreferences: false })

    expect(result.delivered).toEqual([])
    expect(result.failed).toEqual([{ channel: 'teams', error: 'DNS target is private' }])
  })
})
