import { beforeEach, describe, expect, it, vi } from 'vitest'
import { User, type IUser } from '../../../models/User'
import { encodeBase32, generateTotp } from '../authSecurity'
import { confirmMfaStepUp, hasRecentStrongAuthentication } from '../authStepUp'

describe('authentication step-up', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('recognizes only recent strong authentication methods', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(hasRecentStrongAuthentication({
      userId: 'u1', orgId: 'o1', role: 'admin', authMethod: 'totp', authTime: now
    })).toBe(true)
    expect(hasRecentStrongAuthentication({
      userId: 'u1', orgId: 'o1', role: 'admin', authMethod: 'password', authTime: now
    })).toBe(false)
    expect(hasRecentStrongAuthentication({
      userId: 'u1', orgId: 'o1', role: 'admin', authMethod: 'passkey', authTime: now - 601
    })).toBe(false)
  })

  it('does not demand a second factor when TOTP is not enabled', async () => {
    await expect(confirmMfaStepUp({ totpEnabled: false } as IUser, undefined))
      .resolves.toBe(true)
  })

  it('atomically claims a TOTP step when the session is no longer recent', async () => {
    const secret = encodeBase32(Buffer.alloc(20, 11))
    const step = Math.floor(Date.now() / 1000 / 30)
    const code = generateTotp(secret, step)
    const updateSpy = vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any)
    const user = {
      _id: '507f1f77bcf86cd799439011',
      totpEnabled: true,
      totpSecretEncrypted: secret,
      totpLastUsedStep: step - 1
    } as IUser

    await expect(confirmMfaStepUp(user, {
      userId: 'u1', orgId: 'o1', role: 'admin', authMethod: 'password', authTime: step * 30
    }, code)).resolves.toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      _id: user._id,
      totpEnabled: true,
      $or: expect.any(Array)
    }), { $set: { totpLastUsedStep: step } })
  })

  it('rejects an invalid or concurrently claimed TOTP step', async () => {
    const secret = encodeBase32(Buffer.alloc(20, 13))
    const step = Math.floor(Date.now() / 1000 / 30)
    const code = generateTotp(secret, step)
    vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as any)
    const user = {
      _id: '507f1f77bcf86cd799439011',
      totpEnabled: true,
      totpSecretEncrypted: secret,
      totpLastUsedStep: step - 1
    } as IUser

    await expect(confirmMfaStepUp(user, undefined, '000000')).resolves.toBe(false)
    await expect(confirmMfaStepUp(user, undefined, code)).resolves.toBe(false)
  })
})
