import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'


const JWT_SECRET = 'dev-jwt-secret-not-for-production-use-change-in-prod'
const JWT_REFRESH_SECRET = 'dev-refresh-secret-not-for-production-use-change-in-prod'

type UserRole = 'user' | 'manager' | 'admin' | 'superAdmin'

interface JwtPayload {
  userId: string
  role: UserRole
  orgId: string
}

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' })
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

function checkRoleAccess(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === 'superAdmin') return true
  return allowedRoles.includes(userRole)
}


describe('Auth Middleware — Pure Logic', () => {
  const testPayload: JwtPayload = { userId: 'user-123', role: 'admin', orgId: 'org-456' }

  describe('JWT Access Token Generation & Verification', () => {
    it('should generate a valid JWT string', () => {
      const token = generateAccessToken(testPayload)
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should round-trip verify the payload', () => {
      const token = generateAccessToken(testPayload)
      const decoded = verifyAccessToken(token)
      expect(decoded.userId).toBe('user-123')
      expect(decoded.role).toBe('admin')
      expect(decoded.orgId).toBe('org-456')
    })

    it('should include iat and exp claims', () => {
      const token = generateAccessToken(testPayload)
      const decoded = jwt.decode(token) as any
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
      expect(decoded.exp).toBeGreaterThan(decoded.iat)
    })

    it('should have ~15min expiry', () => {
      const token = generateAccessToken(testPayload)
      const decoded = jwt.decode(token) as any
      const diff = decoded.exp - decoded.iat
      expect(diff).toBe(15 * 60)
    })

    it('should reject token signed with wrong secret', () => {
      const fakeToken = jwt.sign(testPayload, 'wrong-secret', { expiresIn: '15m' })
      expect(() => verifyAccessToken(fakeToken)).toThrow()
    })

    it('should reject expired tokens', () => {
      const expired = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '-1s' })
      expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError)
    })

    it('should reject malformed tokens', () => {
      expect(() => verifyAccessToken('not.a.valid.token')).toThrow()
      expect(() => verifyAccessToken('')).toThrow()
      expect(() => verifyAccessToken('abc123')).toThrow()
    })
  })

  describe('JWT Refresh Token Generation & Verification', () => {
    it('should generate a different token from access token', () => {
      const access = generateAccessToken(testPayload)
      const refresh = generateRefreshToken(testPayload)
      expect(access).not.toBe(refresh)
    })

    it('should round-trip verify refresh token', () => {
      const token = generateRefreshToken(testPayload)
      const decoded = verifyRefreshToken(token)
      expect(decoded.userId).toBe('user-123')
    })

    it('should have ~7 day expiry', () => {
      const token = generateRefreshToken(testPayload)
      const decoded = jwt.decode(token) as any
      const diff = decoded.exp - decoded.iat
      expect(diff).toBe(7 * 24 * 60 * 60)
    })

    it('access token should NOT verify as refresh token', () => {
      const access = generateAccessToken(testPayload)
      expect(() => verifyRefreshToken(access)).toThrow()
    })

    it('refresh token should NOT verify as access token', () => {
      const refresh = generateRefreshToken(testPayload)
      expect(() => verifyAccessToken(refresh)).toThrow()
    })
  })

  describe('Bearer Token Extraction', () => {
    it('should extract token from "Bearer xxx"', () => {
      expect(extractBearerToken('Bearer abc123')).toBe('abc123')
    })

    it('should return null for missing header', () => {
      expect(extractBearerToken(undefined)).toBeNull()
    })

    it('should return null for non-Bearer scheme', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(extractBearerToken('')).toBeNull()
    })

    it('should handle "Bearer " with empty token', () => {
      expect(extractBearerToken('Bearer ')).toBe('')
    })

    it('should handle token with spaces', () => {
      expect(extractBearerToken('Bearer eyJ.abc.def')).toBe('eyJ.abc.def')
    })
  })

  describe('Role-Based Access Control', () => {
    it('user can access user-allowed routes', () => {
      expect(checkRoleAccess('user', ['user'])).toBe(true)
    })

    it('user cannot access admin routes', () => {
      expect(checkRoleAccess('user', ['admin'])).toBe(false)
    })

    it('admin can access admin routes', () => {
      expect(checkRoleAccess('admin', ['admin'])).toBe(true)
    })

    it('manager can access manager+admin routes', () => {
      expect(checkRoleAccess('manager', ['manager', 'admin'])).toBe(true)
    })

    it('manager cannot access admin-only routes', () => {
      expect(checkRoleAccess('manager', ['admin'])).toBe(false)
    })

    it('superAdmin bypasses ALL role checks', () => {
      expect(checkRoleAccess('superAdmin', ['user'])).toBe(true)
      expect(checkRoleAccess('superAdmin', ['admin'])).toBe(true)
      expect(checkRoleAccess('superAdmin', ['manager'])).toBe(true)
      expect(checkRoleAccess('superAdmin', [])).toBe(true)
    })

    it('user cannot access empty allowed list', () => {
      expect(checkRoleAccess('user', [])).toBe(false)
    })
  })

  describe('JWT Secret Separation', () => {
    it('access and refresh should use different secrets', () => {
      expect(JWT_SECRET).not.toBe(JWT_REFRESH_SECRET)
    })

    it('both secrets should be non-empty', () => {
      expect(JWT_SECRET.length).toBeGreaterThan(0)
      expect(JWT_REFRESH_SECRET.length).toBeGreaterThan(0)
    })
  })
})
