import { describe, expect, it } from 'vitest'
import { User } from '../User'
import { AuthChallenge } from '../AuthChallenge'

describe('User authentication security fields', () => {
  it('excludes authentication secrets and credentials from normal queries', () => {
    for (const field of [
      'hashedPassword',
      'authVersion',
      'passkeys',
      'totpSecretEncrypted',
      'totpPendingSecretEncrypted',
      'totpPendingExpiresAt',
      'totpLastUsedStep',
      'recoveryCodeHashes'
    ]) {
      expect(User.schema.path(field).options.select, `${field} must be hidden`).toBe(false)
    }
  })

  it('never serializes authentication secrets even when explicitly present', () => {
    const user = new User({
      email: 'security@example.com',
      firstName: 'Security',
      lastName: 'Tester',
      companyName: 'Example',
      hashedPassword: 'hidden'
    })
    expect(user.totpEnabled).toBe(false)
    expect(user.authVersion).toBe(0)
    expect(user.passkeys).toEqual([])
    expect(user.recoveryCodeHashes).toEqual([])

    user.totpSecretEncrypted = 'ciphertext'
    user.recoveryCodeHashes = ['hash']
    user.passkeys = [{ credentialId: 'credential', publicKey: Buffer.from('key') }] as any
    const json = user.toJSON() as Record<string, unknown>
    expect(json).not.toHaveProperty('hashedPassword')
    expect(json).not.toHaveProperty('authVersion')
    expect(json).not.toHaveProperty('totpSecretEncrypted')
    expect(json).not.toHaveProperty('totpPendingExpiresAt')
    expect(json).not.toHaveProperty('recoveryCodeHashes')
    expect(json).not.toHaveProperty('passkeys')
    const object = user.toObject() as Record<string, unknown>
    expect(object).not.toHaveProperty('hashedPassword')
    expect(object).not.toHaveProperty('authVersion')
    expect(object).not.toHaveProperty('totpSecretEncrypted')
    expect(object).not.toHaveProperty('recoveryCodeHashes')
    expect(object).not.toHaveProperty('passkeys')
  })

  it('expires abandoned one-time authentication ceremonies through a TTL index', () => {
    const ttlIndex = AuthChallenge.schema.indexes().find(([fields]) => fields.expiresAt === 1)
    expect(ttlIndex?.[1]).toMatchObject({ expireAfterSeconds: 0 })
  })
})
