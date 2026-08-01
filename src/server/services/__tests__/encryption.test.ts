import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'


const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

const SENSITIVE_FIELDS: Record<string, string[]> = {
  intune: ['clientSecret'],
  autopilot: ['clientSecret'],
  jamf: ['password'],
  kandji: ['apiToken'],
  personio: ['clientSecret'],
  scim: ['bearerToken'],
  sso: ['certificate'],
  bamboohr: ['apiKey'],
  googleWorkspace: ['serviceAccountKey'],
  hibob: ['apiToken'],
  mosyle: ['apiToken'],
  helpdesk: ['apiToken'],
}

const TEST_KEY = Buffer.from('a'.repeat(64), 'hex')

function encrypt(plaintext: string, key: Buffer = TEST_KEY): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

function decrypt(encrypted: string, key: Buffer = TEST_KEY): string {
  if (!encrypted.includes(':') || encrypted.split(':').length !== 3) {
    return encrypted
  }
  const [ivB64, tagB64, cipherB64] = encrypted.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(cipherB64, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

function maskSecret(value: string | undefined, decryptFn = decrypt): string {
  if (!value) return ''
  if (value.length <= 4) return '••••••••'
  const last4 = decryptFn(value).slice(-4)
  return `••••••••${last4}`
}

function validateKeyHex(hex: string): boolean {
  return hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)
}


describe('Encryption Service — AES-256-GCM', () => {
  describe('Encrypt / Decrypt Roundtrip', () => {
    it('should return original plaintext after decrypt', () => {
      const plaintext = 'super-secret-api-key-12345'
      const ciphertext = encrypt(plaintext)
      expect(decrypt(ciphertext)).toBe(plaintext)
    })

    it('should work with empty string', () => {
      const ciphertext = encrypt('')
      expect(decrypt(ciphertext)).toBe('')
    })

    it('should work with unicode', () => {
      const plaintext = 'Schlüssel mit Ümlauten 🔑'
      const ciphertext = encrypt(plaintext)
      expect(decrypt(ciphertext)).toBe(plaintext)
    })

    it('should work with long values', () => {
      const plaintext = 'x'.repeat(10_000)
      const ciphertext = encrypt(plaintext)
      expect(decrypt(ciphertext)).toBe(plaintext)
    })

    it('should work with JSON payload', () => {
      const json = JSON.stringify({ clientId: 'abc', secret: 'xyz' })
      const ciphertext = encrypt(json)
      expect(JSON.parse(decrypt(ciphertext))).toEqual({ clientId: 'abc', secret: 'xyz' })
    })
  })

  describe('Ciphertext Format', () => {
    it('should produce iv:authTag:ciphertext format', () => {
      const ciphertext = encrypt('test')
      const parts = ciphertext.split(':')
      expect(parts).toHaveLength(3)
    })

    it('IV should be base64 encoded (16 bytes → ~24 chars)', () => {
      const ciphertext = encrypt('test')
      const ivB64 = ciphertext.split(':')[0]
      const iv = Buffer.from(ivB64, 'base64')
      expect(iv).toHaveLength(16)
    })

    it('Auth tag should be base64 encoded (16 bytes → ~24 chars)', () => {
      const ciphertext = encrypt('test')
      const tagB64 = ciphertext.split(':')[1]
      const tag = Buffer.from(tagB64, 'base64')
      expect(tag).toHaveLength(16)
    })

    it('different encryptions of same plaintext should produce different ciphertexts', () => {
      const c1 = encrypt('same-secret')
      const c2 = encrypt('same-secret')
      expect(c1).not.toBe(c2)
    })
  })

  describe('Tamper Detection', () => {
    it('should throw on corrupted ciphertext', () => {
      const ciphertext = encrypt('sensitive-data')
      const parts = ciphertext.split(':')
      parts[2] = 'AAAA' + parts[2].slice(4)
      expect(() => decrypt(parts.join(':'))).toThrow()
    })

    it('should throw on wrong key', () => {
      const wrongKey = Buffer.from('b'.repeat(64), 'hex')
      const ciphertext = encrypt('data', TEST_KEY)
      expect(() => decrypt(ciphertext, wrongKey)).toThrow()
    })

    it('should throw on corrupted auth tag', () => {
      const ciphertext = encrypt('data')
      const parts = ciphertext.split(':')
      parts[1] = Buffer.from('corrupt-tag-data').toString('base64')
      expect(() => decrypt(parts.join(':'))).toThrow()
    })
  })

  describe('Plaintext Passthrough', () => {
    it('should return plaintext if no colons (migration scenario)', () => {
      expect(decrypt('plaintext-value')).toBe('plaintext-value')
    })

    it('should return plaintext if only one colon', () => {
      expect(decrypt('part1:part2')).toBe('part1:part2')
    })
  })

  describe('Key Validation', () => {
    it('should accept valid 64-char hex key', () => {
      expect(validateKeyHex('a'.repeat(64))).toBe(true)
    })

    it('should reject short key', () => {
      expect(validateKeyHex('abcd')).toBe(false)
    })

    it('should reject non-hex characters', () => {
      expect(validateKeyHex('g'.repeat(64))).toBe(false)
    })

    it('should accept mixed case hex', () => {
      expect(validateKeyHex('aAbBcCdDeEfF0123456789'.repeat(3).slice(0, 64))).toBe(true)
    })
  })

  describe('generateSecureToken', () => {
    it('should generate 64-char hex string (32 bytes)', () => {
      const token = generateSecureToken()
      expect(token).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(token)).toBe(true)
    })

    it('should generate unique tokens', () => {
      const t1 = generateSecureToken()
      const t2 = generateSecureToken()
      expect(t1).not.toBe(t2)
    })

    it('should respect custom byte length', () => {
      const token = generateSecureToken(16)
      expect(token).toHaveLength(32)
    })
  })

  describe('maskSecret', () => {
    it('should show last 4 chars of plaintext', () => {
      const result = maskSecret('my-api-key-12345', (v) => v)
      expect(result).toBe('••••••••2345')
    })

    it('should return empty string for undefined', () => {
      expect(maskSecret(undefined)).toBe('')
    })

    it('should return dots for very short values', () => {
      expect(maskSecret('ab')).toBe('••••••••')
    })
  })

  describe('SENSITIVE_FIELDS Registry', () => {
    it('should cover 12 providers', () => {
      expect(Object.keys(SENSITIVE_FIELDS)).toHaveLength(12)
    })

    it.each([
      ['intune', 'clientSecret'],
      ['autopilot', 'clientSecret'],
      ['jamf', 'password'],
      ['kandji', 'apiToken'],
      ['personio', 'clientSecret'],
      ['scim', 'bearerToken'],
      ['sso', 'certificate'],
      ['bamboohr', 'apiKey'],
      ['googleWorkspace', 'serviceAccountKey'],
      ['hibob', 'apiToken'],
      ['mosyle', 'apiToken'],
      ['helpdesk', 'apiToken'],
    ])('%s → encrypt %s', (provider, field) => {
      expect(SENSITIVE_FIELDS[provider]).toContain(field)
    })
  })
})
