import { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { User, type UserRole } from '../../models/User'
import { Organization } from '../../models/Organization'

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET is required in production') })()
  : 'dev-jwt-secret-not-for-production-use-change-in-prod')
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_REFRESH_SECRET is required in production') })()
  : 'dev-refresh-secret-not-for-production-use-change-in-prod')
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m'
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d'

export interface JwtPayload {
  userId: string
  role: UserRole
  orgId: string
  authVersion?: number
  authMethod?: 'password' | 'totp' | 'recovery-code' | 'passkey' | 'sso'
  primaryAuthMethod?: 'password' | 'sso'
  authTime?: number
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
  }
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY as any })
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY as any,
    jwtid: crypto.randomUUID()
  })
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    const dbUser = await User.findById(payload.userId)
      .select('+authVersion isActive orgId role')
      .lean()
    if (!dbUser || !dbUser.isActive || (dbUser.authVersion ?? 0) !== (payload.authVersion ?? 0)
      || dbUser.role !== payload.role || String(dbUser.orgId) !== payload.orgId) {
      reply.code(401).send({ error: 'Session has been revoked', code: 'SESSION_REVOKED' })
      return
    }
    if (dbUser.role !== 'superAdmin') {
      const organization = await Organization.findById(dbUser.orgId).select('isActive').lean()
      if (!organization?.isActive) {
        reply.code(403).send({ error: 'This organization is inactive.', code: 'ORG_INACTIVE' })
        return
      }
    }
    request.user = payload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      reply.code(401).send({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    } else {
      reply.code(401).send({ error: 'Invalid token', code: 'INVALID_TOKEN' })
    }
    return
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
      return
    }

    if (!allowedRoles.includes(request.user.role) && request.user.role !== 'superAdmin') {
      reply.code(403).send({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      })
      return
    }
  }
}

export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    reply.code(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    return
  }

  if (request.user.role !== 'superAdmin') {
    reply.code(403).send({ error: 'Platform super-admin access required', code: 'SUPER_ADMIN_REQUIRED' })
    return
  }

  const { User } = await import('../../models/User')
  const dbUser = await User.findById(request.user.userId).select('role isActive').lean()
  if (!dbUser || dbUser.role !== 'superAdmin' || !dbUser.isActive) {
    reply.code(403).send({ error: 'Platform super-admin access required', code: 'SUPER_ADMIN_REQUIRED' })
    return
  }
}
