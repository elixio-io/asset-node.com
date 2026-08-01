import { FastifyPluginAsync } from 'fastify'
import { Status, STATUS_TYPES } from '../../models/Status'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'
import { clearStatusCache } from '../services/statusResolver'

const statusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { type } = request.query as { type?: string }
    const filter = type ? { ...tenantFilter, type } : tenantFilter
    const statuses = await Status.find(filter).sort({ isSystem: -1, type: 1, name: 1 }).lean()
    return statuses
  })

  fastify.get('/:id', async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const status = await Status.findOne({ _id: id, ...tenantFilter }).lean()
    if (!status) return reply.status(404).send({ error: 'Status not found' })
    return status
  })

  fastify.post('/', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const orgId = getOrgId(request)
    const { name, type, color, icon, description, isDefault, slug } = request.body as any
    if (!name || !type) return reply.status(400).send({ error: 'name and type are required' })
    if (!STATUS_TYPES.includes(type)) {
      return reply.status(400).send({ error: `Invalid type. Valid: ${STATUS_TYPES.join(', ')}` })
    }
    const status = await Status.create({ orgId, name, type, color, icon, description, isDefault, slug: slug || undefined })
    clearStatusCache(String(orgId))
    return reply.status(201).send(status)
  })

  fastify.put('/:id', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const updates = request.body as any

    const existing = await Status.findOne({ _id: id, ...tenantFilter })
    if (!existing) return reply.status(404).send({ error: 'Status not found' })

    if (existing.isSystem) {
      delete updates.slug
      delete updates.isSystem
    }
    delete updates.orgId

    const status = await Status.findByIdAndUpdate(id, updates, { new: true })
    clearStatusCache(String(tenantFilter.orgId))
    return status
  })

  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }

    const status = await Status.findOne({ _id: id, ...tenantFilter })
    if (!status) return reply.status(404).send({ error: 'Status not found' })

    if (status.isSystem) {
      return reply.status(403).send({ error: 'System statuses cannot be deleted. You can rename or change their appearance.' })
    }

    await Status.findByIdAndDelete(id)
    clearStatusCache(String(tenantFilter.orgId))
    return { success: true }
  })
}

export default statusRoutes
