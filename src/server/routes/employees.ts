import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Employee } from '../../models/Employee'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Assignment } from '../../models/Assignment'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Consumable } from '../../models/Consumable'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { checkLimit } from '../middleware/planLimits'
import { escapeRegex } from '../utils/inputSanitization'
import { workflowEventBus } from '../services/workflowEventBus'

const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        departmentId: Type.Optional(Type.String()),
        locationId: Type.Optional(Type.String()),
        isActive: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String())
      })
    }
  }, async (request) => {
    const query = request.query as { departmentId?: string; locationId?: string; isActive?: boolean; search?: string }
    const filter: Record<string, unknown> = { ...getTenantFilter(request) }
    if (query.departmentId) filter.departmentId = query.departmentId
    if (query.locationId) filter.locationId = query.locationId
    if (query.isActive !== undefined) filter.isActive = query.isActive
    if (query.search) {
      const safeSearch = escapeRegex(query.search)
      const regex = { $regex: safeSearch, $options: 'i' }
      const mongoose = (await import('mongoose')).default
      const [deptIds, locIds] = await Promise.all([
        mongoose.model('Department').distinct('_id', { name: regex, ...getTenantFilter(request) }),
        mongoose.model('Location').distinct('_id', { name: regex, ...getTenantFilter(request) })
      ])
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { jobTitle: regex },
        ...(deptIds.length ? [{ departmentId: { $in: deptIds } }] : []),
        ...(locIds.length ? [{ locationId: { $in: locIds } }] : [])
      ]
    }

    return await Employee.find(filter)
      .populate('managerId', 'firstName lastName email')
      .populate('departmentId', 'name')
      .populate('locationId', 'name')
      .sort({ lastName: 1, firstName: 1 })
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantFilter = getTenantFilter(request)
    const employee = await Employee.findOne({ _id: id, ...tenantFilter })
      .populate('managerId', 'firstName lastName email')
      .populate('departmentId', 'name')
      .populate('locationId', 'name')
      .populate('userId', 'email role')
    if (!employee) return reply.code(404).send({ error: 'Employee not found' })

    const [hardware, peripherals, assignments, licenses, consumables] = await Promise.all([
      Hardware.find({ assignedTo: id, ...tenantFilter })
        .populate('categoryId', 'name color icon')
        .populate('statusId', 'name color icon')
        .populate('manufacturerId', 'name')
        .populate('locationId', 'name')
        .lean(),
      Peripheral.find({ assignedTo: id, ...tenantFilter })
        .populate('categoryId', 'name color icon')
        .populate('statusId', 'name color icon')
        .populate('manufacturerId', 'name')
        .lean(),
      Assignment.find({ employeeId: id, ...tenantFilter })
        .populate('hardware', 'model serialNumber')
        .populate('peripherals', 'model serialNumber')
        .sort({ createdAt: -1 })
        .lean(),
      SoftwareLicense.find({ 'seats.employeeId': id, ...tenantFilter })
        .select('name publisher licenseType totalSeats seats costPerSeat currency expirationDate')
        .lean(),
      Consumable.find({ 'checkouts.employeeId': id, ...tenantFilter })
        .select('name categoryId checkouts unitCost currency')
        .lean()
    ])

    const licenseSeats = licenses.map(lic => ({
      _id: lic._id,
      name: lic.name,
      publisher: lic.publisher,
      licenseType: lic.licenseType,
      costPerSeat: lic.costPerSeat,
      currency: lic.currency,
      expirationDate: lic.expirationDate,
      seats: (lic.seats || []).filter((s: any) => String(s.employeeId) === id)
    }))

    const consumableCheckouts = consumables.map(c => ({
      _id: c._id,
      name: c.name,
      unitCost: c.unitCost,
      currency: c.currency,
      checkouts: (c.checkouts || []).filter((co: any) => String(co.employeeId) === id)
    }))

    const result = employee.toObject()
    ;(result as any)._related = {
      hardware,
      peripherals,
      assignments,
      licenseSeats,
      consumableCheckouts
    }

    return result
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager'), checkLimit('users')],
    schema: {
      body: Type.Object({
        firstName: Type.String({ minLength: 1, maxLength: 100 }),
        lastName: Type.String({ minLength: 1, maxLength: 100 }),
        email: Type.String({ format: 'email' }),
        departmentId: Type.Optional(Type.String()),
        locationId: Type.Optional(Type.String()),
        jobTitle: Type.Optional(Type.String({ maxLength: 100 })),
        phone: Type.Optional(Type.String({ maxLength: 30 })),
        managerId: Type.Optional(Type.String()),
        userId: Type.Optional(Type.String()),
        startDate: Type.Optional(Type.String()),
        endDate: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String({ maxLength: 5000 })),
        customFields: Type.Optional(Type.Record(Type.String(), Type.Any()))
      })
    }
  }, async (request, reply) => {
    const body = sanitizeBody(request.body as Record<string, unknown>)



    if (body.managerId && body.email && String(body.managerId) === String(body.email)) {
      return reply.code(400).send({ error: 'An employee cannot be their own manager' })
    }

    const employee = new Employee({ ...body, orgId: getOrgId(request) })
    const saved = await employee.save()

    if (body.managerId && String(body.managerId) === String(saved._id)) {
      await saved.deleteOne()
      return reply.code(400).send({ error: 'An employee cannot be their own manager' })
    }

    await createAuditEntry(request, 'create', 'Employee', String(saved._id), {
      after: saved.toObject()
    })

    workflowEventBus.emitWorkflowEvent('employee.created', {
      orgId: String(getOrgId(request)),
      source: 'manual',
      employeeId: String(saved._id),
      created: 1,
      ...(saved.departmentId ? { department: String(saved.departmentId), departmentId: String(saved.departmentId) } : {}),
      ...(saved.locationId ? { location: String(saved.locationId), locationId: String(saved.locationId) } : {})
    })

    return reply.code(201).send(saved)
  })

  fastify.put('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
        lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
        email: Type.Optional(Type.String({ format: 'email' })),
        departmentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        locationId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        jobTitle: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
        phone: Type.Optional(Type.Union([Type.String({ maxLength: 30 }), Type.Null()])),
        managerId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        userId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        startDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        endDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        notes: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
        isActive: Type.Optional(Type.Boolean()),
        customFields: Type.Optional(Type.Record(Type.String(), Type.Any()))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await Employee.findOne({ _id: id, ...getTenantFilter(request) })
    if (!existing) return reply.code(404).send({ error: 'Employee not found' })

    const body = sanitizeBody(request.body as Record<string, unknown>)

    if (body.managerId && String(body.managerId) === id) {
      return reply.code(400).send({ error: 'An employee cannot be their own manager' })
    }

    for (const field of ['managerId', 'userId', 'departmentId', 'locationId']) {
      if (body[field] === '') body[field] = null
    }

    const updated = await Employee.findByIdAndUpdate(id, { $set: body }, {
      new: true, runValidators: true
    })

    await createAuditEntry(request, 'update', 'Employee', id, {
      before: existing.toObject(), after: updated?.toObject()
    })

    if (updated) {
      workflowEventBus.emitWorkflowEvent('employee.updated', {
        orgId: String(getOrgId(request)),
        source: 'manual',
        employeeId: id,
        updated: 1,
        changedFields: Object.keys(body),
        ...(updated.departmentId ? { department: String(updated.departmentId), departmentId: String(updated.departmentId) } : {}),
        ...(updated.locationId ? { location: String(updated.locationId), locationId: String(updated.locationId) } : {})
      })
    }

    return updated
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const employee = await Employee.findOne({ _id: id, ...getTenantFilter(request) })
    if (!employee) return reply.code(404).send({ error: 'Employee not found' })

    employee.isActive = false
    employee.endDate = new Date()
      ; (employee as any).deletedAt = new Date()
    await employee.save()

    await createAuditEntry(request, 'update', 'Employee', id, {
      after: { isActive: false, endDate: employee.endDate }
    })

    return { message: 'Employee deactivated and moved to recycle bin' }
  })
}

export default employeeRoutes
