import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import crypto from 'crypto'
import { Invite } from '../../models/Invite'
import { User } from '../../models/User'
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { authenticate } from '../middleware/auth'
import { getLimits, isLimitReached } from '../config/plans'
import type { PlanKey } from '../config/plans'
import { resolveEffectivePlan } from '../services/entitlementService'
import { sendInviteEmail } from '../services/emailService'
import {
  generateAccessToken,
  generateRefreshToken,
  JwtPayload
} from '../middleware/auth'

const INVITE_EXPIRY_DAYS = 7

const inviteRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/validate', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      querystring: Type.Object({
        token: Type.String({ minLength: 64, maxLength: 64 })
      })
    }
  }, async (request, reply) => {
    const { token } = request.query as { token: string }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const invite = await Invite.findOne({ hashedToken, expiresAt: { $gt: new Date() } })
      .select('+hashedToken')
    if (!invite) {
      return reply.code(404).send({ error: 'Invite not found or expired.' })
    }

    const org = await Organization.findById(invite.orgId)
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found.' })
    }
    if (!org.isActive) {
      return reply.code(403).send({ error: 'This organization is inactive.', code: 'ORG_INACTIVE' })
    }
    const sso = (org.settings as any)?.integrations?.sso
    if (sso?.enabled && sso?.forceSso) {
      return reply.code(403).send({
        error: 'Local invite sign-up is disabled for this organization.',
        code: 'SSO_REQUIRED'
      })
    }

    return {
      email: invite.email,
      orgName: org.name,
      role: invite.role
    }
  })

  fastify.post('/accept', {
    config: { rateLimit: { max: 5, timeWindow: '5 minutes' } },
    schema: {
      body: Type.Object({
        token: Type.String({ minLength: 64, maxLength: 64 }),
        firstName: Type.String({ minLength: 1 }),
        lastName: Type.String({ minLength: 1 }),
        password: Type.String({ minLength: 8 })
      })
    }
  }, async (request, reply) => {
    const { token, firstName, lastName, password } = request.body as {
      token: string; firstName: string; lastName: string; password: string
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const invite = await Invite.findOne({ hashedToken, expiresAt: { $gt: new Date() } })
      .select('+hashedToken')
    if (!invite) {
      return reply.code(400).send({ error: 'Invalid or expired invite.' })
    }

    const existingUser = await User.findOne({ email: invite.email })
    if (existingUser) {
      await Invite.findByIdAndDelete(invite._id)
      return reply.code(409).send({ error: 'An account with this email already exists. Please sign in instead.' })
    }

    const org = await Organization.findById(invite.orgId)
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found.' })
    }

    const userCount = await User.countDocuments({ orgId: invite.orgId })
    const planLimits = getLimits(resolveEffectivePlan((org.plan as PlanKey) || 'free', (org as any).billing))
    if (isLimitReached(userCount, planLimits.users)) {
      return reply.code(403).send({
        error: 'User limit reached for this organization. Please contact your administrator.',
        code: 'PLAN_LIMIT_REACHED'
      })
    }

    const user = new User({
      email: invite.email,
      firstName,
      lastName,
      orgId: invite.orgId,
      companyName: org.name,
      role: invite.role,
      isActive: true
    })
    await user.setPassword(password)
    await user.save()

    let employee = await Employee.findOne({ orgId: invite.orgId, email: invite.email })
    if (employee) {
      employee.userId = user._id as any
      employee.firstName = firstName
      employee.lastName = lastName
      await employee.save()
    } else {
      await Employee.create({
        orgId: invite.orgId,
        userId: user._id,
        firstName,
        lastName,
        email: invite.email,
        isActive: true
      })
    }

    const tokenPayload: JwtPayload = {
      userId: String(user._id),
      role: user.role,
      orgId: String(invite.orgId),
      authVersion: user.authVersion ?? 0,
      authMethod: 'password',
      primaryAuthMethod: 'password',
      authTime: Math.floor(Date.now() / 1000)
    }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    user.refreshToken = refreshToken
    await user.save()

    await Invite.findByIdAndDelete(invite._id)

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
        role: user.role,
        permissions: user.permissions || [],
        orgId: String(invite.orgId)
      }
    })
  })


  fastify.post('/', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        role: Type.Optional(Type.Union([
          Type.Literal('admin'),
          Type.Literal('manager'),
          Type.Literal('employee'),
          Type.Literal('viewer')
        ]))
      })
    }
  }, async (request, reply) => {
    if (!request.user || !['admin', 'superAdmin'].includes(request.user.role)) {
      return reply.code(403).send({ error: 'Only admins can invite users.' })
    }

    const { email, role } = request.body as { email: string; role?: string }
    const orgId = request.user.orgId

    const existingUser = await User.findOne({ email: email.toLowerCase(), orgId })
    if (existingUser) {
      return reply.code(409).send({ error: 'This email is already registered in your organization.' })
    }

    const org = await Organization.findById(orgId)
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found.' })
    }
    const userCount = await User.countDocuments({ orgId })
    const planLimits = getLimits(resolveEffectivePlan((org.plan as PlanKey) || 'free', (org as any).billing))
    if (isLimitReached(userCount, planLimits.users)) {
      return reply.code(403).send({
        error: 'User limit reached. Upgrade your plan to invite more users.',
        code: 'PLAN_LIMIT_REACHED'
      })
    }

    await Invite.deleteOne({ orgId, email: email.toLowerCase() })

    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

    const invite = await Invite.create({
      email: email.toLowerCase(),
      orgId,
      role: role || 'employee',
      hashedToken,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      invitedBy: request.user.userId
    })

    const baseUrl = process.env.APP_URL || 'http://localhost:5173'
    const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`

    const inviter = await User.findById(request.user.userId)
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : undefined

    sendInviteEmail(
      email.toLowerCase(),
      inviteUrl,
      org.name,
      inviterName
    ).catch(err => {
      fastify.log.error({ err }, `Failed to send invite email to ${email}`)
    })

    return reply.code(201).send({
      id: invite._id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt
    })
  })

  fastify.get('/', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (!request.user || !['admin', 'superAdmin'].includes(request.user.role)) {
      return reply.code(403).send({ error: 'Only admins can view invites.' })
    }

    const invites = await Invite.find({
      orgId: request.user.orgId,
      expiresAt: { $gt: new Date() }
    })
      .populate('invitedBy', 'firstName lastName')
      .sort({ createdAt: -1 })

    return invites.map(inv => ({
      id: inv._id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
      invitedBy: inv.invitedBy,
      createdAt: inv.createdAt
    }))
  })

  fastify.delete('/:id', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (!request.user || !['admin', 'superAdmin'].includes(request.user.role)) {
      return reply.code(403).send({ error: 'Only admins can revoke invites.' })
    }

    const { id } = request.params as { id: string }
    const invite = await Invite.findOneAndDelete({ _id: id, orgId: request.user.orgId })

    if (!invite) {
      return reply.code(404).send({ error: 'Invite not found.' })
    }

    return { message: 'Invite revoked.' }
  })
}

export default inviteRoutes
