import { FastifyPluginAsync } from 'fastify'
import { Category, CATEGORY_ENTITY_TYPES } from '../../models/Category'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'

const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { entityType } = request.query as { entityType?: string }
    const filter = entityType ? { ...tenantFilter, entityType } : tenantFilter
    const categories = await Category.find(filter).sort({ entityType: 1, name: 1 }).lean()
    return categories
  })

  fastify.get('/:id', async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const cat = await Category.findOne({ _id: id, ...tenantFilter }).lean()
    if (!cat) return reply.status(404).send({ error: 'Category not found' })
    return cat
  })

  fastify.post('/', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const orgId = getOrgId(request)
    const { name, entityType, icon, color, description, isDefault } = request.body as any
    if (!name || !entityType) return reply.status(400).send({ error: 'name and entityType are required' })
    if (!CATEGORY_ENTITY_TYPES.includes(entityType)) {
      return reply.status(400).send({ error: `Invalid entityType. Valid: ${CATEGORY_ENTITY_TYPES.join(', ')}` })
    }
    const cat = await Category.create({ orgId, name, entityType, icon, color, description, isDefault })
    return reply.status(201).send(cat)
  })

  fastify.put('/:id', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const updates = request.body as any
    delete updates.orgId
    const cat = await Category.findOneAndUpdate({ _id: id, ...tenantFilter }, updates, { new: true })
    if (!cat) return reply.status(404).send({ error: 'Category not found' })
    return cat
  })

  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const cat = await Category.findOneAndDelete({ _id: id, ...tenantFilter })
    if (!cat) return reply.status(404).send({ error: 'Category not found' })
    return { success: true }
  })
}

export default categoryRoutes
