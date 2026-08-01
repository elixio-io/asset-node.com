import { Organization } from '../../models/Organization'
import { SupportTicket } from '../../models/SupportTicket'
import { createGitLabIssue, isGitLabTicketingConfigured } from './gitlabClient'
import { createHelpdeskTicket, isHelpdeskConfigured } from './helpdeskClient'
import { sendSupportTicketNotification } from './emailService'
import { createServiceLogger } from './logger'

const log = createServiceLogger('SupportDelivery')
const LEASE_MS = 2 * 60 * 1000
const WORKER_INTERVAL_MS = 30 * 1000
const MAX_ATTEMPTS = 8
let workerStarted = false

function retryDelayMs(attempt: number) {
  return Math.min(6 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempt - 1)))
}

function buildTicketBody(ticket: any, orgName: string) {
  const metadata = ticket.metadata || {}
  const metaLines = [
    `- **Category:** ${ticket.category}`,
    `- **Priority:** ${ticket.priority}`,
    metadata.url ? `- **URL:** ${metadata.url}` : null,
    metadata.userAgent ? `- **UA:** ${metadata.userAgent}` : null,
    metadata.appVersion ? `- **Version:** ${metadata.appVersion}` : null,
    metadata.screenSize ? `- **Screen:** ${metadata.screenSize}` : null,
  ].filter(Boolean).join('\n')

  let sessionLogBlock = ''
  if (metadata.clientLog) {
    try {
      const parsed = JSON.parse(metadata.clientLog) as Array<{
        t: string
        kind: string
        message: string
        data?: Record<string, unknown>
      }>
      const lines = parsed.map(entry => {
        const extra = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
        return `[${entry.t}] ${String(entry.kind).padEnd(5)} ${entry.message}${extra}`
      }).join('\n')
      sessionLogBlock = [
        '',
        '<details>',
        `<summary>Session log (${parsed.length} event${parsed.length === 1 ? '' : 's'})</summary>`,
        '',
        '```',
        lines,
        '```',
        '</details>',
      ].join('\n')
    } catch {
      sessionLogBlock = `\n\n## Session log (raw)\n\`\`\`\n${metadata.clientLog}\n\`\`\``
    }
  }

  return [
    `**Org:** ${orgName}`,
    `**User:** ${ticket.userName} <${ticket.userEmail}>`,
    `**Ticket:** ${ticket.ticketRef}`,
    '',
    '## Description',
    ticket.description,
    '',
    '## Metadata',
    metaLines || '_none_',
    metadata.errorStack ? `\n## Error Stack\n\`\`\`\n${metadata.errorStack}\n\`\`\`` : '',
    sessionLogBlock,
  ].filter(Boolean).join('\n')
}

async function markDelivered(ticketId: unknown, channel: 'helpdesk' | 'gitlab' | 'email') {
  await SupportTicket.updateOne(
    { _id: ticketId, deliveryStatus: 'processing' },
    {
      $set: {
        deliveryStatus: 'delivered',
        deliveryChannel: channel,
        deliveredAt: new Date(),
      },
      $unset: { nextDeliveryAttemptAt: 1, deliveryLeaseUntil: 1 },
    }
  )
}

async function markFailed(ticketId: unknown, attempt: number) {
  await SupportTicket.updateOne(
    { _id: ticketId, deliveryStatus: 'processing' },
    {
      $set: {
        deliveryStatus: 'failed',
        nextDeliveryAttemptAt: new Date(Date.now() + retryDelayMs(attempt)),
      },
      $unset: { deliveryLeaseUntil: 1 },
    }
  )
}

export async function processSupportTicketDelivery(ticketId: string): Promise<boolean> {
  const now = new Date()
  const ticket = await SupportTicket.findOneAndUpdate({
    _id: ticketId,
    deliveryAttempts: { $lt: MAX_ATTEMPTS },
    $or: [
      {
        deliveryStatus: { $in: ['pending', 'failed'] },
        $or: [
          { nextDeliveryAttemptAt: { $lte: now } },
          { nextDeliveryAttemptAt: { $exists: false } },
        ],
      },
      {
        deliveryStatus: 'processing',
        deliveryLeaseUntil: { $lte: now },
      },
    ],
  }, {
    $set: {
      deliveryStatus: 'processing',
      deliveryLeaseUntil: new Date(now.getTime() + LEASE_MS),
    },
    $inc: { deliveryAttempts: 1 },
  }, { new: true }).exec()

  if (!ticket) return false

  const attempt = ticket.deliveryAttempts || 1
  try {
    const org = await Organization.findById(ticket.orgId).lean() as any
    if (!org) throw new Error('Ticket organization no longer exists')

    const orgName = org.name || org.slug || 'Unknown'
    const issueBody = buildTicketBody(ticket, orgName)
    const helpdeskConfig = org.settings?.integrations?.helpdesk

    if (isHelpdeskConfigured(helpdeskConfig)) {
      const result = await createHelpdeskTicket(helpdeskConfig, {
        ticketRef: ticket.ticketRef,
        subject: ticket.subject,
        description: issueBody,
        category: ticket.category,
        priority: ticket.priority,
        requester: { name: ticket.userName, email: ticket.userEmail },
        organizationName: orgName,
      })

      if (result.ok && result.provider && result.externalTicketId) {
        await Promise.all([
          SupportTicket.updateOne(
            { _id: ticket._id },
            { $set: { externalProvider: result.provider, externalTicketId: result.externalTicketId } }
          ),
          Organization.updateOne(
            { _id: ticket.orgId },
            {
              $set: { 'settings.integrations.helpdesk.lastDeliveryAt': new Date() },
              $unset: { 'settings.integrations.helpdesk.lastFailureAt': 1 },
            }
          ),
        ])
        await markDelivered(ticket._id, 'helpdesk')
        return true
      }

      await Organization.updateOne(
        { _id: ticket.orgId },
        { $set: { 'settings.integrations.helpdesk.lastFailureAt': new Date() } }
      )
    }

    if (isGitLabTicketingConfigured()) {
      const result = await createGitLabIssue({
        title: `[${ticket.priority}] ${ticket.ticketRef} — ${ticket.subject}`,
        description: issueBody,
        labels: [ticket.category, ticket.priority, 'support'],
      })
      if (result.ok && typeof result.internalIid === 'number') {
        await SupportTicket.updateOne(
          { _id: ticket._id },
          { $set: { gitlabIssueIid: result.internalIid } }
        )
        await markDelivered(ticket._id, 'gitlab')
        return true
      }
    }

    const emailed = await sendSupportTicketNotification({
      ticketRef: ticket.ticketRef,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      userName: ticket.userName,
      userEmail: ticket.userEmail,
      orgName,
    })
    if (!emailed) throw new Error('No support delivery channel accepted the ticket')

    await markDelivered(ticket._id, 'email')
    return true
  } catch (error) {
    await markFailed(ticket._id, attempt)
    log.error(
      { ticketRef: ticket.ticketRef, attempt, errName: (error as Error)?.name || 'Error' },
      'Support-ticket delivery failed; retry scheduled'
    )
    return false
  }
}

async function runSupportTicketDeliveryBatch() {
  const now = new Date()
  const candidates = await SupportTicket.find({
    deliveryAttempts: { $lt: MAX_ATTEMPTS },
    $or: [
      {
        deliveryStatus: { $in: ['pending', 'failed'] },
        $or: [
          { nextDeliveryAttemptAt: { $lte: now } },
          { nextDeliveryAttemptAt: { $exists: false } },
        ],
      },
      { deliveryStatus: 'processing', deliveryLeaseUntil: { $lte: now } },
    ],
  }).select('_id').sort({ nextDeliveryAttemptAt: 1 }).limit(20).lean()

  await Promise.allSettled(candidates.map(ticket => processSupportTicketDelivery(String(ticket._id))))
}

export function startSupportTicketDeliveryWorker() {
  if (workerStarted) return
  workerStarted = true

  const run = () => runSupportTicketDeliveryBatch().catch(error => {
    log.error({ errName: (error as Error)?.name || 'Error' }, 'Support-ticket delivery batch failed')
  })
  setTimeout(run, 2_000).unref()
  setInterval(run, WORKER_INTERVAL_MS).unref()
}

