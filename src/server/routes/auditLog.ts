import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { AuditLog } from '../../models/AuditLog'
import { authenticate } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { escapeRegex } from '../utils/inputSanitization'

const auditLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)



  fastify.get('/entity/:entityType/:entityId', {
    schema: {
      params: Type.Object({
        entityType: Type.String(),
        entityId: Type.String()
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 50 })),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 }))
      })
    }
  }, async (request) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string }
    const { limit = 50, page = 1 } = request.query as { limit?: number; page?: number }

    const orgId = getOrgId(request)
    const skip = (page - 1) * limit

    const [entries, total] = await Promise.all([
      AuditLog.find({ orgId, entityType, entityId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments({ orgId, entityType, entityId })
    ])

    return {
      data: entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  })



  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 50 })),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        entityType: Type.Optional(Type.String()),
        action: Type.Optional(Type.String()),
        userId: Type.Optional(Type.String()),
        search: Type.Optional(Type.String())
      })
    }
  }, async (request) => {
    const {
      limit = 50,
      page = 1,
      entityType,
      action,
      userId,
      search
    } = request.query as {
      limit?: number
      page?: number
      entityType?: string
      action?: string
      userId?: string
      search?: string
    }

    const orgId = getOrgId(request)
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = { orgId, action: { $ne: 'impersonate' } }
    if (entityType) filter.entityType = entityType
    if (action) filter.action = action
    if (userId) filter.userId = userId
    if (search) {
      const safeSearch = escapeRegex(search)
      filter.$or = [
        { userEmail: { $regex: safeSearch, $options: 'i' } },
        { entityType: { $regex: safeSearch, $options: 'i' } },
        { entityId: { $regex: safeSearch, $options: 'i' } }
      ]
    }

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ])

    return {
      data: entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  })
}

export default auditLogRoutes
