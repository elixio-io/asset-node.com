import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Kit } from '../../models/Kit'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Consumable } from '../../models/Consumable'
import { Assignment } from '../../models/Assignment'
import { Status } from '../../models/Status'
import { resolveStatusId } from '../services/statusResolver'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { dispatchNotification } from '../services/notificationDispatcher'

const kitRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    return Kit.find(tenantFilter)
      .populate('locationId', 'name')
      .sort({ name: 1 })
      .lean()
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }

    const kit = await Kit.findOne({ ...tenantFilter, _id: id })
      .populate('locationId', 'name')
      .lean()
    if (!kit) {
      return reply.status(404).send({ error: 'Kit not found' })
    }
    return kit
  })

  fastify.post('/', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1 }),
        locationId: Type.Optional(Type.String()),
        items: Type.Optional(Type.Array(Type.Object({
          itemType: Type.Union([
            Type.Literal('hardware'),
            Type.Literal('peripheral'),
            Type.Literal('license'),
            Type.Literal('consumable')
          ]),
          category: Type.Optional(Type.String()),
          referenceId: Type.Optional(Type.String()),
          quantity: Type.Optional(Type.Number({ minimum: 1 }))
        }))),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const body = sanitizeBody(request.body as any)

    const existing = await Kit.findOne({ orgId, name: body.name })
    if (existing) {
      return reply.status(409).send({ error: 'Kit with this name already exists' })
    }

    const kit = new Kit({ orgId, ...body })
    await kit.save()
    return reply.status(201).send(kit)
  })

  fastify.patch('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1 })),
        locationId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        items: Type.Optional(Type.Array(Type.Object({
          itemType: Type.Union([
            Type.Literal('hardware'),
            Type.Literal('peripheral'),
            Type.Literal('license'),
            Type.Literal('consumable')
          ]),
          category: Type.Optional(Type.String()),
          referenceId: Type.Optional(Type.String()),
          quantity: Type.Optional(Type.Number({ minimum: 1 }))
        }))),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const body = sanitizeBody(request.body as any)

    if (body.name) {
      const existing = await Kit.findOne({ ...tenantFilter, name: body.name, _id: { $ne: id } })
      if (existing) {
        return reply.status(409).send({ error: 'Kit name already taken' })
      }
    }

    const kit = await Kit.findOneAndUpdate(
      { ...tenantFilter, _id: id },
      { $set: body },
      { new: true }
    )
    if (!kit) {
      return reply.status(404).send({ error: 'Kit not found' })
    }
    return kit
  })

  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }

    const result = await Kit.findOneAndDelete({ ...tenantFilter, _id: id })
    if (!result) {
      return reply.status(404).send({ error: 'Kit not found' })
    }
    return { success: true }
  })

  fastify.post('/:id/clone', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const orgId = getOrgId(request)
    const { id } = request.params as { id: string }

    const original = await Kit.findOne({ ...tenantFilter, _id: id }).lean()
    if (!original) {
      return reply.status(404).send({ error: 'Kit not found' })
    }

    let cloneName = `${original.name} (Copy)`
    let counter = 1
    while (await Kit.findOne({ orgId, name: cloneName })) {
      counter++
      cloneName = `${original.name} (Copy ${counter})`
    }

    const cloned = new Kit({
      orgId,
      name: cloneName,
      locationId: original.locationId,
      items: original.items,
      notes: original.notes
    })
    await cloned.save()
    return reply.status(201).send(cloned)
  })



  fastify.post('/:id/deploy', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        employeeId: Type.String()
      })
    }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const orgId = getOrgId(request)
    const { id } = request.params as { id: string }
    const { employeeId } = request.body as { employeeId: string }

    const kit = await Kit.findOne({ ...tenantFilter, _id: id }).lean()
    if (!kit) {
      return reply.status(404).send({ error: 'Kit not found' })
    }

    const hardwareIds: string[] = []
    const peripheralIds: string[] = []
    const errors: string[] = []



    const deployableStatuses = await Status.find({ ...tenantFilter, type: 'deployable' }).select('_id').lean()
    const deployableIds = deployableStatuses.map(s => s._id)

    for (const item of kit.items) {
      const qty = item.quantity || 1

      if (item.itemType === 'hardware') {
        const query: any = { ...tenantFilter, statusId: { $in: deployableIds } }
        if (item.referenceId) {
          query._id = item.referenceId
        } else if (item.category) {
          query.categoryId = item.category
        }
        const available = await Hardware.find(query).limit(qty).lean()
        if (available.length < qty) {
          errors.push(`Not enough available ${item.category || 'hardware'} (need ${qty}, found ${available.length})`)
        }
        hardwareIds.push(...available.map(a => a._id.toString()))
      }

      if (item.itemType === 'peripheral') {
        const query: any = { ...tenantFilter, statusId: { $in: deployableIds } }
        if (item.referenceId) {
          query._id = item.referenceId
        }
        const available = await Peripheral.find(query).limit(qty).lean()
        if (available.length < qty) {
          errors.push(`Not enough available peripherals (need ${qty}, found ${available.length})`)
        }
        peripheralIds.push(...available.map(a => a._id.toString()))
      }

      if (item.itemType === 'consumable' && item.referenceId) {
        const consumable = await Consumable.findOne({ ...tenantFilter, _id: item.referenceId })
        if (consumable) {
          if (consumable.totalQuantity < qty) {
            errors.push(`Not enough ${consumable.name} (need ${qty}, have ${consumable.totalQuantity})`)
          } else {
            consumable.totalQuantity -= qty
            await consumable.save()
          }
        }
      }

      if (item.itemType === 'license' && item.referenceId) {
        const license = await SoftwareLicense.findOne({ ...tenantFilter, _id: item.referenceId })
        if (license) {
          const seatsUsed = license.seats?.length || 0
          const availableSeats = license.totalSeats === -1 ? Infinity : license.totalSeats - seatsUsed
          if (availableSeats < qty) {
            errors.push(`Not enough seats for ${license.name}`)
          }
        }
      }
    }

    if (errors.length > 0) {
      return reply.status(400).send({ error: 'Insufficient inventory', details: errors })
    }

    if (hardwareIds.length > 0 || peripheralIds.length > 0) {
      const assignment = new Assignment({
        orgId,
        employeeId,
        hardware: hardwareIds,
        peripherals: peripheralIds,
        notes: `Deployed from kit: ${kit.name}`
      })
      await assignment.save()

      await dispatchNotification(orgId, 'checkInOut', {
        title: `Kit "${kit.name}" deployed`,
        message: `Kit deployed to employee with ${hardwareIds.length} hardware + ${peripheralIds.length} peripherals`
      })
    }

    return {
      success: true,
      hardwareAssigned: hardwareIds.length,
      peripheralsAssigned: peripheralIds.length,
      kitName: kit.name
    }
  })
}

export default kitRoutes
