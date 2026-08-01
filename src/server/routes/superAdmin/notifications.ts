import { FastifyPluginAsync } from 'fastify'
import { dispatchPlatformEvent } from '../../services/platformNotifier'

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/notifications/config', async () => {
    return {
      maintainerEmail: process.env.SMTP_FROM ? '✅ configured' : '❌ not set',
      webhookUrl: process.env.MAINTAINER_WEBHOOK_URL ? '✅ configured' : '❌ not set',
      webhookSecret: process.env.MAINTAINER_WEBHOOK_SECRET ? '✅ configured' : '❌ not set (payloads unsigned)',
      googleChatWebhook: process.env.MAINTAINER_GOOGLE_CHAT_WEBHOOK_URL ? '✅ configured' : '❌ not set',
      note: 'Edit .env to change MAINTAINER_EMAIL, MAINTAINER_WEBHOOK_URL, MAINTAINER_WEBHOOK_SECRET, MAINTAINER_GOOGLE_CHAT_WEBHOOK_URL'
    }
  })

  fastify.post('/notifications/test', async (_request, reply) => {
    try {
      await dispatchPlatformEvent('org.registered', {
        orgName: 'Test Organization',
        adminEmail: 'alexander@hohnhorst.com',
        source: 'manual-test',
        triggeredAt: new Date().toISOString()
      })
      return { success: true, message: 'Test event dispatched to all configured channels.' }
    } catch {
      return reply.code(500).send({ success: false, error: 'Failed to dispatch test event' })
    }
  })
}

export default notificationRoutes
