import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { MaintenanceRecord, MAINTENANCE_TYPES, MAINTENANCE_STATUSES } from '../../models/MaintenanceRecord'
import { Hardware } from '../../models/Hardware'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { workflowEventBus } from '../services/workflowEventBus'

const MaintenanceTypeEnum = Type.Union(MAINTENANCE_TYPES.map(t => Type.Literal(t)))
const MaintenanceStatusEnum = Type.Union(MAINTENANCE_STATUSES.map(s => Type.Literal(s)))

const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        hardwareId: Type.Optional(Type.String()),
        status: Type.Optional(MaintenanceStatusEnum)
      })
    }
  }, async (request) => {
    const query = request.query as { hardwareId?: string; status?: string }
    const filter: Record<string, unknown> = { ...getTenantFilter(request) }
    if (query.hardwareId) filter.hardware = query.hardwareId
    if (query.status) filter.status = query.status

    return await MaintenanceRecord.find(filter)
      .populate('hardware', 'serialNumber model assetTag')
      .sort({ startDate: -1 })
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const record = await MaintenanceRecord.findOne({ _id: id, ...getTenantFilter(request) })
      .populate({ path: 'hardware', select: 'serialNumber model assetTag', populate: [{ path: 'categoryId', select: 'name' }, { path: 'manufacturerId', select: 'name' }] })
    if (!record) return reply.code(404).send({ error: 'Maintenance record not found' })
    return record
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        hardware: Type.String(),
        type: MaintenanceTypeEnum,
        description: Type.String({ minLength: 1, maxLength: 5000 }),
        performedBy: Type.String({ minLength: 1, maxLength: 200 }),
        cost: Type.Optional(Type.Number({ minimum: 0 })),
        startDate: Type.Optional(Type.String()),
        completionDate: Type.Optional(Type.String()),
        status: Type.Optional(MaintenanceStatusEnum),
        notes: Type.Optional(Type.String({ maxLength: 5000 }))
      })
    }
  }, async (request, reply) => {
    const body = sanitizeBody(request.body as Record<string, unknown>)
    const tenantFilter = getTenantFilter(request)

    const hardware = await Hardware.findOne({ _id: body.hardware, ...tenantFilter })
    if (!hardware) {
      return reply.code(404).send({ error: 'Hardware not found' })
    }

    const record = new MaintenanceRecord({ ...body, orgId: getOrgId(request) })
    const saved = await record.save()
    const populated = await saved.populate({ path: 'hardware', select: 'serialNumber model assetTag', populate: [{ path: 'categoryId', select: 'name' }, { path: 'manufacturerId', select: 'name' }] })

    await createAuditEntry(request, 'create', 'MaintenanceRecord', String(saved._id), {
      after: populated.toObject()
    })

    if (body.type === 'repair' && body.status !== 'completed') {
      const { Status } = await import('../../models/Status')
      const inRepairStatus = await Status.findOne({ orgId: getOrgId(request), slug: 'in-repair' })
      if (inRepairStatus) {
        await Hardware.findByIdAndUpdate(body.hardware, { statusId: inRepairStatus._id })
      }
    }

    return reply.code(201).send(populated)
  })

  fastify.put('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        type: Type.Optional(MaintenanceTypeEnum),
        description: Type.Optional(Type.String({ minLength: 1, maxLength: 5000 })),
        performedBy: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        cost: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        startDate: Type.Optional(Type.String()),
        completionDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        status: Type.Optional(MaintenanceStatusEnum),
        notes: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()]))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = sanitizeBody(request.body as Record<string, unknown>)

    const existing = await MaintenanceRecord.findOne({ _id: id, ...getTenantFilter(request) })
    if (!existing) {
      return reply.code(404).send({ error: 'Maintenance record not found' })
    }

    const before = existing.toObject()
    const updated = await MaintenanceRecord.findByIdAndUpdate(
      id, { $set: body }, { new: true, runValidators: true }
    ).populate({ path: 'hardware', select: 'serialNumber model assetTag', populate: [{ path: 'categoryId', select: 'name' }, { path: 'manufacturerId', select: 'name' }] })

    await createAuditEntry(request, 'update', 'MaintenanceRecord', id, { before, after: updated?.toObject() })

    if (body.status === 'completed' && existing.type === 'repair') {
      const { Status } = await import('../../models/Status')
      const inRepairStatus = await Status.findOne({ orgId: getOrgId(request), slug: 'in-repair' })
      const availableStatus = await Status.findOne({ orgId: getOrgId(request), slug: 'available' })
      const hw = await Hardware.findById(existing.hardware)
      if (hw && inRepairStatus && availableStatus && String(hw.statusId) === String(inRepairStatus._id)) {
        await Hardware.findByIdAndUpdate(existing.hardware, { statusId: availableStatus._id })
      }
    }

    if (body.status === 'completed' && before.status !== 'completed') {
      workflowEventBus.emitWorkflowEvent('maintenance.completed', {
        orgId: String(getOrgId(request)),
        maintenanceId: id,
        hardwareId: String(existing.hardware),
        type: existing.type
      })
    }

    return updated
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const record = await MaintenanceRecord.findOne({ _id: id, ...getTenantFilter(request) })
    if (!record) return reply.code(404).send({ error: 'Maintenance record not found' })

    await createAuditEntry(request, 'delete', 'MaintenanceRecord', id, {
      before: record.toObject()
    })

    await MaintenanceRecord.findByIdAndDelete(id)
    return { message: 'Maintenance record deleted successfully' }
  })
}

export default maintenanceRoutes
