import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { AILog } from '../../models/AILog'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

const aiLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', {
    preHandler: [requireRole('admin', 'manager')]
  }, async (request) => {
    return await AILog.find(getTenantFilter(request)).sort({ timestamp: -1 })
  })

  fastify.get('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const log = await AILog.findOne({ _id: id, ...getTenantFilter(request) })
    if (!log) return reply.code(404).send({ error: 'AI log not found' })
    return log
  })

  fastify.post('/', {
    schema: {
      body: Type.Object({
        prompt: Type.String({ minLength: 1, maxLength: 5000 }),
        rawResponse: Type.String({ maxLength: 50000 }),
        parsedResponse: Type.Array(Type.Object({
          price: Type.Number({ minimum: 0 }),
          source: Type.String({ maxLength: 500 }),
          url: Type.String({ maxLength: 2000 })
        })),
        hardware: Type.Object({
          manufacturer: Type.String({ maxLength: 200 }),
          model: Type.String({ maxLength: 200 }),
          category: Type.Optional(Type.String({ maxLength: 100 }))
        })
      })
    }
  }, async (request, reply) => {
    const body = sanitizeBody(request.body as Record<string, unknown>)
    const aiLog = new AILog({ ...body, orgId: getOrgId(request) })
    const saved = await aiLog.save()
    return reply.code(201).send(saved)
  })
}

export default aiLogRoutes
