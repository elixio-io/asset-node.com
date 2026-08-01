import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import mongoose from 'mongoose'
import { Consumable } from '../../models/Consumable'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

function getAggregateFilter(request: import('fastify').FastifyRequest) {
  const tf = getTenantFilter(request)
  return { orgId: new mongoose.Types.ObjectId(tf.orgId) }
}

const consumableRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const consumables = await Consumable.find(tenantFilter)
      .populate('locationId', 'name')
      .populate('categoryId', 'name icon color')
      .populate('manufacturerId', 'name')
      .populate('supplierId', 'name')
      .populate('departmentId', 'name')
      .populate('checkouts.employeeId', 'firstName lastName email')
      .populate('checkouts.checkedOutBy', 'firstName lastName')
      .sort({ name: 1 })
    return consumables
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const consumable = await Consumable.findOne({ _id: id, ...getTenantFilter(request) })
      .populate('locationId', 'name')
      .populate('categoryId', 'name icon color')
      .populate('manufacturerId', 'name')
      .populate('supplierId', 'name')
      .populate('departmentId', 'name')
      .populate('checkouts.employeeId', 'firstName lastName email')
      .populate('checkouts.checkedOutBy', 'firstName lastName')
    if (!consumable) return reply.code(404).send({ error: 'Consumable not found' })
    return consumable
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        categoryId: Type.Optional(Type.String()),
        manufacturerId: Type.Optional(Type.String()),
        modelNumber: Type.Optional(Type.String()),
        locationId: Type.Optional(Type.String()),
        departmentId: Type.Optional(Type.String()),
        totalQuantity: Type.Number({ minimum: 0 }),
        minimumQuantity: Type.Optional(Type.Number({ minimum: 0 })),
        unitCost: Type.Optional(Type.Number({ minimum: 0 })),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        purchaseDate: Type.Optional(Type.String()),
        supplierId: Type.Optional(Type.String()),
        orderNumber: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const body = sanitizeBody(request.body as Record<string, unknown>)
    const consumable = await Consumable.create({
      ...body,
      orgId: getOrgId(request),
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate as string) : undefined
    })

    await createAuditEntry(request, 'create', 'Consumable', String(consumable._id), {
      after: { name: consumable.name, totalQuantity: consumable.totalQuantity }
    })

    return reply.code(201).send(consumable)
  })

  fastify.patch('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = sanitizeBody(request.body as Record<string, unknown>)

    const consumable = await Consumable.findOneAndUpdate(
      { _id: id, ...getTenantFilter(request) },
      { $set: body },
      { new: true, runValidators: true }
    )

    if (!consumable) return reply.code(404).send({ error: 'Consumable not found' })
    return consumable
  })

  fastify.post('/:id/checkout', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        employeeId: Type.String(),
        quantity: Type.Number({ minimum: 1 }),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { employeeId, quantity, notes } = request.body as {
      employeeId: string
      quantity: number
      notes?: string
    }
    const user = request.user as { userId: string }

    const consumable = await Consumable.findOne({ _id: id, ...getTenantFilter(request) })
    if (!consumable) return reply.code(404).send({ error: 'Consumable not found' })

    if (consumable.totalQuantity < quantity) {
      return reply.code(400).send({
        error: 'Insufficient stock',
        available: consumable.totalQuantity,
        requested: quantity
      })
    }

    consumable.totalQuantity -= quantity
    consumable.checkouts.push({
      employeeId: employeeId as any,
      quantity,
      checkedOutBy: user.userId as any,
      checkedOutAt: new Date(),
      notes: notes || ''
    })
    await consumable.save()

    await createAuditEntry(request, 'update', 'Consumable', id, {
      after: { action: 'checkout', employeeId, quantity, remaining: consumable.totalQuantity }
    })

    return {
      message: `${quantity} unit(s) checked out`,
      remaining: consumable.totalQuantity,
      isLowStock: consumable.totalQuantity <= consumable.minimumQuantity
    }
  })

  fastify.post('/:id/restock', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        quantity: Type.Number({ minimum: 1 }),
        unitCost: Type.Optional(Type.Number({ minimum: 0 })),
        supplierId: Type.Optional(Type.String()),
        orderNumber: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { quantity, unitCost, supplierId, orderNumber } = request.body as {
      quantity: number
      unitCost?: number
      supplierId?: string
      orderNumber?: string
    }

    const consumable = await Consumable.findOne({ _id: id, ...getTenantFilter(request) })
    if (!consumable) return reply.code(404).send({ error: 'Consumable not found' })

    consumable.totalQuantity += quantity
    if (unitCost != null) consumable.unitCost = unitCost
    if (supplierId) consumable.supplierId = supplierId as any
    if (orderNumber) consumable.orderNumber = orderNumber
    await consumable.save()

    await createAuditEntry(request, 'update', 'Consumable', id, {
      after: { action: 'restock', quantity, newTotal: consumable.totalQuantity }
    })

    return {
      message: `${quantity} unit(s) restocked`,
      totalQuantity: consumable.totalQuantity,
      isLowStock: consumable.totalQuantity <= consumable.minimumQuantity
    }
  })

  fastify.get('/alerts/low-stock', async (request) => {
    const tenantFilter = getTenantFilter(request)

    const lowStock = await Consumable.find({
      ...tenantFilter,
      isActive: true,
      $expr: { $lte: ['$totalQuantity', '$minimumQuantity'] }
    })
      .populate('locationId', 'name')
      .sort({ totalQuantity: 1 })

    return {
      alerts: lowStock.map(c => ({
        _id: c._id,
        name: c.name,
      category: (c.categoryId as any)?.name || null,
        totalQuantity: c.totalQuantity,
        minimumQuantity: c.minimumQuantity,
        location: (c.locationId as any)?.name || null
      })),
      totalAlerts: lowStock.length
    }
  })

  fastify.get('/summary/stats', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const aggFilter = getAggregateFilter(request)

    const [totalItems, categoryBreakdown, lowStockCount, totalValue] = await Promise.all([
      Consumable.countDocuments({ ...tenantFilter, isActive: true, deletedAt: null }),
      Consumable.aggregate([
        { $match: { ...aggFilter, isActive: true, deletedAt: null } },
        { $group: { _id: '$categoryId', count: { $sum: 1 }, totalStock: { $sum: '$totalQuantity' } } },
        { $sort: { count: -1 } }
      ]),
      Consumable.countDocuments({
        ...tenantFilter,
        isActive: true,
        deletedAt: null,
        $expr: { $lte: ['$totalQuantity', '$minimumQuantity'] }
      }),
      Consumable.aggregate([
        { $match: { ...aggFilter, isActive: true, deletedAt: null } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$totalQuantity', '$unitCost'] } },
            totalUnits: { $sum: '$totalQuantity' }
          }
        }
      ])
    ])

    const valueStats = totalValue[0] || { totalValue: 0, totalUnits: 0 }

    const { Category } = await import('../../models/Category')
    const catIds = categoryBreakdown.map((c: any) => c._id).filter(Boolean)
    const catDocs = await Category.find({ _id: { $in: catIds } }).select('name').lean()
    const catMap = new Map(catDocs.map(c => [String(c._id), c.name]))

    return {
      totalItems,
      totalUnits: valueStats.totalUnits,
      totalValue: Math.round(valueStats.totalValue * 100) / 100,
      lowStockAlerts: lowStockCount,
      categoryBreakdown: categoryBreakdown.map((c: any) => ({
        category: catMap.get(String(c._id)) || String(c._id),
        count: c.count,
        totalStock: c.totalStock
      }))
    }
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const consumable = await Consumable.findOne({
      _id: id,
      ...getTenantFilter(request)
    })
    if (!consumable) return reply.code(404).send({ error: 'Consumable not found' })

    await createAuditEntry(request, 'delete', 'Consumable', id, {
      before: { name: consumable.name }
    })

    await (Consumable as any).softDelete(id)
    return { message: 'Consumable moved to recycle bin' }
  })
}

export default consumableRoutes
