import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Location } from '../../models/Location'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

const AddressSchema = Type.Optional(Type.Object({
  street: Type.Optional(Type.String({ maxLength: 200 })),
  city: Type.Optional(Type.String({ maxLength: 100 })),
  state: Type.Optional(Type.String({ maxLength: 100 })),
  zip: Type.Optional(Type.String({ maxLength: 20 })),
  country: Type.Optional(Type.String({ maxLength: 100 }))
}))

const locationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    return await Location.find(getTenantFilter(request)).sort({ name: 1 })
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const location = await Location.findOne({ _id: id, ...getTenantFilter(request) })
    if (!location) return reply.code(404).send({ error: 'Location not found' })
    return location
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        address: AddressSchema,
        contactName: Type.Optional(Type.String({ maxLength: 200 })),
        contactEmail: Type.Optional(Type.String({ format: 'email' })),
        contactPhone: Type.Optional(Type.String({ maxLength: 50 })),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request, reply) => {
    const body = sanitizeBody(request.body as Record<string, unknown>)
    const location = new Location({ ...body, orgId: getOrgId(request) })
    const saved = await location.save()

    await createAuditEntry(request, 'create', 'Location', String(saved._id), {
      after: saved.toObject()
    })

    return reply.code(201).send(saved)
  })

  fastify.put('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        address: AddressSchema,
        contactName: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
        contactEmail: Type.Optional(Type.Union([Type.String({ format: 'email' }), Type.Null()])),
        contactPhone: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await Location.findOne({ _id: id, ...getTenantFilter(request) })
    if (!existing) return reply.code(404).send({ error: 'Location not found' })

    const body = sanitizeBody(request.body as Record<string, unknown>)
    const updated = await Location.findByIdAndUpdate(id, { $set: body }, {
      new: true, runValidators: true
    })

    await createAuditEntry(request, 'update', 'Location', id, {
      before: existing.toObject(), after: updated?.toObject()
    })

    return updated
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const location = await Location.findOne({ _id: id, ...getTenantFilter(request) })
    if (!location) return reply.code(404).send({ error: 'Location not found' })

    await createAuditEntry(request, 'delete', 'Location', id, {
      before: location.toObject()
    })

    await Location.findByIdAndDelete(id)
    return { message: 'Location deleted successfully' }
  })
}

export default locationRoutes
