import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Audit } from '../../models/Audit'
import { AuditResponse } from '../../models/AuditResponse'
import { Employee } from '../../models/Employee'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

const auditWorkflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', {
    preHandler: [requireRole('admin', 'manager')]
  }, async (request) => {
    return await Audit.find(getTenantFilter(request))
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
  })

  fastify.get('/:id', {
    preHandler: [requireRole('admin', 'manager')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const audit = await Audit.findOne({ _id: id, ...getTenantFilter(request) })
      .populate('createdBy', 'firstName lastName email')
    if (!audit) return reply.code(404).send({ error: 'Audit not found' })

    const responses = await AuditResponse.find({ auditId: id })
      .populate('employeeId', 'firstName lastName email')
      .sort({ status: 1 })

    const totalResponses = responses.length
    const completedResponses = responses.filter(r => r.status === 'completed').length

    return {
      audit,
      responses,
      progress: {
        total: totalResponses,
        completed: completedResponses,
        percentage: totalResponses > 0
          ? Math.round((completedResponses / totalResponses) * 100)
          : 0
      }
    }
  })

  fastify.post('/', {
    preHandler: [requireRole('admin', 'manager')],
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        schedule: Type.Optional(Type.Union([
          Type.Literal('monthly'), Type.Literal('quarterly'),
          Type.Literal('annual'), Type.Literal('oneTime')
        ])),
        targetType: Type.Union([
          Type.Literal('all'), Type.Literal('location'), Type.Literal('department')
        ]),
        targetId: Type.Optional(Type.String()),
        dueDate: Type.String(),
        notes: Type.Optional(Type.String({ maxLength: 5000 }))
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      schedule?: string
      targetType: 'all' | 'location' | 'department'
      targetId?: string
      dueDate: string
      notes?: string
    }

    const orgId = getOrgId(request)
    const tenantFilter = getTenantFilter(request)

    const audit = await Audit.create({
      ...sanitizeBody(body),
      orgId,
      dueDate: new Date(body.dueDate),
      createdBy: (request.user as any).userId,
      status: 'scheduled'
    })

    let employeeFilter: Record<string, unknown> = { ...tenantFilter, isActive: true }
    if (body.targetType === 'department' && body.targetId) {
      employeeFilter.departmentId = body.targetId
    }

    const employees = await Employee.find(employeeFilter)

    const responsePromises = employees.map(async (emp) => {
      const hw = await Hardware.find({ ...tenantFilter, assignedTo: emp._id }).lean()
      const peripherals = await Peripheral.find({ ...tenantFilter, assignedTo: emp._id }).lean()

      if (hw.length === 0 && peripherals.length === 0) return null

      const assets = [
        ...hw.map(h => ({
          assetId: h._id,
          assetType: 'hardware' as const,
          confirmed: false
        })),
        ...peripherals.map(p => ({
          assetId: p._id,
          assetType: 'peripheral' as const,
          confirmed: false
        }))
      ]

      return AuditResponse.create({
        auditId: audit._id,
        orgId,
        employeeId: emp._id,
        assets,
        status: 'pending'
      })
    })

    const responses = (await Promise.all(responsePromises)).filter(Boolean)

    audit.status = 'inProgress'
    audit.sentAt = new Date()
    await audit.save()

    await createAuditEntry(request, 'create', 'Audit', String(audit._id), {
      after: { name: audit.name, responses: responses.length }
    })

    return reply.code(201).send({
      audit,
      responsesCreated: responses.length,
      message: `Audit created. ${responses.length} employees will receive verification requests.`
    })
  })



  fastify.get('/respond/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const response = await AuditResponse.findOne({ token })
      .populate('employeeId', 'firstName lastName email')
      .populate({
        path: 'assets.assetId',
        select: 'serialNumber model assetTag'
      })

    if (!response) return reply.code(404).send({ error: 'Invalid or expired audit token' })
    if (response.status === 'completed') {
      return { message: 'This audit has already been completed', response }
    }

    const audit = await Audit.findById(response.auditId)
    return { audit: { name: audit?.name, dueDate: audit?.dueDate }, response }
  })

  fastify.post('/respond/:token', {
    schema: {
      params: Type.Object({ token: Type.String() }),
      body: Type.Object({
        assets: Type.Array(Type.Object({
          assetId: Type.String(),
          confirmed: Type.Boolean(),
          condition: Type.Optional(Type.Union([
            Type.Literal('good'), Type.Literal('fair'),
            Type.Literal('damaged'), Type.Literal('missing')
          ])),
          notes: Type.Optional(Type.String({ maxLength: 2000 }))
        })),
        signature: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { token } = request.params as { token: string }
    const body = request.body as {
      assets: Array<{
        assetId: string
        confirmed: boolean
        condition?: string
        notes?: string
      }>
      signature?: string
    }

    const response = await AuditResponse.findOne({ token })
    if (!response) return reply.code(404).send({ error: 'Invalid audit token' })
    if (response.status === 'completed') {
      return reply.code(400).send({ error: 'This audit has already been completed' })
    }

    for (const update of body.assets) {
      const assetEntry = response.assets.find(
        (a: any) => String(a.assetId) === update.assetId
      )
      if (assetEntry) {
        assetEntry.confirmed = update.confirmed
        if (update.condition) assetEntry.condition = update.condition as any
        if (update.notes) assetEntry.notes = update.notes
      }
    }

    response.status = 'completed'
    response.respondedAt = new Date()
    if (body.signature) response.signature = body.signature
    await response.save()

    const pendingCount = await AuditResponse.countDocuments({
      auditId: response.auditId,
      status: { $ne: 'completed' }
    })

    if (pendingCount === 0) {
      await Audit.findByIdAndUpdate(response.auditId, {
        status: 'completed',
        completedAt: new Date()
      })
    }

    return { message: 'Audit response submitted successfully' }
  })

  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const audit = await Audit.findOne({ _id: id, ...getTenantFilter(request) })
    if (!audit) return reply.code(404).send({ error: 'Audit not found' })

    audit.status = 'cancelled'
    await audit.save()

    await AuditResponse.updateMany(
      { auditId: id, status: 'pending' },
      { $set: { status: 'overdue' } }
    )

    return { message: 'Audit cancelled' }
  })
}

export default auditWorkflowRoutes
