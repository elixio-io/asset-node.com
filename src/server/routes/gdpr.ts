import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { User } from '../../models/User'
import { Assignment } from '../../models/Assignment'
import { AuditLog } from '../../models/AuditLog'
import { Employee } from '../../models/Employee'
import { authenticate } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'

const gdprRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/export', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    const userId = request.user.userId
    const orgId = request.user.orgId

    const user = await User.findById(userId).lean()
    const employee = await Employee.findOne({ userId, orgId }).lean()
    const assignments = employee
      ? await Assignment.find({ orgId, employeeId: employee._id }).lean()
      : []
    const auditLogs = await AuditLog.find({ userId, orgId }).sort({ createdAt: -1 }).limit(500).lean()

    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      exportFormat: 'GDPR Article 15 — Right of Access',
      personalData: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        companyName: user.companyName,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        gdprConsent: user.gdprConsent,
        gdprConsentDate: user.gdprConsentDate,
        dataProcessingConsent: user.dataProcessingConsent,
        marketingConsent: user.marketingConsent
      },
      employeeProfile: employee ? {
        department: employee.departmentId,
        jobTitle: employee.jobTitle,
        startDate: employee.startDate
      } : null,
      assetAssignments: assignments.map(a => ({
        hardware: a.hardware,
        assignmentDate: a.assignmentDate,
        returnedAt: a.returnedAt,
        status: a.status
      })),
      activityLog: auditLogs.map(log => ({
        action: log.action,
        entity: log.entityType,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress
      }))
    }

    await createAuditEntry(request, 'gdpr_data_export' as any, 'User', userId)

    reply.header('Content-Type', 'application/json')
    reply.header('Content-Disposition', `attachment; filename="gdpr-export-${user.email}-${new Date().toISOString().split('T')[0]}.json"`)
    return exportData
  })

  fastify.delete('/delete', {
    schema: {
      body: Type.Object({
        password: Type.String(),
        confirmDeletion: Type.Boolean()
      })
    }
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    const { password, confirmDeletion } = request.body as { password: string; confirmDeletion: boolean }

    if (!confirmDeletion) {
      return reply.code(400).send({ error: 'Deletion must be explicitly confirmed', code: 'CONFIRM_REQUIRED' })
    }

    const userId = request.user.userId
    const orgId = request.user.orgId

    const user = await User.findById(userId).select('+hashedPassword').exec()
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    const isValid = await user.validatePassword(password)
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid password', code: 'INVALID_PASSWORD' })
    }

    await createAuditEntry(request, 'gdpr_account_deletion' as any, 'User', userId)

    await AuditLog.updateMany(
      { userId, orgId },
      { $set: { userId: 'DELETED_USER', ipAddress: 'ANONYMIZED' } }
    )

    await Employee.deleteMany({ orgId, $or: [{ userId }, { email: user.email }] })

    await User.findByIdAndDelete(userId)

    return { message: 'Account permanently deleted. All personal data has been erased.' }
  })

  fastify.delete('/employee/:email', {
    schema: {
      params: Type.Object({
        email: Type.String({ format: 'email' })
      })
    }
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    if (request.user.role !== 'admin' && request.user.role !== 'superAdmin') {
      return reply.code(403).send({ error: 'Admin role required for employee data erasure' })
    }

    const { email } = request.params as { email: string }
    const orgId = request.user.orgId

    const employee = await Employee.findOne({ orgId, email: email.toLowerCase() })
    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' })
    }

    await createAuditEntry(request, 'gdpr_employee_erasure' as any, 'Employee', String(employee._id), {
      after: { email: '***ERASED***' }
    })

    await Employee.deleteOne({ _id: employee._id })

    return { message: `Employee record for ${email} has been permanently erased.` }
  })

  fastify.get('/consent', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    const user = await User.findById(request.user.userId)
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    return {
      gdprConsent: user.gdprConsent,
      gdprConsentDate: user.gdprConsentDate,
      dataProcessingConsent: user.dataProcessingConsent,
      marketingConsent: user.marketingConsent
    }
  })

  fastify.put('/consent', {
    schema: {
      body: Type.Object({
        gdprConsent: Type.Boolean(),
        dataProcessingConsent: Type.Boolean(),
        marketingConsent: Type.Boolean()
      })
    }
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    const { gdprConsent, dataProcessingConsent, marketingConsent } = request.body as {
      gdprConsent: boolean
      dataProcessingConsent: boolean
      marketingConsent: boolean
    }

    const userId = request.user.userId

    const updateData: Record<string, unknown> = {
      gdprConsent,
      dataProcessingConsent,
      marketingConsent
    }

    if (gdprConsent) {
      updateData.gdprConsentDate = new Date()
    }

    const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true })
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    await createAuditEntry(request, 'gdpr_consent_update' as any, 'User', userId)

    return {
      message: 'Consent preferences updated',
      gdprConsent: user.gdprConsent,
      gdprConsentDate: user.gdprConsentDate,
      dataProcessingConsent: user.dataProcessingConsent,
      marketingConsent: user.marketingConsent
    }
  })
}

export default gdprRoutes
