import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Employee } from '../../models/Employee'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Assignment } from '../../models/Assignment'
import { AssetEvent } from '../../models/AssetEvent'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'
import { resolveStatusId } from '../services/statusResolver'
import { escapeRegex } from '../utils/inputSanitization'
import { Organization } from '../../models/Organization'
import { sendOnboardingEmail } from '../services/emailService'
import { workflowEventBus } from '../services/workflowEventBus'

const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.post('/onboard', {
    schema: {
      body: Type.Object({
        firstName: Type.String({ minLength: 1, maxLength: 100 }),
        lastName: Type.String({ minLength: 1, maxLength: 100 }),
        email: Type.String({ format: 'email' }),
        departmentId: Type.Optional(Type.String()),
        jobTitle: Type.Optional(Type.String()),
        managerId: Type.Optional(Type.String()),
        startDate: Type.Optional(Type.String()),
        hardware: Type.Optional(Type.Array(Type.String())),
        peripherals: Type.Optional(Type.Array(Type.String())),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      firstName: string
      lastName: string
      email: string
      departmentId?: string
      jobTitle?: string
      managerId?: string
      startDate?: string
      hardware?: string[]
      peripherals?: string[]
      notes?: string
    }

    const orgId = getOrgId(request)
    const tenantFilter = getTenantFilter(request)

    const employee = await Employee.create({
      orgId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      departmentId: body.departmentId || null,
      jobTitle: body.jobTitle,
      managerId: body.managerId || null,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      isActive: true
    })

    let assignment = null

    if (body.hardware?.length || body.peripherals?.length) {
      if (body.hardware?.length) {
        const availableStatusId = await resolveStatusId(String(orgId), 'available')
        const availableHw = await Hardware.find({
          _id: { $in: body.hardware },
          ...tenantFilter,
          statusId: availableStatusId
        })
        if (availableHw.length !== body.hardware.length) {
          return reply.code(400).send({
            error: 'Some hardware items are not available or do not belong to your organization',
            employee
          })
        }
      }

      assignment = await Assignment.create({
        orgId,
        employeeId: employee._id,
        hardware: body.hardware || [],
        peripherals: body.peripherals || [],
        assignmentDate: new Date(),
        notes: body.notes || `Onboarding — ${body.firstName} ${body.lastName}`,
        status: 'active'
      })

      if (body.peripherals?.length) {
        const assignedStatusId = await resolveStatusId(String(orgId), 'assigned')
        await Peripheral.updateMany(
          { _id: { $in: body.peripherals }, ...tenantFilter },
          { $set: { statusId: assignedStatusId, assignedTo: employee._id } }
        )
      }

      for (const hwId of body.hardware || []) {
        await AssetEvent.create({
          orgId,
          assetId: hwId,
          assetType: 'hardware',
          eventType: 'assigned',
          description: `Onboarding: assigned to ${body.firstName} ${body.lastName}`,
          newValue: `${body.firstName} ${body.lastName}`,
          performedBy: (request.user as any).userId
        })
      }
    }

    await createAuditEntry(request, 'create', 'Employee', String(employee._id), {
      after: { ...employee.toObject(), assignedAssets: body.hardware?.length || 0 }
    })

    const org = await Organization.findById(orgId)
    const orgName = org?.name || 'Your Organization'

    const assignedAssets: { name: string, type: string }[] = []
    if (body.hardware?.length) {
      const hwDocs = await Hardware.find({ _id: { $in: body.hardware } }).populate('manufacturerId', 'name')
      for (const hw of hwDocs) {
        const mfg = hw.manufacturerId ? (hw.manufacturerId as any).name + ' ' : ''
        assignedAssets.push({ name: `${mfg}${hw.model}`, type: 'hardware' })
      }
    }
    if (body.peripherals?.length) {
      const periphDocs = await Peripheral.find({ _id: { $in: body.peripherals } }).populate('manufacturerId', 'name')
      for (const p of periphDocs) {
        const mfg = p.manufacturerId ? (p.manufacturerId as any).name + ' ' : ''
        assignedAssets.push({ name: `${mfg}${p.model}`, type: 'peripheral' })
      }
    }

    if (body.email) {
      sendOnboardingEmail(
        body.email,
        body.firstName,
        body.startDate ? new Date(body.startDate).toLocaleDateString() : new Date().toLocaleDateString(),
        orgName,
        assignedAssets
      ).catch(err => fastify.log.error(err, 'Failed to send onboarding email'))
    }

    workflowEventBus.emitWorkflowEvent('employee.created', { orgId: String(orgId), source: 'manual', employeeId: String(employee._id) })
    if (assignment) {
      workflowEventBus.emitWorkflowEvent('assignment.created', {
        orgId: String(orgId),
        assignmentId: String(assignment._id),
        employeeId: String(employee._id),
        hardwareIds: assignment.hardware.map(String)
      })
    }

    return reply.code(201).send({
      message: `${body.firstName} ${body.lastName} onboarded successfully`,
      employee,
      assignment
    })
  })

  fastify.post('/offboard/:employeeId', {
    schema: {
      params: Type.Object({ employeeId: Type.String() }),
      body: Type.Object({
        endDate: Type.Optional(Type.String()),
        returnCondition: Type.Optional(Type.Union([
          Type.Literal('good'), Type.Literal('fair'), Type.Literal('damaged')
        ])),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { employeeId } = request.params as { employeeId: string }
    const body = request.body as {
      endDate?: string
      returnCondition?: 'good' | 'fair' | 'damaged'
      notes?: string
    }

    const tenantFilter = getTenantFilter(request)
    const orgId = getOrgId(request)

    const employee = await Employee.findOne({ _id: employeeId, ...tenantFilter })
    if (!employee) return reply.code(404).send({ error: 'Employee not found' })

    const condition = body.returnCondition || 'good'
    const returnSlug = condition === 'damaged' ? 'defective' : 'available'
    const newStatusId = await resolveStatusId(String(orgId), returnSlug as any)

    const activeAssignments = await Assignment.find({
      ...tenantFilter,
      employeeId,
      status: { $in: ['active', 'pendingReturn'] }
    })

    const returnedHardwareIds: string[] = []
    const returnedPeripheralIds: string[] = []

    for (const assignment of activeAssignments) {
      assignment.status = 'returned'
      assignment.returnedAt = new Date()
      assignment.returnCondition = condition
      if (body.notes) assignment.notes = `Offboarding: ${body.notes}`
      await assignment.save()

      returnedHardwareIds.push(...assignment.hardware.map(String))
      returnedPeripheralIds.push(...(assignment.peripherals || []).map(String))
    }

    if (returnedHardwareIds.length) {
      await Hardware.updateMany(
        { _id: { $in: returnedHardwareIds }, orgId, deletedAt: null },
        { $set: { statusId: newStatusId, assignedTo: null } }
      )

      for (const hwId of returnedHardwareIds) {
        await AssetEvent.create({
          orgId,
          assetId: hwId,
          assetType: 'hardware',
          eventType: 'returned',
          description: `Offboarding: returned from ${employee.firstName} ${employee.lastName}`,
          previousValue: `${employee.firstName} ${employee.lastName}`,
          newValue: null,
          performedBy: (request.user as any).userId
        })
      }
    }

    if (returnedPeripheralIds.length) {
      await Peripheral.updateMany(
        { _id: { $in: returnedPeripheralIds } },
        { $set: { assignedTo: null } }
      )
    }

    employee.isActive = false
    employee.endDate = body.endDate ? new Date(body.endDate) : new Date()
    await employee.save()

    await createAuditEntry(request, 'update', 'Employee', employeeId, {
      after: {
        isActive: false,
        endDate: employee.endDate,
        returnedHardware: returnedHardwareIds.length,
        returnedPeripherals: returnedPeripheralIds.length
      }
    })

    return {
      message: `${employee.firstName} ${employee.lastName} offboarded successfully`,
      returnedHardware: returnedHardwareIds.length,
      returnedPeripherals: returnedPeripheralIds.length,
      assignmentsCompleted: activeAssignments.length,
      employee
    }
  })

  fastify.get('/kit/:department', {
    schema: { params: Type.Object({ department: Type.String() }) }
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { department } = request.params as { department: string }



    const { Department } = await import('../../models/Department')
    const dept = await Department.findOne({ orgId: tenantFilter.orgId, name: { $regex: new RegExp(escapeRegex(department), 'i') } })
    const deptEmployees = dept
      ? await Employee.find({ ...tenantFilter, departmentId: dept._id, isActive: true }).select('_id')
      : []

    const empIds = deptEmployees.map(e => e._id)

    const commonHardware = await Hardware.aggregate([
      { $match: { ...tenantFilter, assignedTo: { $in: empIds } } },
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
          models: { $addToSet: '$model' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: '_cat'
        }
      },
      { $unwind: { path: '$_cat', preserveNullAndEmptyArrays: true } },
      {
        $addFields: { name: { $ifNull: ['$_cat.name', 'Unknown'] } }
      },
      { $project: { _cat: 0 } },
      { $sort: { count: -1 } }
    ])

    const categoryIds = commonHardware.map(c => c._id)
    const availableStatusId = await resolveStatusId(String(tenantFilter.orgId), 'available')
    const availableHardware = await Hardware.find({
      ...tenantFilter,
      statusId: availableStatusId,
      categoryId: { $in: categoryIds }
    })
      .populate('categoryId', 'name')
      .populate('manufacturerId', 'name')
      .select('serialNumber model assetTag categoryId manufacturerId')
      .lean()

    const availablePeripherals = await Peripheral.find({
      ...tenantFilter,
      assignedTo: null
    })
      .populate('categoryId', 'name')
      .populate('manufacturerId', 'name')
      .select('serialNumber model categoryId manufacturerId')
      .lean()

    return {
      department,
      suggestedCategories: commonHardware,
      availableHardware,
      availablePeripherals
    }
  })
}

export default onboardingRoutes
