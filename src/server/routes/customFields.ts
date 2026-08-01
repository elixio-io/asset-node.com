import { FastifyPluginAsync } from 'fastify'
import { CustomField, CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES } from '../../models/CustomField'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'
import { checkLimit } from '../middleware/planLimits'

const customFieldRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { entityType } = request.query as { entityType?: string }
    const filter = entityType
      ? { ...tenantFilter, entityType, isActive: true }
      : { ...tenantFilter, isActive: true }
    return CustomField.find(filter).sort({ entityType: 1, order: 1, name: 1 }).lean()
  })

  fastify.get('/entity/:entityType', async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { entityType } = request.params as { entityType: string }
    if (!CUSTOM_FIELD_ENTITIES.includes(entityType as any)) {
      return reply.status(400).send({ error: `Invalid entityType. Valid: ${CUSTOM_FIELD_ENTITIES.join(', ')}` })
    }
    return CustomField.find({ ...tenantFilter, entityType, isActive: true })
      .sort({ order: 1, name: 1 })
      .lean()
  })

  fastify.post('/', { preHandler: [requireRole('admin'), checkLimit('customFields')] }, async (request, reply) => {
    const orgId = getOrgId(request)
    const body = request.body as any

    if (!body.name || !body.entityType || !body.fieldType) {
      return reply.status(400).send({ error: 'name, entityType, and fieldType are required' })
    }
    if (!CUSTOM_FIELD_ENTITIES.includes(body.entityType)) {
      return reply.status(400).send({ error: `Invalid entityType. Valid: ${CUSTOM_FIELD_ENTITIES.join(', ')}` })
    }
    if (!CUSTOM_FIELD_TYPES.includes(body.fieldType)) {
      return reply.status(400).send({ error: `Invalid fieldType. Valid: ${CUSTOM_FIELD_TYPES.join(', ')}` })
    }

    const key = body.key || body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    const field = await CustomField.create({
      orgId,
      name: body.name,
      key,
      entityType: body.entityType,
      fieldType: body.fieldType,
      options: body.options || [],
      required: body.required || false,
      defaultValue: body.defaultValue ?? null,
      helpText: body.helpText || '',
      order: body.order ?? 0,
      isActive: true
    })

    return reply.status(201).send(field)
  })

  fastify.put('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const updates = request.body as any
    delete updates.orgId
    delete updates.key

    const field = await CustomField.findOneAndUpdate(
      { _id: id, ...tenantFilter },
      updates,
      { new: true }
    )
    if (!field) return reply.status(404).send({ error: 'Custom field not found' })
    return field
  })

  fastify.post('/reorder', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { items } = request.body as { items: { id: string; order: number }[] }

    if (!items?.length) return reply.status(400).send({ error: 'items array is required' })

    const ops = items.map(item => ({
      updateOne: {
        filter: { _id: item.id, ...tenantFilter },
        update: { $set: { order: item.order } }
      }
    }))

    await CustomField.bulkWrite(ops)
    return { success: true }
  })

  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const field = await CustomField.findOneAndUpdate(
      { _id: id, ...tenantFilter },
      { isActive: false },
      { new: true }
    )
    if (!field) return reply.status(404).send({ error: 'Custom field not found' })
    return { success: true }
  })
}

export default customFieldRoutes
