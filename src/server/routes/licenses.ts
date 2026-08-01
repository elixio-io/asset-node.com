import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import mongoose from 'mongoose'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

function getAggregateFilter(request: import('fastify').FastifyRequest) {
  const tf = getTenantFilter(request)
  return { orgId: new mongoose.Types.ObjectId(tf.orgId) }
}

const licenseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const licenses = await SoftwareLicense.find(tenantFilter)
      .populate('seats.employeeId', 'firstName lastName email')
      .populate('seats.checkedOutBy', 'firstName lastName')
      .populate('categoryId', 'name icon color')
      .populate('manufacturerId', 'name')
      .populate('supplierId', 'name')
      .sort({ name: 1 })
    return licenses
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const license = await SoftwareLicense.findOne({ _id: id, ...getTenantFilter(request) })
      .populate('seats.employeeId', 'firstName lastName email department')
      .populate('seats.checkedOutBy', 'firstName lastName')
      .populate('categoryId', 'name icon color')
      .populate('manufacturerId', 'name')
      .populate('supplierId', 'name')
    if (!license) return reply.code(404).send({ error: 'License not found' })
    return license
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        publisher: Type.Optional(Type.String()),
        categoryId: Type.Optional(Type.String()),
        licenseType: Type.Optional(Type.Union([
          Type.Literal('perpetual'), Type.Literal('subscription'),
          Type.Literal('oem'), Type.Literal('volume'),
          Type.Literal('freeware'), Type.Literal('open-source')
        ])),
        licenseKey: Type.Optional(Type.String()),
        totalSeats: Type.Number({ minimum: -1 }),
        costPerSeat: Type.Optional(Type.Number({ minimum: 0 })),
        billingCycle: Type.Optional(Type.Union([
          Type.Literal('monthly'), Type.Literal('annual'),
          Type.Literal('one-time'), Type.Literal('other')
        ])),
        purchaseDate: Type.Optional(Type.String()),
        expirationDate: Type.Optional(Type.String()),
        renewalDate: Type.Optional(Type.String()),
        version: Type.Optional(Type.String()),
        vendor: Type.Optional(Type.String()),
        purchaseOrderNumber: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const body = sanitizeBody(request.body as Record<string, unknown>)
    const license = await SoftwareLicense.create({
      ...body,
      orgId: getOrgId(request),
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate as string) : undefined,
      expirationDate: body.expirationDate ? new Date(body.expirationDate as string) : undefined,
      renewalDate: body.renewalDate ? new Date(body.renewalDate as string) : undefined
    })

    await createAuditEntry(request, 'create', 'SoftwareLicense', String(license._id), {
      after: { name: license.name, totalSeats: license.totalSeats }
    })

    return reply.code(201).send(license)
  })

  fastify.patch('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = sanitizeBody(request.body as Record<string, unknown>)

    const license = await SoftwareLicense.findOneAndUpdate(
      { _id: id, ...getTenantFilter(request) },
      { $set: body },
      { new: true, runValidators: true }
    )

    if (!license) return reply.code(404).send({ error: 'License not found' })
    return license
  })

  fastify.post('/:id/checkout', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        employeeIds: Type.Array(Type.String()),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { employeeIds, notes } = request.body as { employeeIds: string[]; notes?: string }
    const user = request.user as { userId: string }

    const license = await SoftwareLicense.findOne({ _id: id, ...getTenantFilter(request) })
    if (!license) return reply.code(404).send({ error: 'License not found' })

    if (!license.seats) license.seats = []

    if (license.totalSeats !== -1) {
      const availableSeats = license.totalSeats - license.seats.length
      if (employeeIds.length > availableSeats) {
        return reply.code(400).send({
          error: `Not enough seats available. Requested: ${employeeIds.length}, Available: ${availableSeats}`,
          totalSeats: license.totalSeats,
          usedSeats: license.seats.length
        })
      }
    }

    let checkedOutCount = 0

    for (const employeeId of employeeIds) {
      const alreadyCheckedOut = license.seats.some(
        s => String(s.employeeId) === employeeId
      )

      if (!alreadyCheckedOut) {
        license.seats.push({
          employeeId: employeeId as any,
          checkedOutBy: user.userId as any,
          checkedOutAt: new Date(),
          notes: notes || ''
        })
        checkedOutCount++
      }
    }

    if (checkedOutCount > 0) {
      await license.save()

      await createAuditEntry(request, 'update', 'SoftwareLicense', id, {
        after: { action: 'checkout_multiple', employeeIds }
      })
    }

    return {
      message: `${checkedOutCount} seat(s) checked out successfully`,
      usedSeats: license.seats.length,
      totalSeats: license.totalSeats,
      availableSeats: license.totalSeats === -1 ? 'unlimited' : license.totalSeats - license.seats.length
    }
  })

  fastify.post('/:id/checkin', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        employeeId: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { employeeId } = request.body as { employeeId: string }

    const license = await SoftwareLicense.findOne({ _id: id, ...getTenantFilter(request) })
    if (!license) return reply.code(404).send({ error: 'License not found' })

    const seatIndex = license.seats?.findIndex(
      s => String(s.employeeId) === employeeId
    ) ?? -1

    if (seatIndex === -1) {
      return reply.code(404).send({ error: 'Employee does not have a seat for this license' })
    }

    license.seats?.splice(seatIndex, 1)
    await license.save()

    await createAuditEntry(request, 'update', 'SoftwareLicense', id, {
      after: { action: 'checkin', employeeId }
    })

    return {
      message: 'Seat checked in successfully',
      usedSeats: license.seats?.length || 0,
      totalSeats: license.totalSeats
    }
  })

  fastify.get('/summary/stats', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const aggFilter = getAggregateFilter(request)
    const now = new Date()

    const [totalLicenses, totalSeats, expiringIn30, expired] = await Promise.all([
      SoftwareLicense.countDocuments({ ...tenantFilter, isActive: true, deletedAt: null }),
      SoftwareLicense.aggregate([
        { $match: { ...aggFilter, isActive: true, deletedAt: null } },
        {
          $group: {
            _id: null,
            totalSeats: { $sum: { $cond: [{ $gte: ['$totalSeats', 0] }, '$totalSeats', 0] } },
            usedSeats: { $sum: { $size: '$seats' } },
            monthlyCost: {
              $sum: {
                $cond: [
                  { $eq: ['$billingCycle', 'monthly'] },
                  { $multiply: ['$costPerSeat', { $size: '$seats' }] },
                  0
                ]
              }
            },
            annualCost: {
              $sum: {
                $cond: [
                  { $eq: ['$billingCycle', 'annual'] },
                  { $multiply: ['$costPerSeat', { $size: '$seats' }] },
                  0
                ]
              }
            }
          }
        }
      ]),
      SoftwareLicense.countDocuments({
        ...tenantFilter,
        isActive: true,
        expirationDate: {
          $gte: now,
          $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        }
      }),
      SoftwareLicense.countDocuments({
        ...tenantFilter,
        isActive: true,
        expirationDate: { $lt: now }
      })
    ])

    const stats = totalSeats[0] || { totalSeats: 0, usedSeats: 0, monthlyCost: 0, annualCost: 0 }

    return {
      totalLicenses,
      totalSeats: stats.totalSeats,
      usedSeats: stats.usedSeats,
      availableSeats: stats.totalSeats - stats.usedSeats,
      utilizationRate: stats.totalSeats > 0
        ? Math.round((stats.usedSeats / stats.totalSeats) * 100)
        : 0,
      monthlyCost: Math.round(stats.monthlyCost * 100) / 100,
      annualCost: Math.round(stats.annualCost * 100) / 100,
      expiringIn30Days: expiringIn30,
      expired
    }
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const license = await SoftwareLicense.findOne({
      _id: id,
      ...getTenantFilter(request)
    })
    if (!license) return reply.code(404).send({ error: 'License not found' })

    await createAuditEntry(request, 'delete', 'SoftwareLicense', id, {
      before: { name: license.name }
    })

    await (SoftwareLicense as any).softDelete(id)
    return { message: 'License moved to recycle bin' }
  })
}

export default licenseRoutes
