import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { User } from '../../models/User'
import { Organization } from '../../models/Organization'
import { Employee } from '../../models/Employee'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
  JwtPayload
} from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { dispatchPlatformEvent } from '../services/platformNotifier'
import { sendPasswordResetEmail, sendTrialStartedEmail, sendWelcomeEmail } from '../services/emailService'
import { buildTrialPeriod, DEFAULT_ENTERPRISE_TRIAL_DAYS } from '../services/billingService'
import { issueUserSession } from '../services/authSession'
import { createSecurityChallenge } from '../services/authSecurity'
import authSecurityRoutes from './authSecurity'
import crypto from 'crypto'

function matchAuthVersion(authVersion: number): Record<string, unknown> {
  return authVersion === 0
    ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
    : { authVersion }
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')
    reply.header('Pragma', 'no-cache')
  })
  await fastify.register(authSecurityRoutes)

  fastify.post('/register', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String({ minLength: 8, pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$' }),
        firstName: Type.String({ minLength: 1 }),
        lastName: Type.String({ minLength: 1 }),
        companyName: Type.String({ minLength: 2 }),
        department: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { email, password, firstName, lastName, companyName, department } = request.body as {
      email: string
      password: string
      firstName: string
      lastName: string
      companyName: string
      department?: string
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return reply.code(409).send({ error: 'Email already registered', code: 'EMAIL_EXISTS' })
    }





    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const existingOrg = await Organization.findOne({ slug })

    if (existingOrg) {
      return reply.code(409).send({
        error: 'An organization with this name already exists. Please ask your administrator for an invite link, or sign in via SSO.',
        code: 'ORG_EXISTS'
      })
    }

    const org = await Organization.create({
      name: companyName,
      slug,
      plan: 'enterprise',
      billing: buildTrialPeriod(DEFAULT_ENTERPRISE_TRIAL_DAYS)
    })
    const role: 'admin' | 'employee' = 'admin'

    const user = new User({
      email,
      firstName,
      lastName,
      orgId: org._id,
      companyName: org.name,
      department,
      role
    })
    await user.setPassword(password)
    await user.save()

    const { createOrgDefaults } = await import('../services/orgDefaults')
    await createOrgDefaults(String(org._id))



    let employee = await Employee.findOne({ orgId: org._id, email: email.toLowerCase() })
    if (employee) {
      employee.userId = user._id as any
      await employee.save()
    } else {
      employee = await Employee.create({
        orgId: org._id,
        userId: user._id,
        firstName,
        lastName,
        email: email.toLowerCase(),
        department: department || undefined,
        isActive: true
      })
    }

    const tokenPayload: JwtPayload = {
      userId: String(user._id),
      role: user.role,
      orgId: String(org._id),
      authVersion: user.authVersion ?? 0,
      authMethod: 'password',
      primaryAuthMethod: 'password',
      authTime: Math.floor(Date.now() / 1000)
    }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    user.refreshToken = refreshToken
    await user.save()

    dispatchPlatformEvent(
      role === 'admin' ? 'org.registered' : 'user.joined',
      {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        companyName: org.name,
        orgId: String(org._id),
        role
      }
    ).catch((err) => {
      console.error('[PlatformNotifier] Registration event failed:', err?.message ?? err)
    })

    sendWelcomeEmail(
      user.email,
      user.firstName || 'Nutzer'
    ).catch((err) => {
      console.error('[EmailService] Welcome email failed:', err?.message ?? err)
    })

    sendTrialStartedEmail(
      user.email,
      user.firstName || 'Nutzer',
      'Enterprise',
      DEFAULT_ENTERPRISE_TRIAL_DAYS
    ).catch((err) => {
      console.error('[EmailService] Trial email failed:', err?.message ?? err)
    })

    return reply.code(201).send({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        companyName: org.name,
        department: user.department,
        role: user.role,
        permissions: user.permissions || [],
        orgId: String(org._id),
        ssoOnly: Boolean(user.ssoOnly),
        onboardingCompleted: user.onboardingCompleted ?? false
      }
    })
  })

  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String()
      })
    }
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    const user = await User.findOne({ email, isActive: true })
      .select('+hashedPassword +refreshToken +authVersion')
      .exec()

    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' })
    }

    const isValid = await user.validatePassword(password)
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' })
    }



    const organization = await Organization.findById(user.orgId)
      .select('isActive settings.integrations.sso.enabled settings.integrations.sso.forceSso')
      .lean()
    if (!organization?.isActive) {
      return reply.code(403).send({ error: 'This organization is inactive.', code: 'ORG_INACTIVE' })
    }
    const sso = (organization?.settings as any)?.integrations?.sso
    if (sso?.enabled && sso?.forceSso) {
      return reply.code(403).send({
        error: 'Password sign-in is disabled for this organization. Continue with SSO.',
        code: 'SSO_REQUIRED'
      })
    }

    if (user.totpEnabled) {
      return {
        mfaRequired: true,
        challengeToken: await createSecurityChallenge({
          purpose: 'mfa-login',
          userId: String(user._id),
          primaryAuthMethod: 'password',
          authVersion: user.authVersion ?? 0
        }),
        methods: ['totp', 'recovery-code']
      }
    }

    return await issueUserSession(fastify, request, user, 'password')
  })

  fastify.post('/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: Type.Object({
        refreshToken: Type.String()
      })
    }
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }

    try {
      const payload = verifyRefreshToken(refreshToken)

      const user = await User.findById(payload.userId)
        .select('+refreshToken +authVersion')
        .exec()

      const authVersion = user?.authVersion ?? 0
      if (!user || !user.isActive || user.refreshToken !== refreshToken || authVersion !== (payload.authVersion ?? 0)) {
        return reply.code(401).send({ error: 'Invalid refresh token', code: 'INVALID_REFRESH' })
      }

      if (user.role !== 'superAdmin') {
        const organization = await Organization.findById(user.orgId)
          .select('isActive settings.integrations.sso.enabled settings.integrations.sso.forceSso')
          .lean()
        if (!organization?.isActive) {
          return reply.code(403).send({ error: 'This organization is inactive.', code: 'ORG_INACTIVE' })
        }
        const sso = (organization.settings as any)?.integrations?.sso
        const ssoBacked = payload.authMethod === 'sso' || payload.primaryAuthMethod === 'sso'
        if (sso?.enabled && sso?.forceSso && !ssoBacked) {
          await User.updateOne({ _id: user._id, refreshToken }, { $unset: { refreshToken: 1 } })
          return reply.code(403).send({ error: 'Local sessions are disabled for this organization.', code: 'SSO_REQUIRED' })
        }
      }

      const newTokenPayload: JwtPayload = {
        userId: String(user._id),
        role: user.role,
        orgId: String(user.orgId),
        authVersion,
        authMethod: payload.authMethod,
        primaryAuthMethod: payload.primaryAuthMethod,
        authTime: payload.authTime
      }
      const newAccessToken = generateAccessToken(newTokenPayload)
      const newRefreshToken = generateRefreshToken(newTokenPayload)




      const rotated = await User.updateOne({
        _id: user._id,
        isActive: true,
        refreshToken,
        ...matchAuthVersion(authVersion)
      }, { $set: { refreshToken: newRefreshToken } })
      if (rotated.modifiedCount !== 1) {
        return reply.code(401).send({ error: 'Invalid refresh token', code: 'INVALID_REFRESH' })
      }

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH' })
    }
  })

  fastify.post('/logout', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }

    await User.findByIdAndUpdate(request.user.userId, { $unset: { refreshToken: 1 } })

    await createAuditEntry(request, 'logout', 'User', request.user.userId)

    return { message: 'Logged out successfully' }
  })

  fastify.get('/me', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }

    const user = await User.findById(request.user.userId)
    if (!user || !user.isActive) {
      return reply.code(404).send({ error: 'User not found', code: 'USER_NOT_FOUND' })
    }

    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      companyName: user.companyName,
      department: user.department,
      role: user.role,
      permissions: user.permissions || [],
      orgId: String(user.orgId),
      ssoOnly: Boolean(user.ssoOnly),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      onboardingCompleted: user.onboardingCompleted ?? false
    }
  })

  fastify.put('/profile', {
    preHandler: [authenticate],
    schema: {
      body: Type.Object({
        firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
        lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
        department: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()]))
      })
    }
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }

    const body = request.body as { firstName?: string; lastName?: string; department?: string | null }
    const user = await User.findById(request.user.userId)
    if (!user || !user.isActive) {
      return reply.code(404).send({ error: 'User not found', code: 'USER_NOT_FOUND' })
    }

    if (body.firstName) user.firstName = body.firstName
    if (body.lastName) user.lastName = body.lastName
    if (body.department !== undefined) user.department = body.department || undefined
    await user.save()

    await createAuditEntry(request, 'update' as any, 'User', request.user.userId)

    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      companyName: user.companyName,
      department: user.department,
      role: user.role,
      orgId: String(user.orgId)
    }
  })

  fastify.put('/password', {
    preHandler: [authenticate],
    schema: {
      body: Type.Object({
        currentPassword: Type.String(),
        newPassword: Type.String({ minLength: 8 })
      })
    }
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }

    const { currentPassword, newPassword } = request.body as {
      currentPassword: string
      newPassword: string
    }

    const user = await User.findById(request.user.userId)
      .select('+hashedPassword +authVersion')
      .exec()

    if (!user || !user.isActive) {
      return reply.code(404).send({ error: 'User not found', code: 'USER_NOT_FOUND' })
    }

    const isValid = await user.validatePassword(currentPassword)
    if (!isValid) {
      return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
    }

    await user.setPassword(newPassword)
    const authVersion = user.authVersion ?? 0
    const rotatedUser = await User.findOneAndUpdate({
      _id: user._id,
      isActive: true,
      ...matchAuthVersion(authVersion)
    }, {
      $set: {
        hashedPassword: user.hashedPassword,
        passwordChangedAt: user.passwordChangedAt ?? new Date()
      },
      $inc: { authVersion: 1 },
      $unset: { refreshToken: 1 }
    }, { new: true }).select('+authVersion').exec()
    if (!rotatedUser) {
      return reply.code(409).send({ error: 'Your session changed. Please sign in again.', code: 'SESSION_CHANGED' })
    }

    const session = await issueUserSession(fastify, request, rotatedUser, 'password', undefined, false)

    await createAuditEntry(request, 'update' as any, 'User', request.user.userId, {
      after: { passwordChanged: true }
    })

    return { message: 'Password changed successfully', ...session }
  })

  fastify.post('/forgot-password', {
    config: { rateLimit: { max: 3, timeWindow: '5 minutes' } },
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' })
      })
    }
  }, async (request) => {
    const { email } = request.body as { email: string }

    const successMsg = { message: 'If an account with this email exists, a reset link has been sent.' }

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
    if (!user) return successMsg

    if (user.ssoOnly) return successMsg

    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

    user.resetToken = hashedToken
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)
    await user.save()

    const baseUrl = process.env.APP_URL || 'http://localhost:5173'
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`

    fastify.log.info(`🔐 Password reset requested for ${email}`)
    sendPasswordResetEmail(
      email,
      resetUrl,
      user.firstName || undefined
    ).catch(err => fastify.log.error({ err }, 'Failed to send password reset email'))

    return successMsg
  })

  fastify.post('/reset-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        token: Type.String({ minLength: 64, maxLength: 64 }),
        newPassword: Type.String({ minLength: 8 })
      })
    }
  }, async (request, reply) => {
    const { email, token, newPassword } = request.body as {
      email: string; token: string; newPassword: string
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      email: email.toLowerCase(),
      isActive: true
    }).select('+resetToken +resetTokenExpiry +authVersion')

    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      return reply.code(400).send({ error: 'Invalid or expired reset token' })
    }

    if (user.resetToken !== hashedToken || user.resetTokenExpiry < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired reset token' })
    }



    await user.setPassword(newPassword)
    const authVersion = user.authVersion ?? 0
    const changed = await User.updateOne({
      _id: user._id,
      isActive: true,
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: new Date() },
      ...matchAuthVersion(authVersion)
    }, {
      $set: {
        hashedPassword: user.hashedPassword,
        passwordChangedAt: user.passwordChangedAt ?? new Date()
      },
      $inc: { authVersion: 1 },
      $unset: { resetToken: 1, resetTokenExpiry: 1, refreshToken: 1 }
    })
    if (changed.modifiedCount !== 1) {
      return reply.code(400).send({ error: 'Invalid or expired reset token' })
    }

    return { message: 'Password reset successfully. All existing sessions were revoked; you can now sign in.' }
  })


  fastify.patch('/onboarding', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }
    await User.findByIdAndUpdate(request.user.userId, { onboardingCompleted: true })
    return { success: true }
  })

  fastify.delete('/onboarding', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    }
    await User.findByIdAndUpdate(request.user.userId, { onboardingCompleted: false })
    return { success: true }
  })







  const ssoUnavailable = async (_request: unknown, reply: any) => reply.code(503).send({
    error: 'SAML sign-in is unavailable until a standards-complete validator is configured.',
    code: 'SSO_NOT_CONFIGURED'
  })

  fastify.post('/sso/discover', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, ssoUnavailable)
  fastify.get('/sso/:ssoSlug', ssoUnavailable)
  fastify.post('/sso/callback', ssoUnavailable)
  fastify.post('/sso/exchange', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, ssoUnavailable)

  fastify.get('/sso/metadata/:ssoSlug', async (request, reply) => {
    const { ssoSlug } = request.params as { ssoSlug: string }

    const { buildSamlConfig, generateSpMetadata } = await import('../services/sso')
    const result = await buildSamlConfig(ssoSlug)
    if (!result) {
      return reply.code(404).send({ error: 'SSO not configured for this organization' })
    }

    const metadata = generateSpMetadata(result.config)
    reply.type('application/xml')
    return metadata
  })
}

export default authRoutes
