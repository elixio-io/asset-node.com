import { decrypt } from './encryption'
import { createServiceLogger } from './logger'

const log = createServiceLogger('Helpdesk')
const REQUEST_TIMEOUT_MS = 12_000
const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type HelpdeskProvider = 'zendesk' | 'freshdesk'

export interface HelpdeskConfig {
  enabled?: boolean
  provider?: HelpdeskProvider | ''
  subdomain?: string
  email?: string
  apiToken?: string
}

export interface HelpdeskTicketInput {
  ticketRef: string
  subject: string
  description: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  requester: { name: string; email: string }
  organizationName: string
}

export interface HelpdeskDeliveryResult {
  ok: boolean
  provider?: HelpdeskProvider
  externalTicketId?: string
}

export function isHelpdeskConfigured(config: HelpdeskConfig | null | undefined): boolean {
  if (!config?.enabled || !config.provider || !config.apiToken || !config.subdomain) return false
  if (!SUBDOMAIN_PATTERN.test(config.subdomain)) return false
  return config.provider !== 'zendesk' || EMAIL_PATTERN.test(String(config.email || ''))
}

function priorityForZendesk(priority: HelpdeskTicketInput['priority']) {
  return priority === 'critical' ? 'urgent' : priority === 'medium' ? 'normal' : priority
}

function priorityForFreshdesk(priority: HelpdeskTicketInput['priority']) {
  return ({ low: 1, medium: 2, high: 3, critical: 4 } as const)[priority]
}

export async function createHelpdeskTicket(
  config: HelpdeskConfig,
  input: HelpdeskTicketInput
): Promise<HelpdeskDeliveryResult> {
  if (!isHelpdeskConfigured(config)) return { ok: false }

  const provider = config.provider as HelpdeskProvider
  const subdomain = String(config.subdomain).toLowerCase()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let status = 0
  try {
    const apiToken = decrypt(String(config.apiToken))
    const request = provider === 'zendesk'
      ? buildZendeskRequest(subdomain, String(config.email), apiToken, input)
      : buildFreshdeskRequest(subdomain, apiToken, input)

    const response = await fetch(request.url, {
      method: 'POST',
      redirect: 'error',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    })
    status = response.status

    if (!response.ok) {
      log.warn({ provider, status }, 'Helpdesk rejected ticket')
      return { ok: false, provider }
    }

    const body = await response.json() as any
    const id = provider === 'zendesk' ? body?.ticket?.id : body?.id
    if (id === undefined || id === null) {
      log.warn({ provider, status }, 'Helpdesk response missing ticket id')
      return { ok: false, provider }
    }

    log.info({ provider, status }, 'Ticket forwarded to helpdesk')
    return { ok: true, provider, externalTicketId: String(id) }
  } catch (err) {
    log.error({ provider, status, errName: (err as Error)?.name || 'Error' }, 'Helpdesk delivery failed')
    return { ok: false, provider }
  } finally {
    clearTimeout(timeout)
  }
}

function buildZendeskRequest(
  subdomain: string,
  email: string,
  apiToken: string,
  input: HelpdeskTicketInput
) {
  const authorization = Buffer.from(`${email}/token:${apiToken}`).toString('base64')
  return {
    url: `https://${subdomain}.zendesk.com/api/v2/tickets`,
    headers: {
      'Authorization': `Basic ${authorization}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.ticketRef,
    },
    body: {
      ticket: {
        subject: `[${input.ticketRef}] ${input.subject}`,
        comment: { body: input.description },
        requester: input.requester,
        priority: priorityForZendesk(input.priority),
        tags: ['assetnode', input.category, input.ticketRef.toLowerCase()],
      },
    },
  }
}

function buildFreshdeskRequest(
  subdomain: string,
  apiToken: string,
  input: HelpdeskTicketInput
) {
  const authorization = Buffer.from(`${apiToken}:X`).toString('base64')
  return {
    url: `https://${subdomain}.freshdesk.com/api/v2/tickets`,
    headers: {
      'Authorization': `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: {
      email: input.requester.email,
      name: input.requester.name,
      subject: `[${input.ticketRef}] ${input.subject}`,
      description: input.description,
      status: 2,
      priority: priorityForFreshdesk(input.priority),
      tags: ['assetnode', input.category, input.ticketRef.toLowerCase()],
    },
  }
}
