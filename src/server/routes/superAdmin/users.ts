import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { User, type UserRole } from '../../../models/User'
import { Organization } from '../../../models/Organization'
import { AuditLog } from '../../../models/AuditLog'
import { Hardware } from '../../../models/Hardware'
import { dispatchPlatformEvent } from '../../services/platformNotifier'
import { escapeRegex } from '../../utils/inputSanitization'
import { createAuditEntry } from '../../middleware/auditLog'
import { confirmMfaStepUp } from '../../services/authStepUp'

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users', {
    schema: {
      querystring: Type.Object({
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        role: Type.Optional(Type.String()),
        orgId: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request) => {
    const { page = 1, limit = 25, role, orgId, search, isActive } = request.query as {
      page?: number
      limit?: number
      role?: string
      orgId?: string
      search?: string
      isActive?: boolean
    }

    const filter: Record<string, unknown> = {
      role: { $ne: 'superAdmin' }
    }
    if (role) filter.role = role
    if (orgId) filter.orgId = orgId
    if (isActive !== undefined) filter.isActive = isActive
    if (search) {
      const safeSearch = escapeRegex(search)
      filter.$or = [
        { email: { $regex: safeSearch, $options: 'i' } },
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } }
      ]
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('email firstName lastName role orgId companyName isActive lastLoginAt createdAt permissions')
        .populate('orgId', 'name slug plan')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ])

    return {
      data: users.map(user => ({
        ...user,
        isActive: user.isActive ?? true
      })),
      total,
      page,
      limit
    }
  })

  fastify.get('/users/:id', {
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }




    const user = await User.findById(id)
      .select('email firstName lastName role orgId companyName department isActive lastLoginAt createdAt permissions gdprConsent gdprConsentDate dataProcessingConsent marketingConsent accountDeletionRequestedAt')
      .lean()

    if (!user) {
      return reply.code(404).send({ error: 'User not found', code: 'NOT_FOUND' })
    }

    const [organization, recentAudit, assignedHardwareCount] = await Promise.all([
      user.orgId
        ? Organization.findById(user.orgId)
            .select('name slug plan isActive billing.status createdAt')
            .lean()
        : Promise.resolve(null),
      AuditLog.find({ userId: String(user._id) })
        .sort({ timestamp: -1 })
        .limit(15)
        .lean(),
      user.orgId
        ? Hardware.countDocuments({ orgId: user.orgId })
        : Promise.resolve(0)
    ])

    const loginCount = await AuditLog.countDocuments({
      userId: String(user._id),
      action: 'login'
    })

    return {
      ...user,
      organization: organization ? {
        _id: (organization as any)._id,
        name: organization.name,
        slug: (organization as any).slug,
        plan: (organization as any).plan,
        isActive: (organization as any).isActive ?? true,
        billingStatus: (organization as any).billing?.status || 'free'
      } : null,
      activity: {
        loginCount,
        lastLoginAt: (user as any).lastLoginAt,
        createdAt: (user as any).createdAt,
        recentActions: recentAudit
      },
      gdpr: {
        consent: (user as any).gdprConsent || false,
        consentDate: (user as any).gdprConsentDate,
        dataProcessingConsent: (user as any).dataProcessingConsent || false,
        marketingConsent: (user as any).marketingConsent || false,
        deletionRequestedAt: (user as any).accountDeletionRequestedAt
      },
      assignedHardwareCount
    }
  })

  fastify.patch('/users/:id/role', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        role: Type.Union([
          Type.Literal('superAdmin'), Type.Literal('admin'),
          Type.Literal('manager'), Type.Literal('employee'),
          Type.Literal('viewer')
        ])
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { role } = request.body as { role: UserRole }

    const user = await User.findById(id).select('+authVersion').exec()
    if (!user) return reply.code(404).send({ error: 'User not found', code: 'NOT_FOUND' })
    if (user.role === 'superAdmin' && String(user._id) === request.user?.userId && role !== 'superAdmin') {
      return reply.code(403).send({ error: 'Cannot demote yourself from superAdmin', code: 'FORBIDDEN' })
    }

    if (user.role === role) {
      return { id: user._id, email: user.email, role: user.role }
    }

    const authVersion = user.authVersion ?? 0
    const versionFilter = authVersion === 0
      ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
      : { authVersion }
    const updatedUser = await User.findOneAndUpdate({
      _id: user._id,
      role: user.role,
      ...versionFilter
    }, {
      $set: { role },
      $inc: { authVersion: 1 },
      $unset: { refreshToken: 1 }
    }, { new: true }).exec()
    if (!updatedUser) {
      return reply.code(409).send({ error: 'User role changed concurrently. Refresh and try again.', code: 'ROLE_CHANGED' })
    }

    return { id: updatedUser._id, email: updatedUser.email, role: updatedUser.role }
  })

  fastify.patch('/users/:id/active', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({ isActive: Type.Boolean() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { isActive } = request.body as { isActive: boolean }

    const user = await User.findById(id).select('+authVersion').exec()
    if (!user) return reply.code(404).send({ error: 'User not found', code: 'NOT_FOUND' })
    if (user.role === 'superAdmin') {
      return reply.code(403).send({ error: 'Cannot deactivate superAdmin', code: 'FORBIDDEN' })
    }

    if (user.isActive === isActive) {
      return { id: user._id, email: user.email, isActive: user.isActive }
    }

    const authVersion = user.authVersion ?? 0
    const versionFilter = authVersion === 0
      ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
      : { authVersion }
    const updatedUser = await User.findOneAndUpdate({
      _id: user._id,
      isActive: user.isActive,
      ...versionFilter
    }, {
      $set: { isActive },
      $inc: { authVersion: 1 },
      $unset: { refreshToken: 1 }
    }, { new: true }).exec()
    if (!updatedUser) {
      return reply.code(409).send({ error: 'User status changed concurrently. Refresh and try again.', code: 'STATUS_CHANGED' })
    }

    if (!isActive) {
      dispatchPlatformEvent('user.deactivated', {
        userId: String(updatedUser._id),
        email: updatedUser.email,
        orgId: String(updatedUser.orgId),
        companyName: updatedUser.companyName
      }).catch(() => { })
    }

    return { id: updatedUser._id, email: updatedUser.email, isActive: updatedUser.isActive }
  })

  fastify.post('/users/:id/mfa/reset', {
    config: { rateLimit: { max: 6, timeWindow: '5 minutes' } },
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        currentPassword: Type.Optional(Type.String({ minLength: 1 })),
        code: Type.Optional(Type.String({ minLength: 6, maxLength: 8 }))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { currentPassword, code } = request.body as { currentPassword?: string; code?: string }

    const actor = await User.findOne({
      _id: request.user!.userId,
      role: 'superAdmin',
      isActive: true
    }).select('+hashedPassword +totpSecretEncrypted +totpLastUsedStep').exec()
    const recentSso = ['sso', 'totp'].includes(request.user!.authMethod || '')
      && Boolean(request.user!.authTime)
      && request.user!.authTime! >= Math.floor(Date.now() / 1000) - 10 * 60
    const actorConfirmed = actor?.ssoOnly
      ? recentSso
      : Boolean(actor && currentPassword && await actor.validatePassword(currentPassword))
    if (!actorConfirmed) {
      return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
    }
    if (!actor || !(await confirmMfaStepUp(actor, request.user, code))) {
      return reply.code(401).send({ error: 'A current authenticator code is required', code: 'MFA_STEP_UP_REQUIRED' })
    }

    const target = await User.findOneAndUpdate({
      _id: id,
      role: { $ne: 'superAdmin' }
    }, {
      $set: { totpEnabled: false, mfaResetAt: new Date(), recoveryCodeHashes: [] },
      $inc: { authVersion: 1 },
      $unset: {
        totpSecretEncrypted: 1,
        totpPendingSecretEncrypted: 1,
        totpPendingExpiresAt: 1,
        totpLastUsedStep: 1,
        refreshToken: 1
      }
    }, { new: true }).exec()
    if (!target) {
      return reply.code(404).send({ error: 'User not found', code: 'NOT_FOUND' })
    }

    await createAuditEntry(request, 'update', 'User', id, {
      after: { mfaEnabled: false, resetBy: 'super-admin' }
    })
    return { message: 'Two-factor authentication reset. All existing sessions were revoked immediately.' }
  })
}

export default userRoutes
