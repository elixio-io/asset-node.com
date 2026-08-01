import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { NotificationPreference } from '../../models/NotificationPreference'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { sendTestNotification } from '../services/notificationDispatcher'
import { isExternalUrl } from '../services/workflowWebhookSecurity'

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin'))

  fastify.get('/preferences', async (request) => {
    const orgId = getOrgId(request)
    let prefs = await NotificationPreference.findOne({ orgId })
    if (!prefs) {
      prefs = await NotificationPreference.create({ orgId })
    }
    return prefs
  })

  fastify.patch('/preferences', {
    schema: {
      body: Type.Object({
        channels: Type.Optional(Type.Object({
          email: Type.Optional(Type.Object({
            enabled: Type.Optional(Type.Boolean()),
            address: Type.Optional(Type.String())
          })),
          slack: Type.Optional(Type.Object({
            enabled: Type.Optional(Type.Boolean()),
            webhookUrl: Type.Optional(Type.String())
          })),
          teams: Type.Optional(Type.Object({
            enabled: Type.Optional(Type.Boolean()),
            webhookUrl: Type.Optional(Type.String())
          }))
        })),
        events: Type.Optional(Type.Record(
          Type.String(),
          Type.Object({
            email: Type.Optional(Type.Boolean()),
            slack: Type.Optional(Type.Boolean()),
            teams: Type.Optional(Type.Boolean())
          })
        )),
        intervals: Type.Optional(Type.Object({
          first: Type.Optional(Type.Number()),
          second: Type.Optional(Type.Number()),
          third: Type.Optional(Type.Number()),
          fourth: Type.Optional(Type.Number())
        }))
      })
    }
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const body = request.body as Record<string, unknown>

    const requestedChannels = body.channels as Record<string, { webhookUrl?: unknown }> | undefined
    for (const channel of ['slack', 'teams']) {
      const webhookUrl = requestedChannels?.[channel]?.webhookUrl
      if (webhookUrl !== undefined && webhookUrl !== '' && !isExternalUrl(String(webhookUrl))) {
        return reply.code(400).send({
          error: `${channel} webhook URL must use HTTPS and a public, fully-qualified host`
        })
      }
    }

    let prefs = await NotificationPreference.findOne({ orgId })
    if (!prefs) {
      prefs = new NotificationPreference({ orgId })
    }

    if (body.channels) {
      const ch = body.channels as Record<string, Record<string, unknown>>
      for (const [channel, config] of Object.entries(ch)) {
        if ((prefs.channels as any)[channel]) {
          Object.assign((prefs.channels as any)[channel], config)
        }
      }
    }

    if (body.events) {
      const ev = body.events as Record<string, Record<string, boolean>>
      for (const [event, toggles] of Object.entries(ev)) {
        if ((prefs.events as any)[event]) {
          Object.assign((prefs.events as any)[event], toggles)
        }
      }
    }

    if (body.intervals) {
      if (!prefs.intervals) {
        (prefs as any).intervals = {}
      }
      Object.assign(prefs.intervals!, body.intervals)
    }

    prefs.markModified('channels')
    prefs.markModified('events')
    prefs.markModified('intervals')
    await prefs.save()

    return prefs
  })

  fastify.post('/test', {
    schema: {
      body: Type.Object({
        channel: Type.Union([
          Type.Literal('email'), Type.Literal('slack'), Type.Literal('teams')
        ]),
        target: Type.String()
      })
    }
  }, async (request) => {
    const { channel, target } = request.body as { channel: 'email' | 'slack' | 'teams'; target: string }
    return await sendTestNotification(channel, target)
  })
}

export default notificationRoutes
