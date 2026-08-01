import Fastify, { type FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditLog } from '../../models/AuditLog'
import { Employee } from '../../models/Employee'
import { User } from '../../models/User'
import { Organization } from '../../models/Organization'

vi.stubEnv('JWT_SECRET', 'credential-route-access-secret-with-32-chars')
vi.stubEnv('JWT_REFRESH_SECRET', 'credential-route-refresh-secret-with-32-chars')

const { default: authRoutes } = await import('../routes/auth')
const { generateAccessToken, verifyAccessToken } = await import('../middleware/auth')

describe('password session revocation', () => {
  const userId = '507f1f77bcf86cd799439011'
  const orgId = '507f1f77bcf86cd799439012'
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

  it('increments authVersion on reset and removes the stored refresh token', async () => {
    const resetToken = 'a'.repeat(64)
    const user: any = {
      _id: userId,
      isActive: true,
      authVersion: 4,
      resetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
      resetTokenExpiry: new Date(Date.now() + 60_000),
      setPassword: vi.fn(async function (this: any) {
        this.hashedPassword = 'replacement-password-hash'
        this.passwordChangedAt = new Date()
      })
    }
    vi.spyOn(User, 'findOne').mockReturnValue({ select: async () => user } as any)
    const update = vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any)

    const response = await app.inject({
      method: 'POST',
      url: '/reset-password',
      payload: { email: 'user@example.com', token: resetToken, newPassword: 'NewPassword123' }
    })

    expect(response.statusCode).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ _id: userId, authVersion: 4 }),
      expect.objectContaining({
        $inc: { authVersion: 1 },
        $unset: expect.objectContaining({ refreshToken: 1, resetToken: 1, resetTokenExpiry: 1 })
      })
    )
    expect(response.json().message).toContain('sessions were revoked')
  })

  it('changes the password and returns a replacement session at the next authVersion', async () => {
    const currentUser: any = {
      _id: userId,
      orgId,
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      companyName: 'Example',
      role: 'admin',
      permissions: [],
      isActive: true,
      onboardingCompleted: true,
      authVersion: 2,
      validatePassword: vi.fn().mockResolvedValue(true),
      setPassword: vi.fn(async function (this: any) {
        this.hashedPassword = 'changed-password-hash'
        this.passwordChangedAt = new Date()
      })
    }
    const rotatedUser: any = {
      ...currentUser,
      authVersion: 3,
      save: vi.fn().mockResolvedValue(undefined)
    }
    vi.spyOn(User, 'findById').mockImplementation(() => {
      const query: any = {}
      query.select = (selection: string) => {
        if (selection.includes('hashedPassword')) return { exec: async () => currentUser }
        return {
          lean: async () => selection.includes('email')
            ? { email: currentUser.email }
            : { isActive: true, authVersion: 2, orgId, role: 'admin' }
        }
      }
      return query
    })
    const rotate = vi.spyOn(User, 'findOneAndUpdate').mockReturnValue({
      select: () => ({ exec: async () => rotatedUser })
    } as any)
    vi.spyOn(Employee, 'findOne').mockResolvedValue(null)
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)
    vi.spyOn(Organization, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ isActive: true, settings: {} }) })
    } as any)
    const oldAccessToken = generateAccessToken({
      userId,
      orgId,
      role: 'admin',
      authVersion: 2,
      authMethod: 'password',
      authTime: Math.floor(Date.now() / 1000)
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/password',
      headers: { authorization: `Bearer ${oldAccessToken}` },
      payload: { currentPassword: 'OldPassword123', newPassword: 'NewPassword123' }
    })

    expect(response.statusCode).toBe(200)
    expect(rotate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: userId, authVersion: 2 }),
      expect.objectContaining({
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      }),
      { new: true }
    )
    const body = response.json()
    expect(body.accessToken).toBeTypeOf('string')
    expect(body.refreshToken).toBeTypeOf('string')
    expect(verifyAccessToken(body.accessToken).authVersion).toBe(3)
  })
})
