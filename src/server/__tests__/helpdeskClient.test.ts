import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHelpdeskTicket, isHelpdeskConfigured } from '../services/helpdeskClient'

const input = {
  ticketRef: 'AN-00042',
  subject: 'Laptop cannot start',
  description: 'The assigned laptop no longer starts.',
  category: 'bug',
  priority: 'high' as const,
  requester: { name: 'Alex Meyer', email: 'alex@example.com' },
  organizationName: 'Example GmbH',
}

afterEach(() => vi.unstubAllGlobals())

describe('helpdeskClient', () => {
  it('requires a provider-owned subdomain and Zendesk agent email', () => {
    expect(isHelpdeskConfigured({ enabled: true, provider: 'zendesk', subdomain: 'acme', apiToken: 'x' })).toBe(false)
    expect(isHelpdeskConfigured({ enabled: true, provider: 'zendesk', subdomain: 'acme', email: 'not-an-email', apiToken: 'x' })).toBe(false)
    expect(isHelpdeskConfigured({ enabled: true, provider: 'zendesk', subdomain: 'https://evil.test', email: 'a@b.test', apiToken: 'x' })).toBe(false)
    expect(isHelpdeskConfigured({ enabled: true, provider: 'zendesk', subdomain: 'acme', email: 'a@b.test', apiToken: 'x' })).toBe(true)
    expect(isHelpdeskConfigured({ enabled: true, provider: 'freshdesk', subdomain: 'acme', apiToken: 'x' })).toBe(true)
  })

  it('creates a Zendesk ticket with an idempotency key and requester', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ ticket: { id: 91 } }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createHelpdeskTicket({
      enabled: true, provider: 'zendesk', subdomain: 'acme', email: 'agent@acme.test', apiToken: 'secret'
    }, input)

    expect(result).toEqual({ ok: true, provider: 'zendesk', externalTicketId: '91' })
    expect(fetchMock).toHaveBeenCalledWith('https://acme.zendesk.com/api/v2/tickets', expect.objectContaining({ method: 'POST' }))
    const options = fetchMock.mock.calls[0][1]
    expect(options.headers['Idempotency-Key']).toBe('AN-00042')
    expect(JSON.parse(options.body).ticket.requester.email).toBe('alex@example.com')
  })

  it('maps critical tickets to Freshdesk priority four', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 17 }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createHelpdeskTicket({
      enabled: true, provider: 'freshdesk', subdomain: 'acme', apiToken: 'secret'
    }, { ...input, priority: 'critical' })

    expect(result.externalTicketId).toBe('17')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).priority).toBe(4)
  })
})
