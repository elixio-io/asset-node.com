import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Hardware } from '../../models/Hardware'
import { Assignment } from '../../models/Assignment'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { checkLimit } from '../middleware/planLimits'
import { resolveStatusId, tryResolveStatusId } from '../services/statusResolver'
import { workflowEventBus } from '../services/workflowEventBus'
import { escapeRegex } from '../utils/inputSanitization'
import { Status, type SystemStatusSlug } from '../../models/Status'
import { Category } from '../../models/Category'
import { Department } from '../../models/Department'
import { Employee } from '../../models/Employee'
import { Location } from '../../models/Location'
import { Manufacturer } from '../../models/Manufacturer'
import mongoose from 'mongoose'

const hardwareRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        categoryId: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String()),
        statusSlug: Type.Optional(Type.String()),
        manufacturerId: Type.Optional(Type.String()),
        search: Type.Optional(Type.String())
      })
    }
  }, async (request) => {
    const query = request.query as {
      categoryId?: string
      statusId?: string
      statusSlug?: string
      manufacturerId?: string
      search?: string
    }

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
    if (query.manufacturerId) filter.manufacturerId = query.manufacturerId
    if (query.search) {
      const safeSearch = escapeRegex(query.search)
      const searchRegex = { $regex: safeSearch, $options: 'i' }
      const tenantFilter = getTenantFilter(request)

      const orConditions: Record<string, unknown>[] = [
        { serialNumber: searchRegex },
        { model: searchRegex },
        { assetTag: searchRegex },
        { assetName: searchRegex },
        { notes: searchRegex },
      ]

      const [mfgIds, catIds, locIds, empIds] = await Promise.all([
        mongoose.model('Manufacturer').find({ ...tenantFilter, name: searchRegex }).distinct('_id'),
        mongoose.model('Category').find({ ...tenantFilter, name: searchRegex }).distinct('_id'),
        mongoose.model('Location').find({ ...tenantFilter, name: searchRegex }).distinct('_id'),
        mongoose.model('Employee').find({
          ...tenantFilter,
          $or: [{ firstName: searchRegex }, { lastName: searchRegex }]
        }).distinct('_id'),
      ])

      if (mfgIds.length) orConditions.push({ manufacturerId: { $in: mfgIds } })
      if (catIds.length) orConditions.push({ categoryId: { $in: catIds } })
      if (locIds.length) orConditions.push({ locationId: { $in: locIds } })
      if (empIds.length) orConditions.push({ assignedTo: { $in: empIds } })

      filter.$or = orConditions
    }

    const items = await Hardware.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('categoryId', 'name icon color')
      .populate('statusId', 'name type color icon')
      .populate('manufacturerId', 'name')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .populate('supplierId', 'name')
      .sort({ createdAt: -1 })
    return items
  })

  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const item = await Hardware.findOne({ _id: id, ...getTenantFilter(request) })
      .populate('assignedTo', 'firstName lastName email')
      .populate('categoryId', 'name icon color')
      .populate('statusId', 'name type color icon')
      .populate('manufacturerId', 'name')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .populate('supplierId', 'name')
    if (!item) {
      return reply.code(404).send({ error: 'Hardware not found' })
    }
    return item
  })

  fastify.get('/models/distinct', async (request) => {
    const models = await Hardware.distinct('model', getTenantFilter(request))
    return models.filter(Boolean).sort((a: string, b: string) => a.localeCompare(b))
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager'), checkLimit('assets')],
    schema: {
      body: Type.Object({
        serialNumber: Type.Optional(Type.String({ maxLength: 100 })),
        model: Type.String({ minLength: 1, maxLength: 200 }),
        categoryId: Type.String(),
        manufacturerId: Type.String(),
        statusId: Type.String(),
        assetTag: Type.Optional(Type.String({ maxLength: 50 })),
        assetName: Type.Optional(Type.String({ maxLength: 200 })),
        purchaseDate: Type.Optional(Type.String()),
        purchasePrice: Type.Optional(Type.Number({ minimum: 0 })),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        orderNumber: Type.Optional(Type.String({ maxLength: 100 })),
        warrantyExpiry: Type.Optional(Type.String()),
        endOfLife: Type.Optional(Type.String()),
        locationId: Type.Optional(Type.String()),
        departmentId: Type.Optional(Type.String()),
        supplierId: Type.Optional(Type.String()),
        assignedTo: Type.Optional(Type.String()),
        imageUrl: Type.Optional(Type.String()),
        adminPassword: Type.Optional(Type.String({ maxLength: 200 })),
        defectDescription: Type.Optional(Type.String({ maxLength: 2000 })),
        salePrice: Type.Optional(Type.Number({ minimum: 0 })),
        notes: Type.Optional(Type.String({ maxLength: 5000 })),
        tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }))),
        customFields: Type.Optional(Type.Record(Type.String(), Type.String()))
      })
    }
  }, async (request, reply) => {
    try {
      const body = sanitizeBody(request.body as Record<string, unknown>)
      const hardware = new Hardware({ ...body, orgId: getOrgId(request) })
      const savedHardware = await hardware.save()

      await createAuditEntry(request, 'create', 'Hardware', String(savedHardware._id), {
        after: savedHardware.toObject()
      })





      const relationFilter = { orgId: getOrgId(request) }
      const [createdStatus, createdCategory, createdManufacturer, createdLocation, createdDepartment, createdAssignee] = await Promise.all([
        Status.findOne({ _id: savedHardware.statusId, ...relationFilter }).select('slug').lean(),
        Category.findOne({ _id: savedHardware.categoryId, ...relationFilter }).select('slug name').lean(),
        Manufacturer.findOne({ _id: savedHardware.manufacturerId, ...relationFilter }).select('name').lean(),
        savedHardware.locationId
          ? Location.findOne({ _id: savedHardware.locationId, ...relationFilter }).select('name').lean()
          : null,
        savedHardware.departmentId
          ? Department.findOne({ _id: savedHardware.departmentId, ...relationFilter }).select('slug name').lean()
          : null,
        savedHardware.assignedTo
          ? Employee.findOne({ _id: savedHardware.assignedTo, ...relationFilter, deletedAt: null }).select('email').lean()
          : null
      ])
      workflowEventBus.emitWorkflowEvent('hardware.created', {
        orgId: String(getOrgId(request)),
        source: 'manual',
        assetId: String(savedHardware._id),
        hardwareId: String(savedHardware._id),
        status: createdStatus?.slug || String(savedHardware.statusId),
        statusId: String(savedHardware.statusId),
        category: createdCategory?.slug || createdCategory?.name || String(savedHardware.categoryId),
        categoryId: String(savedHardware.categoryId),
        manufacturer: createdManufacturer?.name || String(savedHardware.manufacturerId),
        manufacturerId: String(savedHardware.manufacturerId),
        ...(savedHardware.locationId ? {
          location: createdLocation?.name || String(savedHardware.locationId),
          locationId: String(savedHardware.locationId)
        } : {}),
        ...(savedHardware.departmentId ? {
          department: createdDepartment?.slug || createdDepartment?.name || String(savedHardware.departmentId),
          departmentId: String(savedHardware.departmentId)
        } : {}),
        ...(savedHardware.assignedTo ? {
          assignee: createdAssignee?.email || String(savedHardware.assignedTo),
          assignedTo: String(savedHardware.assignedTo)
        } : {})
      })

      return reply.code(201).send(savedHardware)
    } catch (error: any) {
      if (error.code === 11000) {
        return reply.code(409).send({ error: 'Serial number or asset tag already exists' })
      }
      throw error
    }
  })

  fastify.put('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: Type.Object({
        serialNumber: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
        model: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        categoryId: Type.Optional(Type.String()),
        manufacturerId: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String()),
        statusSlug: Type.Optional(Type.String()),
        assetTag: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
        assetName: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
        purchaseDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        purchasePrice: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        orderNumber: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
        warrantyExpiry: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        endOfLife: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        locationId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        departmentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        supplierId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        assignedTo: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        imageUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        adminPassword: Type.Optional(Type.String({ maxLength: 200 })),
        defectDescription: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
        salePrice: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        notes: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
        tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }))),
        customFields: Type.Optional(Type.Record(Type.String(), Type.String())),
        resolveAssignment: Type.Optional(Type.Object({
          action: Type.Union([Type.Literal('return'), Type.Literal('unassign')]),
          returnCondition: Type.Optional(Type.Union([Type.Literal('good'), Type.Literal('fair'), Type.Literal('damaged')])),
          notes: Type.Optional(Type.String())
        }))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = sanitizeBody(request.body as Record<string, unknown>)

    const resolveAssignment = body.resolveAssignment as { action: 'return' | 'unassign', returnCondition?: 'good'|'fair'|'damaged', notes?: string } | undefined
    delete body.resolveAssignment

    if (body.statusSlug && !body.statusId) {
      const orgId = getOrgId(request)
      body.statusId = await resolveStatusId(String(orgId), body.statusSlug as SystemStatusSlug)
    }
    delete body.statusSlug

    const existing = await Hardware.findOne({ _id: id, ...getTenantFilter(request) })
    if (!existing) {
      return reply.code(404).send({ error: 'Hardware not found' })
    }

    const before = existing.toObject()

    const objectIdFields = ['assignedTo', 'locationId', 'departmentId', 'supplierId']
    for (const field of objectIdFields) {
      if (field in body && (body[field] === '' || body[field] === undefined)) {
        body[field] = null
      }
    }



    const isBeingUnassigned = ('assignedTo' in body) && (body.assignedTo === null) && (before.assignedTo != null)
    const isAssignedToChanged = ('assignedTo' in body) && (body.assignedTo != null) && (String(body.assignedTo) !== String(before.assignedTo))

    if (isBeingUnassigned || isAssignedToChanged) {
      const activeAssignment = await Assignment.findOne({
        hardware: id,
        status: 'active',
        ...getTenantFilter(request)
      })

      if (activeAssignment) {
        if (!resolveAssignment) {
          return reply.code(409).send({
            error: 'Conflict: Hardware is part of an active assignment.',
            requiresResolution: true,
            activeAssignmentId: activeAssignment._id,
            employeeId: activeAssignment.employeeId
          })
        }

        if (resolveAssignment.action === 'return') {
          if (activeAssignment.hardware.length === 1) {
            activeAssignment.status = 'returned'
            activeAssignment.returnedAt = new Date()
            activeAssignment.returnCondition = resolveAssignment.returnCondition || 'good'
            if (resolveAssignment.notes) {
               activeAssignment.notes = (activeAssignment.notes ? activeAssignment.notes + '\n' : '') + resolveAssignment.notes
            }
            await activeAssignment.save()
          } else {
             activeAssignment.hardware = activeAssignment.hardware.filter(hId => String(hId) !== id)
             if (resolveAssignment.notes) {
               activeAssignment.notes = (activeAssignment.notes ? activeAssignment.notes + '\n' : '') + `[Partial Return: ${existing.assetTag || 'Asset'} returned: ${resolveAssignment.notes}]`
             }
             await activeAssignment.save()
          }

          if (!body.statusId && !isAssignedToChanged) {
            const targetSlug = resolveAssignment.returnCondition === 'damaged' ? 'defective' : 'available'
            const orgId = getOrgId(request)
            body.statusId = await resolveStatusId(String(orgId), targetSlug as any)
          }
        } else if (resolveAssignment.action === 'unassign') {
          activeAssignment.hardware = activeAssignment.hardware.filter(hId => String(hId) !== id)
          await activeAssignment.save()
        }
      }

      if (isAssignedToChanged) {
        const newAssignment = new Assignment({
          orgId: getOrgId(request),
          employeeId: body.assignedTo,
          hardware: [id],
          status: 'active',
          assignmentDate: new Date(),
          notes: 'Auto-created via hardware update'
        })
        await newAssignment.save()

        if (!body.statusId) {
          const orgId = getOrgId(request)
          body.statusId = await resolveStatusId(String(orgId), 'assigned')
        }
      }
    }

    const updatedHardware = await Hardware.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    )

    await createAuditEntry(request, 'update', 'Hardware', id, {
      before,
      after: updatedHardware?.toObject()
    })

    const orgId = String(getOrgId(request))
    if (body.statusId && String(body.statusId) !== String(before.statusId)) {
      const newStatus = await Status.findOne({ _id: body.statusId, orgId })
        .select('slug')
        .lean()
      workflowEventBus.emitWorkflowEvent('status.changed', {
        orgId,
        assetId: id,
        hardwareId: id,
        status: newStatus?.slug || String(body.statusId),
        statusId: String(body.statusId),
        previousStatusId: String(before.statusId),
        newStatusId: String(body.statusId)
      })
    }
    workflowEventBus.emitWorkflowEvent('hardware.updated', { orgId, assetId: id })

    return updatedHardware
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: {
      params: Type.Object({
        id: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const hardware = await Hardware.findOne({ _id: id, ...getTenantFilter(request) })

    if (!hardware) {
      return reply.code(404).send({ error: 'Hardware not found' })
    }

    await createAuditEntry(request, 'delete', 'Hardware', id, {
      before: hardware.toObject()
    })

    await (Hardware as any).softDelete(id)
    workflowEventBus.emitWorkflowEvent('hardware.deleted', {
      orgId: String(getOrgId(request)),
      source: 'manual',
      assetId: id,
      hardwareId: id,
      statusId: String(hardware.statusId),
      categoryId: String(hardware.categoryId),
      manufacturerId: String(hardware.manufacturerId)
    })
    return { message: 'Hardware moved to recycle bin' }
  })
}

export default hardwareRoutes
