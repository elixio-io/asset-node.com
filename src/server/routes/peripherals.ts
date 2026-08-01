import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Peripheral } from '../../models/Peripheral'
import { Assignment } from '../../models/Assignment'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { checkLimit } from '../middleware/planLimits'
import { tryResolveStatusId } from '../services/statusResolver'
import { escapeRegex } from '../utils/inputSanitization'

const peripheralRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        categoryId: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String()),
        statusSlug: Type.Optional(Type.String()),
        search: Type.Optional(Type.String())
      })
    }
  }, async (request) => {
    const query = request.query as { categoryId?: string; statusId?: string; statusSlug?: string; search?: string }
    const filter: Record<string, unknown> = { ...getTenantFilter(request) }
    if (query.categoryId) filter.categoryId = query.categoryId
    if (query.statusId) {
      filter.statusId = query.statusId
    } else if (query.statusSlug) {
      const orgId = getOrgId(request)
      const resolvedId = await tryResolveStatusId(String(orgId), query.statusSlug)
      if (resolvedId) filter.statusId = resolvedId
      else return []
    }
    if (query.search) {
      const safeSearch = escapeRegex(query.search)
      const regex = { $regex: safeSearch, $options: 'i' }
      const mongoose = (await import('mongoose')).default
      const [mfrIds, catIds, empIds] = await Promise.all([
        mongoose.model('Manufacturer').distinct('_id', { name: regex, ...getTenantFilter(request) }),
        mongoose.model('Category').distinct('_id', { name: regex, ...getTenantFilter(request) }),
        mongoose.model('Employee').distinct('_id', {
          $or: [{ firstName: regex }, { lastName: regex }],
          ...getTenantFilter(request)
        })
      ])
      filter.$or = [
        { model: regex },
        { serialNumber: regex },
        { notes: regex },
        ...(mfrIds.length ? [{ manufacturerId: { $in: mfrIds } }] : []),
        ...(catIds.length ? [{ categoryId: { $in: catIds } }] : []),
        ...(empIds.length ? [{ assignedTo: { $in: empIds } }] : [])
      ]
    }
    return await Peripheral.find(filter)
      .populate('assignedTo', 'firstName lastName')
      .populate('categoryId', 'name icon color')
      .populate('statusId', 'name type color icon')
      .populate('manufacturerId', 'name')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .populate('supplierId', 'name')
      .sort({ createdAt: -1 })
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const peripheral = await Peripheral.findOne({ _id: id, ...getTenantFilter(request) })
      .populate('assignedTo', 'firstName lastName')
      .populate('categoryId', 'name icon color')
      .populate('statusId', 'name type color icon')
      .populate('manufacturerId', 'name')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .populate('supplierId', 'name')
    if (!peripheral) return reply.code(404).send({ error: 'Peripheral not found' })
    return peripheral
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager'), checkLimit('assets')],
    schema: {
      body: Type.Object({
        categoryId: Type.String(),
        model: Type.String({ minLength: 1, maxLength: 200 }),
        serialNumber: Type.Optional(Type.String({ maxLength: 100 })),
        manufacturerId: Type.Optional(Type.String()),
        supplierId: Type.Optional(Type.String()),
        locationId: Type.Optional(Type.String()),
        departmentId: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String()),
        quantity: Type.Optional(Type.Number({ minimum: 1 })),
        minimumQuantity: Type.Optional(Type.Number({ minimum: 0 })),
        purchaseDate: Type.Optional(Type.String()),
        purchasePrice: Type.Optional(Type.Number({ minimum: 0 })),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        orderNumber: Type.Optional(Type.String()),
        warrantyExpiry: Type.Optional(Type.String()),
        assignedTo: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String({ maxLength: 5000 }))
      })
    }
  }, async (request, reply) => {
    try {
      const body = sanitizeBody(request.body as Record<string, unknown>)
      const peripheral = new Peripheral({ ...body, orgId: getOrgId(request) })
      const saved = await peripheral.save()

      await createAuditEntry(request, 'create', 'Peripheral', String(saved._id), {
        after: saved.toObject()
      })

      return reply.code(201).send(saved)
    } catch (error: any) {
      if (error.code === 11000) {
        return reply.code(409).send({ error: 'Serial number already exists' })
      }
      throw error
    }
  })

  fastify.put('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        categoryId: Type.Optional(Type.String()),
        model: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        serialNumber: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
        manufacturerId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        supplierId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        locationId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        departmentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        statusId: Type.Optional(Type.String()),
        quantity: Type.Optional(Type.Number({ minimum: 1 })),
        minimumQuantity: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        purchaseDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        purchasePrice: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        orderNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        warrantyExpiry: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        assignedTo: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        notes: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()]))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await Peripheral.findOne({ _id: id, ...getTenantFilter(request) })
    if (!existing) return reply.code(404).send({ error: 'Peripheral not found' })

    const body = sanitizeBody(request.body as Record<string, unknown>)

    const objectIdFields = ['assignedTo', 'locationId', 'departmentId', 'supplierId', 'manufacturerId']
    for (const field of objectIdFields) {
      if (field in body && (body[field] === '' || body[field] === undefined)) {
        body[field] = null
      }
    }

    const updated = await Peripheral.findByIdAndUpdate(id, { $set: body }, {
      new: true, runValidators: true
    })

    if ('assignedTo' in body) {
      const oldEmployee = existing.assignedTo ? String(existing.assignedTo) : null
      const newEmployee = body.assignedTo ? String(body.assignedTo) : null

      if (oldEmployee && oldEmployee !== newEmployee) {
        await Assignment.updateMany(
          { employeeId: oldEmployee, status: 'active', ...getTenantFilter(request) },
          { $pull: { peripherals: id } }
        )
      }

      if (newEmployee && newEmployee !== oldEmployee) {
        await Assignment.updateOne(
          { employeeId: newEmployee, status: 'active', ...getTenantFilter(request) },
          { $addToSet: { peripherals: id } }
        )
      }
    }

    await createAuditEntry(request, 'update', 'Peripheral', id, {
      before: existing.toObject(), after: updated?.toObject()
    })

    return updated
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const peripheral = await Peripheral.findOne({ _id: id, ...getTenantFilter(request) })
    if (!peripheral) return reply.code(404).send({ error: 'Peripheral not found' })

    await createAuditEntry(request, 'delete', 'Peripheral', id, {
      before: peripheral.toObject()
    })

    await (Peripheral as any).softDelete(id)
    return { message: 'Peripheral moved to recycle bin' }
  })
}

export default peripheralRoutes
