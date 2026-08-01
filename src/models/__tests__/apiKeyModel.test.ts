import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `hm_${crypto.randomBytes(24).toString('base64url')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 11)
  return { rawKey, keyHash, keyPrefix }
}

function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const computed = crypto.createHash('sha256').update(rawKey).digest('hex')
  return computed === storedHash
}


describe('ApiKey Model — Key Generation & Hashing', () => {
  describe('Key Generation', () => {
    it('rawKey should start with "hm_"', () => {
      const { rawKey } = generateApiKey()
      expect(rawKey).toMatch(/^hm_/)
    })

    it('rawKey should be at least 35 chars (hm_ + 32 base64url)', () => {
      const { rawKey } = generateApiKey()
      expect(rawKey.length).toBeGreaterThanOrEqual(35)
    })

    it('keyHash should be 64-char hex (SHA-256)', () => {
      const { keyHash } = generateApiKey()
      expect(keyHash).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(keyHash)).toBe(true)
    })

    it('keyPrefix should be first 11 chars of rawKey', () => {
      const { rawKey, keyPrefix } = generateApiKey()
      expect(keyPrefix).toBe(rawKey.slice(0, 11))
      expect(keyPrefix).toMatch(/^hm_/)
    })

    it('keyPrefix should be 11 chars (hm_ + 8)', () => {
      const { keyPrefix } = generateApiKey()
      expect(keyPrefix).toHaveLength(11)
    })

    it('each call should produce unique key', () => {
      const k1 = generateApiKey()
      const k2 = generateApiKey()
      expect(k1.rawKey).not.toBe(k2.rawKey)
      expect(k1.keyHash).not.toBe(k2.keyHash)
    })
  })

  describe('Key Verification', () => {
    it('should verify correct key against hash', () => {
      const { rawKey, keyHash } = generateApiKey()
      expect(verifyApiKey(rawKey, keyHash)).toBe(true)
    })

    it('should reject wrong key', () => {
      const { keyHash } = generateApiKey()
      expect(verifyApiKey('hm_wrong-key-data', keyHash)).toBe(false)
    })

    it('should reject empty key', () => {
      const { keyHash } = generateApiKey()
      expect(verifyApiKey('', keyHash)).toBe(false)
    })
  })

  describe('Security Properties', () => {
    it('hash should not contain rawKey', () => {
      const { rawKey, keyHash } = generateApiKey()
      expect(keyHash).not.toContain(rawKey)
    })

    it('rawKey should use base64url (no +/= chars)', () => {
      const { rawKey } = generateApiKey()
      const suffix = rawKey.slice(3)
      expect(suffix).not.toMatch(/[+/=]/)
    })

    it('hash should be deterministic for same key', () => {
      const rawKey = 'hm_test-key-12345'
      const h1 = crypto.createHash('sha256').update(rawKey).digest('hex')
      const h2 = crypto.createHash('sha256').update(rawKey).digest('hex')
      expect(h1).toBe(h2)
    })
  })
})
