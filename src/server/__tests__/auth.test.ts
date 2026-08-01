import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { User } from '../../models/User'
import { Organization } from '../../models/Organization'

vi.stubEnv('JWT_SECRET', 'test-secret-key-32chars-minimum!')
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-key-32chars!')
vi.stubEnv('JWT_ACCESS_EXPIRY', '15m')
vi.stubEnv('JWT_REFRESH_EXPIRY', '7d')

const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticate,
  requireRole,
} = await import('../../server/middleware/auth')

const TEST_PAYLOAD = { userId: 'user123', role: 'admin' as const, orgId: 'org456', authVersion: 0 }

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('Token Generation & Verification', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(TEST_PAYLOAD)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(TEST_PAYLOAD)
      expect(token).toBeTruthy()
      expect(token.split('.')).toHaveLength(3)
    })

    it('should generate a unique refresh token for rotation', () => {
      expect(generateRefreshToken(TEST_PAYLOAD)).not.toBe(generateRefreshToken(TEST_PAYLOAD))
    })

    it('access and refresh tokens should be different', () => {
      const access = generateAccessToken(TEST_PAYLOAD)
      const refresh = generateRefreshToken(TEST_PAYLOAD)
      expect(access).not.toBe(refresh)
    })

    it('should verify a valid access token and return the payload', () => {
      const token = generateAccessToken(TEST_PAYLOAD)
      const decoded = verifyAccessToken(token)
      expect(decoded.userId).toBe('user123')
      expect(decoded.role).toBe('admin')
      expect(decoded.orgId).toBe('org456')
    })

    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(TEST_PAYLOAD)
      const decoded = verifyRefreshToken(token)
      expect(decoded.userId).toBe('user123')
      expect(decoded.orgId).toBe('org456')
    })

    it('should reject an access token signed with wrong secret', () => {
      const fakeToken = jwt.sign(TEST_PAYLOAD, 'wrong-secret')
      expect(() => verifyAccessToken(fakeToken)).toThrow()
    })

    it('should reject a refresh token signed with the access secret', () => {
      const token = generateAccessToken(TEST_PAYLOAD)
      expect(() => verifyRefreshToken(token)).toThrow()
    })

    it('should reject a tampered token', () => {
      const token = generateAccessToken(TEST_PAYLOAD)
      const tampered = token.slice(0, -5) + 'XXXXX'
      expect(() => verifyAccessToken(tampered)).toThrow()
    })

    it('should include exp claim in access tokens', () => {
      const token = generateAccessToken(TEST_PAYLOAD)
      const decoded = jwt.decode(token) as any
      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
    })
  })

  describe('authenticate middleware', () => {
    function mockDbUser(authVersion = 0, isActive = true) {
      vi.spyOn(User, 'findById').mockReturnValue({
        select: () => ({ lean: async () => ({ authVersion, isActive, orgId: 'org456', role: 'admin' }) })
      } as any)
      vi.spyOn(Organization, 'findById').mockReturnValue({
        select: () => ({ lean: async () => ({ isActive: true }) })
      } as any)
    }

    function mockRequest(authHeader?: string) {
      return { headers: { authorization: authHeader }, user: undefined } as any
    }

    function mockReply() {
      const reply: any = { statusCode: 200, body: null }
      reply.code = vi.fn((code: number) => { reply.statusCode = code; return reply })
      reply.send = vi.fn((body: any) => { reply.body = body; return reply })
      return reply
    }

    it('should attach user payload for a valid token', async () => {
      mockDbUser()
      const token = generateAccessToken(TEST_PAYLOAD)
      const req = mockRequest(`Bearer ${token}`)
      const rep = mockReply()
      await authenticate(req, rep)
      expect(req.user).toBeDefined()
      expect(req.user.userId).toBe('user123')
      expect(req.user.orgId).toBe('org456')
      expect(rep.code).not.toHaveBeenCalled()
    })

    it('should reject an access token after the user auth version changes', async () => {
      mockDbUser(1)
      const token = generateAccessToken(TEST_PAYLOAD)
      const req = mockRequest(`Bearer ${token}`)
      const rep = mockReply()

      await authenticate(req, rep)

      expect(req.user).toBeUndefined()
      expect(rep.code).toHaveBeenCalledWith(401)
      expect(rep.body.code).toBe('SESSION_REVOKED')
    })

    it('should return 401 when no Authorization header', async () => {
      const req = mockRequest()
      const rep = mockReply()
      await authenticate(req, rep)
      expect(rep.code).toHaveBeenCalledWith(401)
      expect(rep.body.code).toBe('AUTH_REQUIRED')
    })

    it('should return 401 when Authorization header is not Bearer', async () => {
      const req = mockRequest('Basic dXNlcjpwYXNz')
      const rep = mockReply()
      await authenticate(req, rep)
      expect(rep.code).toHaveBeenCalledWith(401)
      expect(rep.body.code).toBe('AUTH_REQUIRED')
    })

    it('should return 401 with INVALID_TOKEN for a garbage token', async () => {
      const req = mockRequest('Bearer not-a-real-jwt-token')
      const rep = mockReply()
      await authenticate(req, rep)
      expect(rep.code).toHaveBeenCalledWith(401)
      expect(rep.body.code).toBe('INVALID_TOKEN')
    })

    it('should return 401 with TOKEN_EXPIRED for an expired token', async () => {
      const expiredToken = jwt.sign(
        { ...TEST_PAYLOAD, iat: Math.floor(Date.now() / 1000) - 3600 },
        'test-secret-key-32chars-minimum!',
        { expiresIn: '1s' }
      )
      await new Promise(r => setTimeout(r, 1100))
      const req = mockRequest(`Bearer ${expiredToken}`)
      const rep = mockReply()
      await authenticate(req, rep)
      expect(rep.code).toHaveBeenCalledWith(401)
      expect(rep.body.code).toBe('TOKEN_EXPIRED')
    })

    it('should handle Bearer with empty token string', async () => {
      const req = mockRequest('Bearer ')
      const rep = mockReply()
      await authenticate(req, rep)
      expect(rep.code).toHaveBeenCalledWith(401)
    })
  })

  describe('requireRole factory', () => {
    function mockRequest(role: string) {
      return { user: { userId: 'u1', role, orgId: 'o1' } } as any
    }

    function mockReply() {
      const reply: any = { statusCode: 200, body: null }
      reply.code = vi.fn((code: number) => { reply.statusCode = code; return reply })
      reply.send = vi.fn((body: any) => { reply.body = body; return reply })
      return reply
    }

    it('should allow admin when admin is required', async () => {
      const handler = requireRole('admin')
      const req = mockRequest('admin')
      const rep = mockReply()
      await handler(req, rep)
      expect(rep.code).not.toHaveBeenCalled()
    })

    it('should reject employee when admin is required', async () => {
      const handler = requireRole('admin')
      const req = mockRequest('employee')
      const rep = mockReply()
      await handler(req, rep)
      expect(rep.code).toHaveBeenCalledWith(403)
      expect(rep.body.code).toBe('FORBIDDEN')
    })

    it('should always allow superAdmin regardless of required role', async () => {
      const handler = requireRole('admin')
      const req = mockRequest('superAdmin')
      const rep = mockReply()
      await handler(req, rep)
      expect(rep.code).not.toHaveBeenCalled()
    })

    it('should accept multiple allowed roles', async () => {
      const handler = requireRole('admin', 'assetManager')
      const req = mockRequest('assetManager')
      const rep = mockReply()
      await handler(req, rep)
      expect(rep.code).not.toHaveBeenCalled()
    })

    it('should return 401 when user is not set', async () => {
      const handler = requireRole('admin')
      const req = { user: undefined } as any
      const rep = mockReply()
      await handler(req, rep)
      expect(rep.code).toHaveBeenCalledWith(401)
    })
  })
})
