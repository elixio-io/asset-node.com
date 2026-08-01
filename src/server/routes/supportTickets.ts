import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { SupportTicket } from '../../models/SupportTicket'
import { authenticate } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { createServiceLogger, redactSensitive } from '../services/logger'
import { processSupportTicketDelivery } from '../services/supportTicketDelivery'


const log = createServiceLogger('Support')



export function scrubSupportText(s: string): string {
  return String(redactSensitive(s, 0))
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/((?:access[_-]?token|refresh[_-]?token|token|authorization|password|secret|api[_-]?key|code|state)\s*[:=]\s*)[^\s&,'"}<>]+/gi, '$1[REDACTED]')
    .replace(/(?:https?:\/\/|\/)[^\s'"<>]*[?#][^\s'"<>]*/gi, value => value.split(/[?#]/, 1)[0])
}

export function scrubSupportUrl(value: string): string {
  const input = String(value).trim().slice(0, 500)
  try {
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(input)
    const parsed = new URL(input, 'https://support.invalid')
    return absolute ? `${parsed.origin}${parsed.pathname}` : parsed.pathname
  } catch {
    return input.split(/[?#]/, 1)[0]
  }
}

const supportTicketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.post('/tickets', {
    schema: {
      body: Type.Object({
        subject: Type.String({ minLength: 3, maxLength: 200 }),
        description: Type.String({ minLength: 10, maxLength: 5000 }),
        category: Type.Optional(Type.Union([
          Type.Literal('bug'),
          Type.Literal('feature'),
          Type.Literal('question'),
          Type.Literal('billing'),
          Type.Literal('other'),
        ])),
        priority: Type.Optional(Type.Union([
          Type.Literal('low'),
          Type.Literal('medium'),
          Type.Literal('high'),
          Type.Literal('critical'),
        ])),
        metadata: Type.Optional(Type.Object({
          url: Type.Optional(Type.String({ maxLength: 500 })),
          userAgent: Type.Optional(Type.String({ maxLength: 500 })),
          appVersion: Type.Optional(Type.String({ maxLength: 50 })),
          errorStack: Type.Optional(Type.String({ maxLength: 10000 })),
          screenSize: Type.Optional(Type.String({ maxLength: 20 })),


          clientLog: Type.Optional(Type.String({ maxLength: 10000 })),
        })),
      }),
    },
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const userId = request.user?.userId
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' })

    const { User } = await import('../../models/User')
    const user = await User.findById(userId).lean() as any
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const { subject, description, category, priority, metadata } = request.body as {
      subject: string
      description: string
      category?: string
      priority?: string
      metadata?: Record<string, string>
    }

    const cleanMeta: Record<string, string> = {}
    if (metadata) {
      if (metadata.url) cleanMeta.url = scrubSupportUrl(metadata.url)
      if (metadata.userAgent) cleanMeta.userAgent = metadata.userAgent
      if (metadata.appVersion) cleanMeta.appVersion = metadata.appVersion
      if (metadata.screenSize) cleanMeta.screenSize = metadata.screenSize
      if (metadata.errorStack) {
        cleanMeta.errorStack = scrubSupportText(metadata.errorStack.substring(0, 3000))
      }
      if (metadata.clientLog) {
        cleanMeta.clientLog = scrubSupportText(metadata.clientLog.substring(0, 10000))
      }
    }

    const cleanSubject = scrubSupportText(subject)
    const cleanDescription = scrubSupportText(description)

    const ticket = new SupportTicket({
      orgId,
      userId,
      userEmail: user.email,
      userName:
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        user.email,
      subject: cleanSubject,
      description: cleanDescription,
      category: category || 'bug',
      priority: priority || 'medium',
      metadata: cleanMeta,
    })

    await ticket.save()

    log.info(
      { orgId, ticketRef: ticket.ticketRef, category: ticket.category, priority: ticket.priority },
      'Support ticket created'
    )




    processSupportTicketDelivery(String(ticket._id)).catch(err =>
      log.error({ errName: (err as Error)?.name, ticketRef: ticket.ticketRef }, 'Ticket delivery kick failed')
    )

    try {
      const { sendSupportTicketConfirmation } = await import('../services/emailService')
      sendSupportTicketConfirmation(
        ticket.userEmail,
        ticket.userName.split(' ')[0] || 'Nutzer',
        ticket.ticketRef,
        cleanSubject
      ).catch(err => log.error({ errName: (err as Error)?.name, ticketRef: ticket.ticketRef }, 'Confirmation email failed'))
    } catch (err) {
      log.error({ errName: (err as Error)?.name }, 'Confirmation email dispatch failed')
    }

    return reply.code(201).send({
      id: ticket._id,
      ticketRef: ticket.ticketRef,
      status: ticket.status,
      createdAt: ticket.createdAt,
    })
  })

  fastify.get('/tickets', async (request) => {
    const orgId = getOrgId(request)
    const userId = request.user?.userId

    const tickets = await SupportTicket.find({ orgId, userId })
      .select('ticketRef subject category priority status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return tickets
  })

  fastify.get('/tickets/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
    },
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const userId = request.user?.userId
    const { id } = request.params as { id: string }

    const ticket = await SupportTicket.findOne({ _id: id, orgId, userId })


      .select('ticketRef subject description category priority status metadata resolvedAt createdAt updatedAt deliveryStatus deliveredAt')
      .lean()

    if (!ticket) return reply.code(404).send({ error: 'Ticket not found' })
    return ticket
  })
}

export default supportTicketRoutes
