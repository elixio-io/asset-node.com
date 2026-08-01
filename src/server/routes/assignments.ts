import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Assignment } from '../../models/Assignment'
import { Hardware } from '../../models/Hardware'
import { Employee } from '../../models/Employee'
import { Peripheral } from '../../models/Peripheral'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'
import { dispatchNotification } from '../services/notificationDispatcher'
import { workflowEventBus } from '../services/workflowEventBus'
import { Status } from '../../models/Status'
import { resolveStatusId } from '../services/statusResolver'

const assignmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const assignments = await Assignment.find(getTenantFilter(request))
      .populate({ path: 'employeeId', populate: [{ path: 'departmentId', select: 'name' }, { path: 'locationId', select: 'name' }, { path: 'managerId', select: 'firstName lastName' }] })
      .populate({ path: 'hardware', populate: [{ path: 'manufacturerId', select: 'name' }, { path: 'categoryId', select: 'name' }, { path: 'statusId', select: 'name type' }, { path: 'assignedTo', select: 'firstName lastName' }, { path: 'locationId', select: 'name' }] })
      .populate({ path: 'peripherals', populate: [{ path: 'manufacturerId', select: 'name' }, { path: 'categoryId', select: 'name' }, { path: 'statusId', select: 'name type' }, { path: 'assignedTo', select: 'firstName lastName' }] })
      .sort({ createdAt: -1 })
      .exec()
    return assignments
  })

  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const assignment = await Assignment.findOne({ _id: id, ...getTenantFilter(request) })
      .populate({ path: 'employeeId', populate: [{ path: 'departmentId', select: 'name' }, { path: 'locationId', select: 'name' }, { path: 'managerId', select: 'firstName lastName' }] })
      .populate({ path: 'hardware', populate: [{ path: 'manufacturerId', select: 'name' }, { path: 'categoryId', select: 'name' }, { path: 'statusId', select: 'name type' }, { path: 'assignedTo', select: 'firstName lastName' }, { path: 'locationId', select: 'name' }] })
      .populate({ path: 'peripherals', populate: [{ path: 'manufacturerId', select: 'name' }, { path: 'categoryId', select: 'name' }, { path: 'statusId', select: 'name type' }, { path: 'assignedTo', select: 'firstName lastName' }] })
      .exec()

    if (!assignment) {
      return reply.code(404).send({ error: 'Assignment not found' })
    }
    return assignment
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        employeeId: Type.String(),
        hardware: Type.Array(Type.String(), { minItems: 1 }),
        peripherals: Type.Optional(Type.Array(Type.String())),
        assignmentDate: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      employeeId: string
      hardware: string[]
      peripherals?: string[]
      assignmentDate?: string
      notes?: string
    }

    const tenantFilter = getTenantFilter(request)

    const peripheralIds = [...new Set(body.peripherals || [])]
    const [employeeExists, peripheralCount] = await Promise.all([
      Employee.exists({ _id: body.employeeId, ...tenantFilter }),
      Peripheral.countDocuments({ _id: { $in: peripheralIds }, ...tenantFilter })
    ])
    if (!employeeExists) {
      return reply.code(400).send({ error: 'Employee does not belong to your organization' })
    }
    if (peripheralCount !== peripheralIds.length) {
      return reply.code(400).send({ error: 'Some peripherals do not belong to your organization' })
    }

    const deployableStatuses = await Status.find({ ...tenantFilter, type: 'deployable' }).select('_id').lean()
    const deployableIds = deployableStatuses.map(s => s._id)

    const hardwareItems = await Hardware.find({
      _id: { $in: body.hardware },
      ...tenantFilter,
      statusId: { $in: deployableIds }
    })

    if (hardwareItems.length !== body.hardware.length) {
      return reply.code(400).send({ error: 'Some hardware items are not available or do not belong to your organization' })
    }

    const assignment = new Assignment({
      ...sanitizeBody(body),
      orgId: getOrgId(request),
      assignmentDate: body.assignmentDate ? new Date(body.assignmentDate) : new Date()
    })

    const savedAssignment = await assignment.save()
    const populated = await savedAssignment.populate(['employeeId', 'hardware', 'peripherals'])

    await createAuditEntry(request, 'create', 'Assignment', String(savedAssignment._id), {
      after: populated.toObject()
    })

    dispatchNotification(getOrgId(request), 'checkInOut', {
      title: 'Asset Assigned',
      message: `${body.hardware.length} asset(s) assigned`,
      data: { assignmentId: String(savedAssignment._id), hardware: body.hardware }
    }).catch(() => { })

    workflowEventBus.emitWorkflowEvent('assignment.created', {
      orgId: String(getOrgId(request)),
      assignmentId: String(savedAssignment._id),
      employeeId: body.employeeId,
      hardwareIds: body.hardware
    })

    return reply.code(201).send(populated)
  })

  fastify.post('/:id/acknowledge', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        signature: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { signature } = request.body as { signature?: string }

    const assignment = await Assignment.findOne({ _id: id, ...getTenantFilter(request) })
    if (!assignment) {
      return reply.code(404).send({ error: 'Assignment not found' })
    }

    assignment.acknowledgedAt = new Date()
    assignment.signature = signature || undefined
    await assignment.save()

    await createAuditEntry(request, 'update', 'Assignment', id, {
      after: { acknowledgedAt: assignment.acknowledgedAt }
    })

    return { message: 'Assignment acknowledged', acknowledgedAt: assignment.acknowledgedAt }
  })

  fastify.post('/:id/return', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { notes } = request.body as { notes?: string }

    const assignment = await Assignment.findOne({ _id: id, ...getTenantFilter(request) })
    if (!assignment) {
      return reply.code(404).send({ error: 'Assignment not found' })
    }

    if (assignment.status !== 'active') {
      return reply.code(409).send({ error: `Cannot request return — assignment is already '${assignment.status}'` })
    }

    assignment.status = 'pendingReturn'
    assignment.returnRequestedAt = new Date()
    if (notes) assignment.notes = notes
    await assignment.save()

    return { message: 'Return requested', status: 'pendingReturn' }
  })

  fastify.post('/:id/complete-return', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        returnCondition: Type.Union([
          Type.Literal('good'),
          Type.Literal('fair'),
          Type.Literal('damaged')
        ])
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { returnCondition } = request.body as { returnCondition: 'good' | 'fair' | 'damaged' }

    const assignment = await Assignment.findOne({ _id: id, ...getTenantFilter(request) })
    if (!assignment) {
      return reply.code(404).send({ error: 'Assignment not found' })
    }

    if (assignment.status !== 'pendingReturn') {
      return reply.code(409).send({ error: `Cannot complete return — assignment status is '${assignment.status}'` })
    }

    assignment.status = 'returned'
    assignment.returnedAt = new Date()
    assignment.returnCondition = returnCondition
    await assignment.save()

    const orgId = String(getOrgId(request))
    const targetSlug = returnCondition === 'damaged' ? 'defective' : 'available'
    const targetStatusId = await resolveStatusId(orgId, targetSlug as any)
    await Hardware.updateMany(
      { _id: { $in: assignment.hardware }, orgId: getOrgId(request), deletedAt: null },
      { $set: { statusId: targetStatusId, assignedTo: null } }
    )

    await createAuditEntry(request, 'update', 'Assignment', id, {
      after: { status: 'returned', returnCondition, returnedAt: assignment.returnedAt }
    })

    dispatchNotification(getOrgId(request), 'checkInOut', {
      title: 'Asset Returned',
      message: `Assignment ${id} returned (condition: ${returnCondition})`,
      data: { assignmentId: id, returnCondition }
    }).catch(() => { })

    workflowEventBus.emitWorkflowEvent('assignment.returned', {
      orgId: String(getOrgId(request)),
      assignmentId: id,
      employeeId: String(assignment.employeeId),
      returnCondition,
      hardwareIds: assignment.hardware.map(String)
    })

    return { message: 'Return completed', status: 'returned', returnCondition }
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      params: Type.Object({
        id: Type.String()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const assignment = await Assignment.findOne({ _id: id, ...getTenantFilter(request) })

    if (!assignment) {
      return reply.code(404).send({ error: 'Assignment not found' })
    }

    const orgId = String(getOrgId(request))
    const availableStatusId = await resolveStatusId(orgId, 'available')
    await Hardware.updateMany(
      { _id: { $in: assignment.hardware }, orgId: getOrgId(request), deletedAt: null },
      { $set: { statusId: availableStatusId, assignedTo: null } }
    )

    await createAuditEntry(request, 'delete', 'Assignment', id, {
      before: assignment.toObject()
    })

    await assignment.deleteOne()
    return { message: 'Assignment deleted successfully' }
  })



  fastify.post('/bulk', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        assignments: Type.Array(Type.Object({
          employeeId: Type.String(),
          hardware: Type.Array(Type.String(), { minItems: 1 }),
          peripherals: Type.Optional(Type.Array(Type.String())),
          notes: Type.Optional(Type.String())
        }), { minItems: 1 })
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      assignments: Array<{
        employeeId: string
        hardware: string[]
        peripherals?: string[]
        notes?: string
      }>
    }

    const orgId = getOrgId(request)
    const tenantFilter = getTenantFilter(request)

    const allHwIds = body.assignments.flatMap(a => a.hardware)
    const uniqueHwIds = [...new Set(allHwIds)]
    const employeeIds = [...new Set(body.assignments.map(item => item.employeeId))]
    const peripheralIds = [...new Set(body.assignments.flatMap(item => item.peripherals || []))]

    if (allHwIds.length !== uniqueHwIds.length) {
      return reply.code(400).send({ error: 'Duplicate hardware IDs across assignments' })
    }

    const [employeeCount, peripheralCount] = await Promise.all([
      Employee.countDocuments({ _id: { $in: employeeIds }, ...tenantFilter }),
      Peripheral.countDocuments({ _id: { $in: peripheralIds }, ...tenantFilter })
    ])
    if (employeeCount !== employeeIds.length) {
      return reply.code(400).send({ error: 'Some employees do not belong to your organization' })
    }
    if (peripheralCount !== peripheralIds.length) {
      return reply.code(400).send({ error: 'Some peripherals do not belong to your organization' })
    }

    const deployableStatuses = await Status.find({ ...tenantFilter, type: 'deployable' }).select('_id').lean()
    const deployableIds = deployableStatuses.map(s => s._id)
    const available = await Hardware.find({
      _id: { $in: uniqueHwIds },
      ...tenantFilter,
      statusId: { $in: deployableIds }
    })

    if (available.length !== uniqueHwIds.length) {
      const availableIds = new Set(available.map(h => h._id.toString()))
      const unavailable = uniqueHwIds.filter(id => !availableIds.has(id))
      return reply.code(400).send({
        error: 'Some hardware items are not available',
        unavailableIds: unavailable
      })
    }

    const created = []
    for (const item of body.assignments) {
      const assignment = new Assignment({
        orgId,
        employeeId: item.employeeId,
        hardware: item.hardware,
        peripherals: item.peripherals || [],
        notes: item.notes,
        assignmentDate: new Date()
      })
      const saved = await assignment.save()
      created.push(saved)
    }

    await createAuditEntry(request, 'create', 'Assignment', 'bulk', {
      after: { count: created.length, hardwareCount: uniqueHwIds.length }
    })

    dispatchNotification(orgId, 'checkInOut', {
      title: 'Bulk Checkout',
      message: `${created.length} assignment(s) created with ${uniqueHwIds.length} asset(s)`,
      data: { assignmentIds: created.map(a => a._id.toString()) }
    }).catch(() => { })

    workflowEventBus.emitWorkflowEvent('assignment.created', {
      orgId,
      assignmentIds: created.map(assignment => String(assignment._id)),
      employeeIds: body.assignments.map(item => item.employeeId),
      hardwareIds: uniqueHwIds
    })

    return reply.code(201).send({
      success: true,
      count: created.length,
      assignments: created
    })
  })
}

export default assignmentRoutes
