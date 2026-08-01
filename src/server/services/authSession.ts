import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { IUser } from '../../models/User'
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { generateAccessToken, generateRefreshToken, type JwtPayload } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'

export class AuthSessionPolicyError extends Error {
  constructor(
    message: string,
    readonly code: 'ORG_INACTIVE' | 'SSO_REQUIRED',
    readonly statusCode = 403
  ) {
    super(message)
    this.name = 'AuthSessionPolicyError'
  }
}

export async function assertSessionIssuanceAllowed(
  user: IUser,
  loginMethod: 'password' | 'totp' | 'recovery-code' | 'passkey',
  primaryAuthMethod?: 'password' | 'sso'
): Promise<void> {
  if (user.role === 'superAdmin') return

  const organization = await Organization.findById(user.orgId)
    .select('isActive settings.integrations.sso.enabled settings.integrations.sso.forceSso')
    .lean()
  if (!organization?.isActive) {
    throw new AuthSessionPolicyError('This organization is inactive.', 'ORG_INACTIVE')
  }

  const sso = (organization.settings as any)?.integrations?.sso
  const ssoBacked = primaryAuthMethod === 'sso'
  if (sso?.enabled && sso?.forceSso && !ssoBacked) {
    throw new AuthSessionPolicyError('Local sign-in is disabled for this organization.', 'SSO_REQUIRED')
  }
}

export function publicUser(user: IUser) {
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
    onboardingCompleted: user.onboardingCompleted ?? false
  }
}

export async function issueUserSession(
  fastify: FastifyInstance,
  request: FastifyRequest,
  user: IUser,
  loginMethod: 'password' | 'totp' | 'recovery-code' | 'passkey',
  primaryAuthMethod?: 'password' | 'sso',
  recordLogin = true
) {
  await assertSessionIssuanceAllowed(user, loginMethod, primaryAuthMethod)

  const tokenPayload: JwtPayload = {
    userId: String(user._id),
    role: user.role,
    orgId: String(user.orgId),
    authVersion: user.authVersion ?? 0,
    authMethod: loginMethod,
    primaryAuthMethod: primaryAuthMethod || (loginMethod === 'password' ? 'password' : undefined),
    authTime: Math.floor(Date.now() / 1000)
  }
  const accessToken = generateAccessToken(tokenPayload)
  const refreshToken = generateRefreshToken(tokenPayload)

  user.lastLoginAt = new Date()
  user.refreshToken = refreshToken
  await user.save()

  try {
    const unlinkedEmployee = await Employee.findOne({
      orgId: user.orgId,
      email: user.email.toLowerCase(),
      $or: [{ userId: null }, { userId: { $exists: false } }]
    })
    if (unlinkedEmployee) {
      unlinkedEmployee.userId = user._id as any
      await unlinkedEmployee.save()
    }
  } catch (error) {
    fastify.log.warn({ error, userId: String(user._id) }, 'Failed to auto-link employee during login')
  }

  if (recordLogin) {
    await createAuditEntry(
      { ...request, user: tokenPayload } as FastifyRequest,
      'login',
      'User',
      String(user._id),
      { after: { loginMethod, ...(primaryAuthMethod && { primaryAuthMethod }) } }
    )
  }

  return { accessToken, refreshToken, user: publicUser(user) }
}
