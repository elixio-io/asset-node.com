import Fastify, { type FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { User } from '../../models/User'
import { Organization } from '../../models/Organization'

const ACCESS_SECRET = 'refresh-route-access-secret-with-32-chars'
vi.stubEnv('JWT_SECRET', ACCESS_SECRET)
vi.stubEnv('JWT_REFRESH_SECRET', 'refresh-route-refresh-secret-with-32-chars')

const { default: authRoutes } = await import('../routes/auth')
const { generateRefreshToken } = await import('../middleware/auth')

describe('POST /refresh', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify({ logger: false })
    await app.register(authRoutes)
    await app.ready()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await app.close()
  })

  function mockRefreshUser(refreshToken: string, authVersion = 0) {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      orgId: '507f1f77bcf86cd799439012',
      role: 'admin',
      isActive: true,
      refreshToken,
      authVersion
    }
    const query: any = { select: () => query, exec: async () => user }
    vi.spyOn(User, 'findById').mockReturnValue(query)
    vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any)
    vi.spyOn(Organization, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ isActive: true, settings: {} }) })
    } as any)
    return user
  }

  function validRefreshToken(authVersion = 0) {
    return generateRefreshToken({
      userId: '507f1f77bcf86cd799439011',
      orgId: '507f1f77bcf86cd799439012',
      role: 'admin',
      authVersion,
      authMethod: 'password',
      authTime: Math.floor(Date.now() / 1000)
    })
  }

  it('rotates a valid refresh token without requiring an access token', async () => {
    const refreshToken = validRefreshToken()
    mockRefreshUser(refreshToken)

    const response = await app.inject({
      method: 'POST',
      url: '/refresh',
      payload: { refreshToken }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().refreshToken).not.toBe(refreshToken)
    expect(User.updateOne).toHaveBeenCalledOnce()
  })

  it('ignores an expired access bearer when the refresh token is valid', async () => {
    const refreshToken = validRefreshToken()
    mockRefreshUser(refreshToken)
    const expiredAccessToken = jwt.sign({
      userId: '507f1f77bcf86cd799439011',
      orgId: '507f1f77bcf86cd799439012',
      role: 'admin',
      authVersion: 0
    }, ACCESS_SECRET, { expiresIn: '-1s' })

    const response = await app.inject({
      method: 'POST',
      url: '/refresh',
      headers: { authorization: `Bearer ${expiredAccessToken}` },
      payload: { refreshToken }
    })

    expect(response.statusCode).toBe(200)
  })

  it('rejects a refresh token from an invalidated auth version', async () => {
    const refreshToken = validRefreshToken(0)
    mockRefreshUser(refreshToken, 1)

    const response = await app.inject({
      method: 'POST',
      url: '/refresh',
      payload: { refreshToken }
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().code).toBe('INVALID_REFRESH')
    expect(User.updateOne).not.toHaveBeenCalled()
  })
})
