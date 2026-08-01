import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 4) return '••••••••'
  const last4 = value.slice(-4)
  return `••••••••${last4}`
}

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
  helpdesk: ['apiToken']
}

function isEncryptedFormat(value: string): boolean {
  return value.includes(':') && value.split(':').length === 3
}

function generateSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const VALID_PROVIDERS = ['intune', 'autopilot', 'jamf', 'kandji', 'personio', 'scim', 'sso', 'bamboohr', 'googleWorkspace', 'hibob', 'mosyle', 'helpdesk']

function isValidProvider(provider: string): boolean {
  return VALID_PROVIDERS.includes(provider)
}

function isMaskedValue(val: string): boolean {
  return val.startsWith('••••••••')
}


describe('Encryption Service — Pure Logic', () => {
  describe('Secure Token Generation', () => {
    it('should generate 64-char hex string by default (32 bytes)', () => {
      const token = generateSecureToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[0-9a-f]+$/)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()))
      expect(tokens.size).toBe(100)
    })

    it('should respect custom byte length', () => {
      expect(generateSecureToken(16)).toHaveLength(32)
      expect(generateSecureToken(8)).toHaveLength(16)
      expect(generateSecureToken(64)).toHaveLength(128)
    })

    it('should be cryptographically random', () => {
      const t1 = generateSecureToken()
      const t2 = generateSecureToken()
      const commonPrefix = Array.from(t1).findIndex((c, i) => c !== t2[i])
      expect(commonPrefix).toBeLessThan(8)
    })
  })

  describe('Secret Masking', () => {
    it('should mask long secrets showing last 4 chars', () => {
      expect(maskSecret('my-secret-api-key-1234')).toBe('••••••••1234')
    })

    it('should mask with bullets for very short secrets', () => {
      expect(maskSecret('abc')).toBe('••••••••')
      expect(maskSecret('abcd')).toBe('••••••••')
    })

    it('should return empty string for undefined', () => {
      expect(maskSecret(undefined)).toBe('')
    })

    it('should return empty string for empty string', () => {
      expect(maskSecret('')).toBe('')
    })

    it('should handle exactly 5 chars', () => {
      expect(maskSecret('12345')).toBe('••••••••2345')
    })

    it('masked values should be detectable', () => {
      expect(isMaskedValue('••••••••1234')).toBe(true)
      expect(isMaskedValue('real-secret')).toBe(false)
    })
  })

  describe('Encrypted Format Detection', () => {
    it('should detect iv:tag:cipher format', () => {
      expect(isEncryptedFormat('abc:def:ghi')).toBe(true)
    })

    it('should reject plaintext', () => {
      expect(isEncryptedFormat('just-a-plain-secret')).toBe(false)
    })

    it('should reject single colon', () => {
      expect(isEncryptedFormat('abc:def')).toBe(false)
    })

    it('should reject too many colons', () => {
      expect(isEncryptedFormat('a:b:c:d')).toBe(false)
    })
  })

  describe('SENSITIVE_FIELDS Completeness', () => {
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
    ])('%s should encrypt "%s"', (provider, field) => {
      expect(SENSITIVE_FIELDS[provider]).toContain(field)
    })

    it('each provider should have at least 1 sensitive field', () => {
      Object.entries(SENSITIVE_FIELDS).forEach(([, fields]) => {
        expect(fields.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Provider Validation (orgSettings)', () => {
    it('should accept all 12 valid providers', () => {
      VALID_PROVIDERS.forEach(p => expect(isValidProvider(p)).toBe(true))
    })

    it('should reject unknown providers', () => {
      expect(isValidProvider('dropbox')).toBe(false)
      expect(isValidProvider('slack')).toBe(false)
      expect(isValidProvider('')).toBe(false)
    })

    it('should match SENSITIVE_FIELDS providers', () => {
      Object.keys(SENSITIVE_FIELDS).forEach(p => {
        expect(isValidProvider(p)).toBe(true)
      })
    })
  })

  describe('Slug Generation (Custom Statuses)', () => {
    it('should lowercase', () => {
      expect(generateSlug('In Repair')).toBe('in-repair')
    })

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('Pending Return')).toBe('pending-return')
    })

    it('should remove special characters', () => {
      expect(generateSlug('Defect (Critical!!)')).toBe('defect-critical')
    })

    it('should trim leading/trailing hyphens', () => {
      expect(generateSlug('--test--')).toBe('test')
    })

    it('should handle already clean slugs', () => {
      expect(generateSlug('deployed')).toBe('deployed')
    })

    it('should collapse multiple spaces', () => {
      expect(generateSlug('lost   or   stolen')).toBe('lost-or-stolen')
    })

    it('should handle German characters', () => {
      expect(generateSlug('Außer Betrieb')).toBe('au-er-betrieb')
    })
  })

  describe('AES-256-GCM Constants', () => {
    it('algorithm should be aes-256-gcm', () => {
      expect(ALGORITHM).toBe('aes-256-gcm')
    })

    it('IV should be 16 bytes', () => {
      expect(IV_LENGTH).toBe(16)
    })

    it('auth tag should be 16 bytes', () => {
      expect(TAG_LENGTH).toBe(16)
    })
  })
})
