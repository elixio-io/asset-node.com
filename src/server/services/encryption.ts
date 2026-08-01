
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function looksLikeEncryptedValue(value: string): boolean {
  const parts = value.split(':')
  const base64 = /^[A-Za-z0-9+/]+={0,2}$/
  if (parts.length !== 3 || !base64.test(parts[0]) || !base64.test(parts[1]) || (parts[2] !== '' && !base64.test(parts[2]))) return false
  try {
    return Buffer.from(parts[0], 'base64').length === IV_LENGTH
      && Buffer.from(parts[1], 'base64').length === TAG_LENGTH
  } catch {
    return false
  }
}


let _encryptionKey: Buffer | null = null

function getKey(): Buffer | null {
  if (_encryptionKey) return _encryptionKey

  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ ENCRYPTION_KEY is required in production. Set a 64-char hex string (32 bytes).')
      process.exit(1)
    }
    return null
  }

  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }

  _encryptionKey = Buffer.from(hex, 'hex')
  return _encryptionKey
}


export function encrypt(plaintext: string): string {
  const key = getKey()
  if (!key) {
    console.warn('⚠️ ENCRYPTION DISABLED — secrets will be stored in plaintext. Set ENCRYPTION_KEY for production use.')
    return plaintext
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}


export function decrypt(encrypted: string): string {
  const key = getKey()
  if (!key) return encrypted



  if (!looksLikeEncryptedValue(encrypted)) {
    return encrypted
  }

  const [ivB64, tagB64, cipherB64] = encrypted.split(':')

  try {
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(tagB64, 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(cipherB64, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`❌ DECRYPTION FAILED: ${message}. This may indicate a wrong ENCRYPTION_KEY or corrupted data.`)
    throw new Error('Failed to decrypt credential. Check ENCRYPTION_KEY configuration.')
  }
}


export function isEncryptionEnabled(): boolean {
  return getKey() !== null
}

export function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 4) return '••••••••'
  const last4 = decrypt(value).slice(-4)
  return `••••••••${last4}`
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export const SENSITIVE_FIELDS: Record<string, string[]> = {
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

export function encryptSensitiveFields(provider: string, config: Record<string, unknown>): Record<string, unknown> {
  const fields = SENSITIVE_FIELDS[provider] || []
  const result = { ...config }
  const key = getKey()

  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      const value = result[field] as string

      if (!key && process.env.NODE_ENV !== 'development') {
        console.error(`❌ Refusing to store ${provider}.${field} without encryption. Set ENCRYPTION_KEY.`)
        delete result[field]
        continue
      }

      if (!looksLikeEncryptedValue(value)) {
        result[field] = encrypt(value)
      }
    }
  }

  return result
}

export function maskSensitiveFields(provider: string, config: Record<string, unknown>): Record<string, unknown> {
  const fields = SENSITIVE_FIELDS[provider] || []
  const result = { ...config }

  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = maskSecret(result[field] as string)
    }
  }

  return result
}
