import * as nodemailer from 'nodemailer'
import crypto from 'crypto'
import { NotificationPreference } from '../../models/NotificationPreference'
import { Webhook } from '../../models/Webhook'
import { postSecureWebhook } from './workflowWebhookSecurity'


let emailTransporter: nodemailer.Transporter | null = null

function getEmailTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null

  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    })
  }
  return emailTransporter
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'AssetNode <noreply@asset-node.com>'

export type NotificationEventType =
  | 'checkInOut' | 'lowStock' | 'licenseExpiry' | 'warrantyExpiry'
  | 'assetAudit' | 'assetDueBack' | 'endOfLife' | 'maintenanceDone'
  | 'componentAttach' | 'importComplete' | 'recycleBin'

export type WebhookEventType =
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

export interface NotificationPayload {
  title: string
  message: string
  data?: Record<string, unknown>
}

export type NotificationChannel = 'email' | 'slack' | 'teams'

export interface NotificationDispatchOptions {
  channels?: NotificationChannel[]
  respectEventPreferences?: boolean
}

export interface NotificationDispatchResult {
  requested: NotificationChannel[]
  delivered: NotificationChannel[]
  failed: Array<{ channel: NotificationChannel; error: string }>
  skipped: Array<{ channel: NotificationChannel; reason: string }>
}

export async function dispatchNotification(
  orgId: string,
  eventType: NotificationEventType,
  payload: NotificationPayload,
  options: NotificationDispatchOptions = {}
): Promise<NotificationDispatchResult> {
  const requested = [...new Set(options.channels || ['email', 'slack', 'teams'])]
  const result: NotificationDispatchResult = {
    requested,
    delivered: [],
    failed: [],
    skipped: []
  }
  const prefs = await NotificationPreference.findOne({ orgId })
  if (!prefs) {
    result.skipped.push(...requested.map(channel => ({ channel, reason: 'Notification preferences are not configured' })))
    return result
  }

  const eventConfig = prefs.events?.[eventType as keyof typeof prefs.events]
  const respectEventPreferences = options.respectEventPreferences !== false
  const jobs: Array<{ channel: NotificationChannel; promise: Promise<void> }> = []

  for (const channel of requested) {
    const channelConfig = prefs.channels?.[channel]
    if (!channelConfig?.enabled) {
      result.skipped.push({ channel, reason: 'Channel is disabled' })
      continue
    }
    if (respectEventPreferences && (!eventConfig || !eventConfig[channel])) {
      result.skipped.push({ channel, reason: `Channel is disabled for event ${eventType}` })
      continue
    }

    if (channel === 'email') {
      if (!channelConfig.address) {
        result.skipped.push({ channel, reason: 'Email address is not configured' })
      } else {
        jobs.push({ channel, promise: sendEmail(channelConfig.address, payload) })
      }
    } else if (!channelConfig.webhookUrl) {
      result.skipped.push({ channel, reason: `${channel} webhook URL is not configured` })
    } else if (channel === 'slack') {
      jobs.push({ channel, promise: sendSlack(channelConfig.webhookUrl, payload) })
    } else {
      jobs.push({ channel, promise: sendTeams(channelConfig.webhookUrl, payload) })
    }
  }

  const settled = await Promise.allSettled(jobs.map(job => job.promise))
  settled.forEach((delivery, index) => {
    const channel = jobs[index].channel
    if (delivery.status === 'fulfilled') {
      result.delivered.push(channel)
    } else {
      result.failed.push({
        channel,
        error: delivery.reason instanceof Error ? delivery.reason.message : 'Notification delivery failed'
      })
    }
  })

  const webhookEvent = EVENT_TO_WEBHOOK[eventType]
  if (!options.channels && webhookEvent) {
    await fireWebhooks(orgId, webhookEvent, payload)
  }

  return result
}


async function sendEmail(to: string, payload: NotificationPayload): Promise<void> {
  const smtp = getEmailTransporter()
  if (!smtp) {
    throw new Error('SMTP is not configured')
  }

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!)
  await smtp.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `[AssetNode] ${payload.title}`,
    text: payload.message,
    html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">${escapeHtml(payload.title)}</h2>
          <p style="color: #333; line-height: 1.6;">${escapeHtml(payload.message)}</p>
          ${payload.data ? `<pre style="background: #f5f5f5; padding: 12px; border-radius: 8px; font-size: 13px;">${escapeHtml(JSON.stringify(payload.data, null, 2))}</pre>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">AssetNode · Automated Notification</p>
        </div>
      `
  })
}

async function sendSlack(webhookUrl: string, payload: NotificationPayload): Promise<void> {
  const response = await postSecureWebhook(webhookUrl, JSON.stringify({
    text: `*${payload.title}*\n${payload.message}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: payload.title }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: payload.message }
      }
    ]
  }), { 'Content-Type': 'application/json' })
  if (!response.ok) throw new Error(`Slack returned HTTP ${response.status}`)
}

async function sendTeams(webhookUrl: string, payload: NotificationPayload): Promise<void> {
  const response = await postSecureWebhook(webhookUrl, JSON.stringify({
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: payload.title,
    themeColor: '1a1a2e',
    title: payload.title,
    sections: [{ activityTitle: payload.message }]
  }), { 'Content-Type': 'application/json' })
  if (!response.ok) throw new Error(`Teams returned HTTP ${response.status}`)
}

async function fireWebhooks(
  orgId: string,
  eventType: WebhookEventType,
  payload: NotificationPayload
): Promise<void> {
  const webhooks = await Webhook.find({
    orgId,
    isActive: true,
    events: eventType
  })

  for (const wh of webhooks) {
    try {
      const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload
      })

      const signature = crypto
        .createHmac('sha256', wh.signingSecret)
        .update(body)
        .digest('hex')

      const response = await postSecureWebhook(wh.url, body, {
          'Content-Type': 'application/json',
          'X-HM-Signature': signature,
          'X-HM-Event': eventType
      })

      if (response.ok) {
        wh.lastTriggeredAt = new Date()
        wh.failureCount = 0
      } else {
        wh.failureCount = (wh.failureCount || 0) + 1
      }
      await wh.save()
    } catch (err) {
      console.error(`[WebhookDispatch] Failed webhook ${String(wh._id)}:`, err)
      wh.failureCount = (wh.failureCount || 0) + 1
      await wh.save()
    }
  }
}


export async function sendTestNotification(
  channel: 'email' | 'slack' | 'teams',
  target: string
): Promise<{ success: boolean; error?: string }> {
  const testPayload: NotificationPayload = {
    title: '🔔 Test Notification',
    message: 'This is a test notification from AssetNode. If you see this, the channel is configured correctly!'
  }

  try {
    if (channel === 'email') {
      await sendEmail(target, testPayload)
    } else if (channel === 'slack') {
      await sendSlack(target, testPayload)
    } else {
      await sendTeams(target, testPayload)
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
