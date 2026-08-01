import * as nodemailer from 'nodemailer'
import crypto from 'crypto'



export type PlatformEventType =
  | 'org.registered'
  | 'user.joined'
  | 'org.planChanged'
  | 'user.deactivated'

export interface PlatformEventPayload {
  event: PlatformEventType
  timestamp: string
  data: Record<string, unknown>
}


function createTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  })
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'AssetNode <noreply@asset-node.com>'


const EVENT_LABELS: Record<PlatformEventType, string> = {
  'org.registered': '🏢 New Organization Registered',
  'user.joined': '👤 New User Joined Platform',
  'org.planChanged': '💳 Organization Plan Changed',
  'user.deactivated': '🚫 User Account Deactivated'
}


export async function dispatchPlatformEvent(
  event: PlatformEventType,
  data: Record<string, unknown>
): Promise<void> {
  const payload: PlatformEventPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  }

  const promises: Promise<void>[] = []

  const maintainerEmail = process.env.SMTP_FROM
  if (maintainerEmail) {
    promises.push(sendMaintainerEmail(maintainerEmail, payload))
  }

  const webhookUrl = process.env.MAINTAINER_WEBHOOK_URL
  if (webhookUrl) {
    promises.push(sendMaintainerWebhook(webhookUrl, payload))
  }

  const googleChatUrl = process.env.MAINTAINER_GOOGLE_CHAT_WEBHOOK_URL
  if (googleChatUrl) {
    promises.push(sendGoogleChat(googleChatUrl, payload))
  }

  const results = await Promise.allSettled(promises)
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[PlatformNotifier] Channel ${i} failed for event "${event}":`, result.reason)
    }
  })
}


async function sendMaintainerEmail(
  to: string,
  payload: PlatformEventPayload
): Promise<void> {
  const label = EVENT_LABELS[payload.event]
  const dataEntries = Object.entries(payload.data)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;white-space:nowrap">${k}</td><td style="padding:4px 0;font-size:13px;color:#333">${String(v)}</td></tr>`)
    .join('')

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px">
        <p style="margin:0;color:#a78bfa;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase">AssetNode Platform</p>
        <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:700">${label}</h1>
      </div>
      <div style="padding:28px 32px">
        <table style="width:100%;border-collapse:collapse">
          ${dataEntries}
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">${payload.timestamp}</p>
      </div>
    </div>
  `

  const transporter = createTransporter()
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `[AssetNode] ${label}`,
    text: `${label}\n\n${JSON.stringify(payload.data, null, 2)}\n\n${payload.timestamp}`,
    html
  })
}


async function sendMaintainerWebhook(
  url: string,
  payload: PlatformEventPayload
): Promise<void> {
  if (url.includes('hooks.slack.com')) {
    return sendSlackWebhook(url, payload)
  }

  const body = JSON.stringify(payload)
  const secret = process.env.MAINTAINER_WEBHOOK_SECRET || ''

  const signature = secret
    ? crypto.createHmac('sha256', secret).update(body).digest('hex')
    : ''

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-AssetNode-Event': payload.event,
    'X-AssetNode-Timestamp': payload.timestamp
  }

  if (signature) {
    headers['X-AssetNode-Signature'] = signature
  }

  const res = await fetch(url, { method: 'POST', headers, body })

  if (!res.ok) {
    throw new Error(`Webhook returned HTTP ${res.status} from ${url}`)
  }
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

async function sendSlackWebhook(
  url: string,
  payload: PlatformEventPayload
): Promise<void> {
  const label = EVENT_LABELS[payload.event]
  const emoji = SLACK_EVENT_EMOJI[payload.event]
  const color = SLACK_EVENT_COLOR[payload.event]
  const appUrl = process.env.APP_URL || 'https://app.asset-node.com'

  const fields = Object.entries(payload.data).map(([key, value]) => ({
    type: 'mrkdwn',
    text: `*${key}*\n${String(value)}`
  }))

  const formattedTime = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(payload.timestamp))

  const body = JSON.stringify({
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${emoji}  ${label}`, emoji: true }
          },
          { type: 'section', fields },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `:clock3: ${formattedTime}  |  <${appUrl}/super-admin|Open Super-Admin Dashboard>`
              }
            ]
          }
        ]
      }
    ]
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })

  if (!res.ok) {
    throw new Error(`Slack webhook returned HTTP ${res.status}`)
  }
}


const EVENT_COLORS: Record<PlatformEventType, string> = {
  'org.registered': '#8b5cf6',
  'user.joined': '#3b82f6',
  'org.planChanged': '#f59e0b',
  'user.deactivated': '#ef4444'
}

async function sendGoogleChat(
  url: string,
  payload: PlatformEventPayload
): Promise<void> {
  const label = EVENT_LABELS[payload.event]
  const color = EVENT_COLORS[payload.event]
  const appUrl = process.env.APP_URL || 'https://app.asset-node.com'

  const widgets = Object.entries(payload.data).map(([key, value]) => ({
    decoratedText: {
      topLabel: key,
      text: String(value)
    }
  }))

  const body = JSON.stringify({
    cardsV2: [
      {
        cardId: `assetnode-${payload.event}-${Date.now()}`,
        card: {
          header: {
            title: label,
            subtitle: 'AssetNode Platform',
            imageUrl: 'https://app.asset-node.com/favicon.ico',
            imageType: 'CIRCLE'
          },
          sections: [
            {
              collapsible: false,
              widgets
            },
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Timestamp',
                    text: new Intl.DateTimeFormat('de-DE', {
                      dateStyle: 'medium',
                      timeStyle: 'medium'
                    }).format(new Date(payload.timestamp))
                  }
                }
              ]
            },
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'Open Super-Admin',
                        color: {
                          red: parseInt(color.slice(1, 3), 16) / 255,
                          green: parseInt(color.slice(3, 5), 16) / 255,
                          blue: parseInt(color.slice(5, 7), 16) / 255,
                          alpha: 1
                        },
                        onClick: {
                          openLink: { url: `${appUrl}/super-admin` }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })

  if (!res.ok) {
    throw new Error(`Google Chat webhook returned HTTP ${res.status}`)
  }
}
