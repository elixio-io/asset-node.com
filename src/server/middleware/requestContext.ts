import { AsyncLocalStorage } from 'node:async_hooks'
import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { User } from '../../models/User'


export interface RequestContext {
  userId?: string
  userEmail?: string
  orgId?: string
  ipAddress?: string
  userAgent?: string
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>()

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore()
}

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async () => {
    requestContextStorage.enterWith({})
  })

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const store = requestContextStorage.getStore()
    if (!store) return

    if (request.user) {
      store.userId = request.user.userId
      store.orgId = request.user.orgId

      try {
        const user = await User.findById(request.user.userId).select('email').lean()
        if (user) store.userEmail = (user as any).email
      } catch {
        store.userEmail = 'unknown'
      }
    }

    store.ipAddress = request.ip
    store.userAgent = request.headers['user-agent'] || undefined
  })
}

const requestContextPlugin = fp(plugin, {
  name: 'request-context',
  fastify: '>=4.0.0'
})

export default requestContextPlugin
