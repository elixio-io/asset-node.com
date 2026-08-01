import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ApiKey } from '../../models/ApiKey'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { requireFeature } from '../middleware/planLimits'

const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin'))
  fastify.addHook('preHandler', requireFeature('api'))

  fastify.get('/', async (request) => {
    const orgId = getOrgId(request)
    return await ApiKey.find({ orgId })
      .select('name keyPrefix lastUsedAt createdBy createdAt')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
  })

  fastify.post('/', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 100 })
      })
    }
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const { name } = request.body as { name: string }

    const { rawKey, keyHash, keyPrefix } = (ApiKey as any).generateKey()

    const apiKey = await ApiKey.create({
      orgId,
      name,
      keyHash,
      keyPrefix,
      createdBy: (request.user as any).userId
    })

    return reply.code(201).send({
      _id: apiKey._id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      createdAt: apiKey.createdAt,
      _warning: 'Copy this key now. It will not be shown again.'
    })
  })

  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const orgId = getOrgId(request)

    const result = await ApiKey.findOneAndDelete({ _id: id, orgId })
    if (!result) return reply.code(404).send({ error: 'API key not found' })

    return { message: 'API key revoked' }
  })
}

export default apiKeyRoutes
