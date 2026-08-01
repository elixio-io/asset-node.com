import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'



describe('Encryption Service', () => {
  const VALID_HEX_KEY = 'a'.repeat(64)

  describe('with encryption key set', () => {
    beforeEach(() => {
      vi.stubEnv('ENCRYPTION_KEY', VALID_HEX_KEY)
      vi.stubEnv('NODE_ENV', 'test')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should encrypt and decrypt a secret correctly (roundtrip)', async () => {
      const { encrypt, decrypt } = await import('../../server/services/encryption')
      const secret = 'my-api-token-12345'
      const encrypted = encrypt(secret)
      expect(encrypted).not.toBe(secret)
      expect(encrypted).toContain(':')
      expect(encrypted.split(':')).toHaveLength(3)

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(secret)
    })

    it('should produce different ciphertexts for the same plaintext (random IV)', async () => {
      const { encrypt } = await import('../../server/services/encryption')
      const secret = 'same-secret'
      const enc1 = encrypt(secret)
      const enc2 = encrypt(secret)
      expect(enc1).not.toBe(enc2)
    })

    it('should handle empty string encryption', async () => {
      const { encrypt, decrypt } = await import('../../server/services/encryption')
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should handle unicode / special characters', async () => {
      const { encrypt, decrypt } = await import('../../server/services/encryption')
      const secret = 'pässwörd with émojis 🔑🗝️'
      const encrypted = encrypt(secret)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(secret)
    })

    it('should handle very long secrets', async () => {
      const { encrypt, decrypt } = await import('../../server/services/encryption')
      const secret = 'x'.repeat(10000)
      const encrypted = encrypt(secret)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(secret)
    })

    it('should reject tampered ciphertext (auth tag check)', async () => {
      const { encrypt, decrypt } = await import('../../server/services/encryption')
      const encrypted = encrypt('secret')
      const parts = encrypted.split(':')
      parts[2] = parts[2].slice(0, -3) + 'XXX'
      const tampered = parts.join(':')

      expect(() => decrypt(tampered)).toThrow('Failed to decrypt credential')
    })

    it('should return plaintext as-is for non-encrypted values (migration)', async () => {
      const { decrypt } = await import('../../server/services/encryption')
      const plaintext = 'just-a-plain-token-no-colons'
      expect(decrypt(plaintext)).toBe(plaintext)
    })

    it('should not mistake a plaintext token containing two colons for ciphertext', async () => {
      const { decrypt, encryptSensitiveFields } = await import('../../server/services/encryption')
      const plaintext = 'tenant:agent:api-token'
      expect(decrypt(plaintext)).toBe(plaintext)

      const encrypted = encryptSensitiveFields('helpdesk', { apiToken: plaintext }).apiToken as string
      expect(encrypted).not.toBe(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })

    it('should report encryption as enabled', async () => {
      const { isEncryptionEnabled } = await import('../../server/services/encryption')
      expect(isEncryptionEnabled()).toBe(true)
    })

    it('generateSecureToken should return hex strings of correct length', async () => {
      const { generateSecureToken } = await import('../../server/services/encryption')
      const token = generateSecureToken(32)
      expect(token).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(token)).toBe(true)
    })

    it('generateSecureToken should produce unique tokens', async () => {
      const { generateSecureToken } = await import('../../server/services/encryption')
      const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()))
      expect(tokens.size).toBe(100)
    })
  })

  describe('without encryption key (dev passthrough)', () => {
    beforeEach(() => {
      vi.stubEnv('ENCRYPTION_KEY', '')
      vi.stubEnv('NODE_ENV', 'development')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should return plaintext in dev mode when no key is set', async () => {
      const { encrypt } = await import('../../server/services/encryption')
      const secret = 'dev-secret'
      expect(encrypt(secret)).toBe(secret)
    })

    it('should report encryption as disabled', async () => {
      const { isEncryptionEnabled } = await import('../../server/services/encryption')
      expect(isEncryptionEnabled()).toBe(false)
    })
  })

  describe('key validation', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should reject a key that is too short', async () => {
      vi.stubEnv('ENCRYPTION_KEY', 'abcd1234')
      vi.stubEnv('NODE_ENV', 'test')
      vi.resetModules()
      const { encrypt } = await import('../../server/services/encryption')
      expect(() => encrypt('test')).toThrow('64-character hex string')
    })

    it('should reject a key with non-hex characters', async () => {
      vi.stubEnv('ENCRYPTION_KEY', 'g'.repeat(64))
      vi.stubEnv('NODE_ENV', 'test')
      vi.resetModules()
      const { encrypt } = await import('../../server/services/encryption')
      expect(() => encrypt('test')).toThrow('64-character hex string')
    })
  })

  describe('SENSITIVE_FIELDS configuration', () => {
    it('should define sensitive fields for all integration providers', async () => {
      const { SENSITIVE_FIELDS } = await import('../../server/services/encryption')
      const providers = ['intune', 'autopilot', 'jamf', 'kandji', 'personio', 'scim', 'sso', 'bamboohr', 'googleWorkspace', 'hibob', 'mosyle', 'helpdesk']
      providers.forEach(p => {
        expect(SENSITIVE_FIELDS[p], `Missing field config for ${p}`).toBeDefined()
        expect(SENSITIVE_FIELDS[p].length, `Empty fields for ${p}`).toBeGreaterThan(0)
      })
    })

    it('should not list non-secret fields', async () => {
      const { SENSITIVE_FIELDS } = await import('../../server/services/encryption')
      Object.entries(SENSITIVE_FIELDS).forEach(([provider, fields]) => {
        fields.forEach(field => {
          expect(['name', 'url', 'email', 'enabled']).not.toContain(field)
        })
      })
    })
  })
})
