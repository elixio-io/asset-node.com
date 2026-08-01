import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Employee } from '../../models/Employee'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Assignment } from '../../models/Assignment'
import { AssetEvent } from '../../models/AssetEvent'
import { authenticate } from '../middleware/auth'
import { getTenantFilter } from '../middleware/tenantScope'

const myItemsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request, reply) => {
    const user = request.user as { userId: string; orgId: string }
    const tenantFilter = getTenantFilter(request)

    const employee = await Employee.findOne({ ...tenantFilter, userId: user.userId })
    if (!employee) {
      return reply.code(404).send({ error: 'No employee profile linked to your account' })
    }

    const hardware = await Hardware.find({
      ...tenantFilter,
      assignedTo: employee._id
    })
      .populate('categoryId', 'name')
      .populate('statusId', 'name type')
      .populate('manufacturerId', 'name')
      .populate('locationId', 'name')
      .sort({ createdAt: -1 })
      .lean()

    const peripherals = await Peripheral.find({
      ...tenantFilter,
      assignedTo: employee._id
    })
      .populate('categoryId', 'name')
      .populate('manufacturerId', 'name')
      .populate('statusId', 'name type')
      .sort({ createdAt: -1 })
      .lean()

    const assignments = await Assignment.find({
      ...tenantFilter,
      employeeId: employee._id
    })
      .populate('hardware', 'serialNumber model assetTag')
      .populate('peripherals', 'serialNumber model')
      .sort({ assignmentDate: -1 })
      .lean()

    return {
      employee: {
        id: employee._id,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        departmentId: employee.departmentId,
        jobTitle: employee.jobTitle
      },
      hardware,
      peripherals,
      assignments,
      totals: {
        hardware: hardware.length,
        peripherals: peripherals.length,
        activeAssignments: assignments.filter(a => a.status === 'active').length,
        pendingReturns: assignments.filter(a => a.status === 'pendingReturn').length
      }
    }
  })

  fastify.get('/timeline/:assetId', {
    schema: { params: Type.Object({ assetId: Type.String() }) }
  }, async (request, reply) => {
    const user = request.user as { userId: string; orgId: string }
    const tenantFilter = getTenantFilter(request)
    const { assetId } = request.params as { assetId: string }

    const employee = await Employee.findOne({ ...tenantFilter, userId: user.userId })
    if (!employee) {
      return reply.code(404).send({ error: 'No employee profile linked to your account' })
    }

    const asset = await Hardware.findOne({
      _id: assetId,
      ...tenantFilter,
      assignedTo: employee._id
    })

    if (!asset) {
      return reply.code(403).send({ error: 'This asset is not assigned to you' })
    }

    const events = await AssetEvent.find({ assetId, ...tenantFilter })
      .populate('performedBy', 'firstName lastName')
      .sort({ createdAt: -1 })

    return { asset, events }
  })

  fastify.post('/return/:assignmentId', {
    schema: {
      params: Type.Object({ assignmentId: Type.String() }),
      body: Type.Object({
        notes: Type.Optional(Type.String({ maxLength: 2000 }))
      })
    }
  }, async (request, reply) => {
    const user = request.user as { userId: string; orgId: string }
    const tenantFilter = getTenantFilter(request)
    const { assignmentId } = request.params as { assignmentId: string }
    const { notes } = request.body as { notes?: string }

    const employee = await Employee.findOne({ ...tenantFilter, userId: user.userId })
    if (!employee) {
      return reply.code(404).send({ error: 'No employee profile linked to your account' })
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      ...tenantFilter,
      employeeId: employee._id,
      status: 'active'
    })

    if (!assignment) {
      return reply.code(404).send({ error: 'Active assignment not found' })
    }

    assignment.status = 'pendingReturn'
    assignment.returnRequestedAt = new Date()
    if (notes) assignment.notes = notes
    await assignment.save()

    return { message: 'Return request submitted', status: 'pendingReturn' }
  })
}

export default myItemsRoutes
