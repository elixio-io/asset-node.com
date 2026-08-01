import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  SupportTicket: {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn()
  },
  Organization: {
    findById: vi.fn(),
    updateOne: vi.fn()
  },
  createHelpdeskTicket: vi.fn(),
  isHelpdeskConfigured: vi.fn(),
  createGitLabIssue: vi.fn(),
  isGitLabTicketingConfigured: vi.fn(),
  sendSupportTicketNotification: vi.fn()
}))

vi.mock('../../../models/SupportTicket', () => ({ SupportTicket: mocks.SupportTicket }))
vi.mock('../../../models/Organization', () => ({ Organization: mocks.Organization }))
vi.mock('../helpdeskClient', () => ({
  createHelpdeskTicket: mocks.createHelpdeskTicket,
  isHelpdeskConfigured: mocks.isHelpdeskConfigured
}))
vi.mock('../gitlabClient', () => ({
  createGitLabIssue: mocks.createGitLabIssue,
  isGitLabTicketingConfigured: mocks.isGitLabTicketingConfigured
}))
vi.mock('../emailService', () => ({
  sendSupportTicketNotification: mocks.sendSupportTicketNotification
}))

const { processSupportTicketDelivery } = await import('../supportTicketDelivery')

const ticket = {
  _id: 'ticket-id',
  orgId: 'org-id',
  ticketRef: 'AN-00042',
  subject: 'Laptop cannot start',
  description: 'The assigned laptop no longer starts.',
  category: 'bug',
  priority: 'high',
  userName: 'Alex Meyer',
  userEmail: 'alex@example.com',
  metadata: {},
  deliveryAttempts: 1
}

function lease(value: unknown) {
  mocks.SupportTicket.findOneAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue(value) })
}

describe('support ticket durable delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lease(ticket)
    mocks.SupportTicket.updateOne.mockResolvedValue({ modifiedCount: 1 })
    mocks.Organization.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'org-id',
        name: 'Acme',
        settings: { integrations: { helpdesk: { enabled: true } } }
      })
    })
    mocks.Organization.updateOne.mockResolvedValue({ modifiedCount: 1 })
    mocks.isHelpdeskConfigured.mockReturnValue(true)
    mocks.isGitLabTicketingConfigured.mockReturnValue(false)
    mocks.sendSupportTicketNotification.mockResolvedValue(false)
  })

  it('persists the external reference before marking a helpdesk delivery complete', async () => {
    mocks.createHelpdeskTicket.mockResolvedValue({
      ok: true,
      provider: 'zendesk',
      externalTicketId: '91'
    })

    await expect(processSupportTicketDelivery('ticket-id')).resolves.toBe(true)

    expect(mocks.createHelpdeskTicket).toHaveBeenCalledWith(
      { enabled: true },
      expect.objectContaining({ ticketRef: 'AN-00042', organizationName: 'Acme' })
    )
    expect(mocks.SupportTicket.updateOne).toHaveBeenCalledWith(
      { _id: 'ticket-id' },
      { $set: { externalProvider: 'zendesk', externalTicketId: '91' } }
    )
    expect(mocks.SupportTicket.updateOne).toHaveBeenCalledWith(
      { _id: 'ticket-id', deliveryStatus: 'processing' },
      expect.objectContaining({
        $set: expect.objectContaining({ deliveryStatus: 'delivered', deliveryChannel: 'helpdesk' })
      })
    )
  })

  it('keeps a failed record retryable when no delivery channel accepts it', async () => {
    mocks.createHelpdeskTicket.mockResolvedValue({ ok: false })

    await expect(processSupportTicketDelivery('ticket-id')).resolves.toBe(false)

    expect(mocks.SupportTicket.updateOne).toHaveBeenCalledWith(
      { _id: 'ticket-id', deliveryStatus: 'processing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          deliveryStatus: 'failed',
          nextDeliveryAttemptAt: expect.any(Date)
        }),
        $unset: { deliveryLeaseUntil: 1 }
      })
    )
  })

  it('does not deliver when another worker owns the lease', async () => {
    lease(null)

    await expect(processSupportTicketDelivery('ticket-id')).resolves.toBe(false)

    expect(mocks.createHelpdeskTicket).not.toHaveBeenCalled()
    expect(mocks.SupportTicket.updateOne).not.toHaveBeenCalled()
  })
})
