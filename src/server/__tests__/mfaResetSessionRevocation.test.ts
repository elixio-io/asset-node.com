import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuditLog } from '../../models/AuditLog'
import { User } from '../../models/User'
import { Organization } from '../../models/Organization'

vi.stubEnv('JWT_SECRET', 'mfa-reset-access-secret-with-32-chars')
vi.stubEnv('JWT_REFRESH_SECRET', 'mfa-reset-refresh-secret-with-32-chars')

const { generateAccessToken } = await import('../middleware/auth')
const { default: authSecurityRoutes } = await import('../routes/authSecurity')
const { default: superAdminUserRoutes } = await import('../routes/superAdmin/users')

describe('MFA reset session revocation', () => {
  const actorId = '507f1f77bcf86cd799439011'
  const targetId = '507f1f77bcf86cd799439012'
  const orgId = '507f1f77bcf86cd799439013'
  let app: FastifyInstance | undefined

  afterEach(async () => {
    vi.restoreAllMocks()
    await app?.close()
    app = undefined
  })

  function mockAuditDependencies() {
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)
  }

  function mockActor(role: 'admin' | 'superAdmin') {
    const actor = {
      _id: actorId,
      orgId,
      role,
      isActive: true,
      ssoOnly: false,
      totpEnabled: false,
      validatePassword: vi.fn().mockResolvedValue(true)
    }
    const query: any = { select: () => query, exec: async () => actor }
    vi.spyOn(User, 'findOne').mockReturnValue(query)
    return actor
  }

  function mockResetTarget() {
    const target = { _id: targetId, orgId, role: 'employee', isActive: true }
    const query: any = { exec: async () => target }
    return vi.spyOn(User, 'findOneAndUpdate').mockReturnValue(query)
  }

  it('organization-admin reset increments the target auth version', async () => {
    app = Fastify({ logger: false })
    await app.register(authSecurityRoutes)
    await app.ready()

    const token = generateAccessToken({
      userId: actorId,
      orgId,
      role: 'admin',
      authVersion: 0,
      authMethod: 'password',
      authTime: Math.floor(Date.now() / 1000)
    })
    const findById = vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: (selection: string) => ({
        lean: async () => selection.includes('email')
          ? { email: 'admin@example.com' }
          : { isActive: true, authVersion: 0, orgId, role: 'admin' }
      })
    }) as any)
    vi.spyOn(Organization, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ isActive: true }) })
    } as any)
    mockActor('admin')
    const reset = mockResetTarget()
    mockAuditDependencies()

    const response = await app.inject({
      method: 'POST',
      url: `/admin/users/${targetId}/mfa/reset`,
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'correct-password' }
    })

    expect(response.statusCode).toBe(200)
    expect(reset).toHaveBeenCalledWith(
      expect.objectContaining({ _id: targetId, orgId }),
      expect.objectContaining({ $inc: { authVersion: 1 } }),
      { new: true }
    )
    expect(findById).toHaveBeenCalled()
    expect(response.json().message).toContain('revoked immediately')
  })

  it('super-admin reset increments the target auth version', async () => {
    app = Fastify({ logger: false })
    app.addHook('preHandler', async (request) => {
      request.user = {
        userId: actorId,
        orgId: '',
        role: 'superAdmin',
        authVersion: 0,
        authMethod: 'password',
        authTime: Math.floor(Date.now() / 1000)
      }
    })
    await app.register(superAdminUserRoutes)
    await app.ready()

    mockActor('superAdmin')
    const reset = mockResetTarget()
    vi.spyOn(User, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ email: 'root@example.com' }) })
    } as any)
    mockAuditDependencies()

    const response = await app.inject({
      method: 'POST',
      url: `/users/${targetId}/mfa/reset`,
      payload: { currentPassword: 'correct-password' }
    })

    expect(response.statusCode).toBe(200)
    expect(reset).toHaveBeenCalledWith(
      expect.objectContaining({ _id: targetId, role: { $ne: 'superAdmin' } }),
      expect.objectContaining({ $inc: { authVersion: 1 } }),
      { new: true }
    )
    expect(response.json().message).toContain('revoked immediately')
  })

  it('role changes increment authVersion and revoke the target refresh token', async () => {
    app = Fastify({ logger: false })
    app.addHook('preHandler', async (request) => {
      request.user = {
        userId: actorId,
        orgId: '',
        role: 'superAdmin',
        authVersion: 0
      }
    })
    await app.register(superAdminUserRoutes)
    await app.ready()

    const target: any = {
      _id: targetId,
      email: 'employee@example.com',
      role: 'employee',
      authVersion: 5
    }
    vi.spyOn(User, 'findById').mockReturnValue({
      select: () => ({ exec: async () => target })
    } as any)
    const roleUpdate = vi.spyOn(User, 'findOneAndUpdate').mockReturnValue({
      exec: async () => ({ ...target, role: 'manager', authVersion: 6 })
    } as any)

    const response = await app.inject({
      method: 'PATCH',
      url: `/users/${targetId}/role`,
      payload: { role: 'manager' }
    })

    expect(response.statusCode).toBe(200)
    expect(roleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: targetId, role: 'employee', authVersion: 5 }),
      expect.objectContaining({
        $set: { role: 'manager' },
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      }),
      { new: true }
    )
    expect(response.json().role).toBe('manager')
  })

  it('reactivation increments authVersion so pre-deactivation sessions stay revoked', async () => {
    app = Fastify({ logger: false })
    app.addHook('preHandler', async (request) => {
      request.user = { userId: actorId, orgId: '', role: 'superAdmin', authVersion: 0 }
    })
    await app.register(superAdminUserRoutes)
    await app.ready()

    const target: any = {
      _id: targetId,
      email: 'employee@example.com',
      role: 'employee',
      isActive: false,
      authVersion: 6
    }
    vi.spyOn(User, 'findById').mockReturnValue({
      select: () => ({ exec: async () => target })
    } as any)
    const statusUpdate = vi.spyOn(User, 'findOneAndUpdate').mockReturnValue({
      exec: async () => ({ ...target, isActive: true, authVersion: 7 })
    } as any)

    const response = await app.inject({
      method: 'PATCH',
      url: `/users/${targetId}/active`,
      payload: { isActive: true }
    })

    expect(response.statusCode).toBe(200)
    expect(statusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: targetId, isActive: false, authVersion: 6 }),
      expect.objectContaining({
        $set: { isActive: true },
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      }),
      { new: true }
    )
    expect(response.json().isActive).toBe(true)
  })
})
