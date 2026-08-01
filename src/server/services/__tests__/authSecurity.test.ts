import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthChallenge } from '../../../models/AuthChallenge'
import {
  consumeSecurityChallenge,
  createSecurityChallenge,
  decodeBase32,
  encodeBase32,
  generateRecoveryCodes,
  generateTotp,
  hashRecoveryCode,
  normalizeRecoveryCode,
  signSecurityChallenge,
  verifySecurityChallenge,
  verifyTotp
} from '../authSecurity'

describe('auth security primitives', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.JWT_SECRET = 'test-signing-secret-with-sufficient-entropy'
    process.env.MFA_RECOVERY_PEPPER = 'test-recovery-pepper-with-sufficient-entropy'
  })

  it('round-trips RFC 4648 base32 values', () => {
    const input = Buffer.from('AssetNode passkey and MFA')
    expect(decodeBase32(encodeBase32(input))).toEqual(input)
  })

  it('matches the RFC 6238 SHA-1 vector with six digits', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(generateTotp(secret, 1)).toBe('287082')
    expect(verifyTotp(secret, '287082', 59_000, 0)).toBe(1)
  })

  it('accepts only a bounded TOTP clock window', () => {
    const secret = encodeBase32(Buffer.alloc(20, 7))
    const currentStep = 1_700_000_000
    const now = currentStep * 30 * 1000
    expect(verifyTotp(secret, generateTotp(secret, currentStep - 1), now)).toBe(currentStep - 1)
    expect(verifyTotp(secret, generateTotp(secret, currentStep + 1), now)).toBe(currentStep + 1)
    expect(verifyTotp(secret, generateTotp(secret, currentStep + 2), now)).toBeNull()
    expect(verifyTotp(secret, 'not-a-code', now)).toBeNull()
  })

  it('creates unique, user-friendly recovery codes and hashes normalized input', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)

    expect(normalizeRecoveryCode('abcd-2345-efgh')).toBe('ABCD2345EFGH')
    expect(hashRecoveryCode('ABCD-2345-EFGH')).toBe(hashRecoveryCode('abcd 2345 efgh'))
    expect(hashRecoveryCode('ABCD-2345-EFGH')).not.toBe(hashRecoveryCode('WXYZ-2345-EFGH'))
  })

  it('signs short-lived challenges for one explicit ceremony purpose', () => {
    const token = signSecurityChallenge({
      purpose: 'passkey-registration',
      challenge: 'random-challenge',
      userId: 'user-1',
      tokenId: 'one-time-token-id'
    })
    expect(verifySecurityChallenge(token, 'passkey-registration')).toMatchObject({
      purpose: 'passkey-registration',
      challenge: 'random-challenge',
      userId: 'user-1'
    })
    expect(() => verifySecurityChallenge(token, 'passkey-login')).toThrow('purpose mismatch')
  })

  it('persists and atomically consumes each ceremony exactly once', async () => {
    const createSpy = vi.spyOn(AuthChallenge, 'create').mockResolvedValue({} as any)
    const deleteSpy = vi.spyOn(AuthChallenge, 'findOneAndDelete')
      .mockResolvedValueOnce({ tokenId: 'claimed' } as any)
      .mockResolvedValueOnce(null as any)

    const token = await createSecurityChallenge({
      purpose: 'passkey-login',
      challenge: 'challenge-value'
    })
    const payload = verifySecurityChallenge(token, 'passkey-login')
    expect(payload.tokenId).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      tokenId: payload.tokenId,
      purpose: 'passkey-login',
      expiresAt: expect.any(Date)
    }))

    await expect(consumeSecurityChallenge(token, 'passkey-login')).resolves.toMatchObject({
      tokenId: payload.tokenId
    })
    await expect(consumeSecurityChallenge(token, 'passkey-login'))
      .rejects.toThrow('already used or expired')
    expect(deleteSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tokenId: payload.tokenId,
      purpose: 'passkey-login',
      expiresAt: { $gt: expect.any(Date) }
    }))
  })
})
