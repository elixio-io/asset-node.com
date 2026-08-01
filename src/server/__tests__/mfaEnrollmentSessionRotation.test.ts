import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuditLog } from '../../models/AuditLog'
import { Employee } from '../../models/Employee'
import { User } from '../../models/User'
import { Organization } from '../../models/Organization'

vi.stubEnv('JWT_SECRET', 'mfa-enrollment-access-secret-with-32-chars')
vi.stubEnv('JWT_REFRESH_SECRET', 'mfa-enrollment-refresh-secret-with-32-chars')
vi.stubEnv('ENCRYPTION_KEY', '11'.repeat(32))

const { default: authSecurityRoutes } = await import('../routes/authSecurity')
const { generateAccessToken, verifyAccessToken } = await import('../middleware/auth')
const { encrypt } = await import('../services/encryption')
const { encodeBase32, generateTotp } = await import('../services/authSecurity')

describe('TOTP enrollment session rotation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('increments authVersion atomically and issues only the replacement version', async () => {
    const app = Fastify({ logger: false })
    await app.register(authSecurityRoutes)
    await app.ready()

    const userId = '507f1f77bcf86cd799439011'
    const orgId = '507f1f77bcf86cd799439012'
    const secret = encodeBase32(Buffer.alloc(20, 9))
    const pendingSecret = encrypt(secret)
    const code = generateTotp(secret, Math.floor(Date.now() / 30_000))
    const pendingUser: any = {
      _id: userId,
      orgId,
      isActive: true,
      authVersion: 7,
      totpEnabled: false,
      totpPendingSecretEncrypted: pendingSecret,
      totpPendingExpiresAt: new Date(Date.now() + 60_000)
    }
    const enrolledUser: any = {
      ...pendingUser,
      email: 'user@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      fullName: 'Grace Hopper',
      companyName: 'Example',
      role: 'admin',
      permissions: [],
      onboardingCompleted: true,
      authVersion: 8,
      totpEnabled: true,
      save: vi.fn().mockResolvedValue(undefined)
    }
    vi.spyOn(User, 'findById').mockImplementation(() => {
      const query: any = {}
      query.select = (selection: string) => {
        if (selection.includes('totpPendingSecretEncrypted')) return { exec: async () => pendingUser }
        return {
          lean: async () => selection.includes('email')
            ? { email: enrolledUser.email }
            : { isActive: true, authVersion: 7, orgId, role: 'admin' }
        }
      }
      return query
    })
    const enroll = vi.spyOn(User, 'findOneAndUpdate').mockReturnValue({
      select: () => ({ exec: async () => enrolledUser })
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
      authVersion: 7,
      authMethod: 'password',
      authTime: Math.floor(Date.now() / 1000)
    })

    const response = await app.inject({
      method: 'POST',
      url: '/mfa/confirm',
      headers: { authorization: `Bearer ${oldAccessToken}` },
      payload: { code }
    })

    await app.close()
    expect(response.statusCode).toBe(200)
    expect(enroll).toHaveBeenCalledWith(
      expect.objectContaining({ _id: userId }),
      expect.objectContaining({ $inc: { authVersion: 1 } }),
      { new: true }
    )
    const body = response.json()
    expect(verifyAccessToken(body.accessToken).authVersion).toBe(8)
    expect(body.refreshToken).toBeTypeOf('string')
  })

  it('revokes parallel sessions when TOTP is disabled and replaces the current session', async () => {
    const app = Fastify({ logger: false })
    await app.register(authSecurityRoutes)
    await app.ready()

    const userId = '507f1f77bcf86cd799439021'
    const orgId = '507f1f77bcf86cd799439022'
    const secret = encodeBase32(Buffer.alloc(20, 5))
    const encryptedSecret = encrypt(secret)
    const code = generateTotp(secret, Math.floor(Date.now() / 30_000))
    const currentUser: any = {
      _id: userId,
      orgId,
      email: 'admin@example.com',
      firstName: 'Katherine',
      lastName: 'Johnson',
      fullName: 'Katherine Johnson',
      companyName: 'Example',
      role: 'admin',
      permissions: [],
      onboardingCompleted: true,
      isActive: true,
      authVersion: 3,
      totpEnabled: true,
      totpSecretEncrypted: encryptedSecret,
      validatePassword: vi.fn().mockResolvedValue(true)
    }
    const disabledUser: any = {
      ...currentUser,
      authVersion: 4,
      totpEnabled: false,
      save: vi.fn().mockResolvedValue(undefined)
    }
    vi.spyOn(User, 'findById').mockImplementation(() => {
      const query: any = {}
      query.select = (selection: string) => {
        if (selection.includes('totpSecretEncrypted')) return { exec: async () => currentUser }
        return {
          lean: async () => selection.includes('email')
            ? { email: currentUser.email }
            : { isActive: true, authVersion: 3, orgId, role: 'admin' }
        }
      }
      return query
    })
    const disable = vi.spyOn(User, 'findOneAndUpdate').mockReturnValue({
      select: () => ({ exec: async () => disabledUser })
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
      authVersion: 3,
      authMethod: 'totp',
      authTime: Math.floor(Date.now() / 1000)
    })

    const response = await app.inject({
      method: 'POST',
      url: '/mfa/disable',
      headers: { authorization: `Bearer ${oldAccessToken}` },
      payload: { currentPassword: 'CorrectPassword123', code }
    })

    await app.close()
    expect(response.statusCode).toBe(200)
    expect(disable).toHaveBeenCalledWith(
      expect.objectContaining({ _id: userId, totpEnabled: true }),
      expect.objectContaining({
        $inc: { authVersion: 1 },
        $unset: expect.objectContaining({ refreshToken: 1, totpSecretEncrypted: 1 })
      }),
      { new: true }
    )
    const body = response.json()
    expect(verifyAccessToken(body.accessToken).authVersion).toBe(4)
    expect(body.refreshToken).toBeTypeOf('string')
  })
})
