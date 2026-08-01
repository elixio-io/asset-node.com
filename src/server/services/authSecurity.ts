import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { AuthChallenge } from '../../models/AuthChallenge'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6
const SECURITY_TOKEN_TTL = '5m'

export type SecurityChallengePurpose = 'mfa-login' | 'passkey-registration' | 'passkey-login'

export interface SecurityChallenge {
  purpose: SecurityChallengePurpose
  challenge?: string
  userId?: string
  tokenId?: string
  primaryAuthMethod?: 'password' | 'sso'
  authVersion?: number
}

function signingSecret(): string {
  const secret = process.env.AUTH_CHALLENGE_SECRET || process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_CHALLENGE_SECRET or JWT_SECRET is required in production')
  }
  return 'dev-auth-challenge-secret-change-in-production'
}

function recoveryPepper(): string {
  const pepper = process.env.MFA_RECOVERY_PEPPER || process.env.JWT_SECRET
  if (pepper) return pepper
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MFA_RECOVERY_PEPPER or JWT_SECRET is required in production')
  }
  return 'dev-mfa-recovery-pepper-change-in-production'
}

export function signSecurityChallenge(payload: SecurityChallenge): string {
  return jwt.sign(payload, signingSecret(), {
    expiresIn: SECURITY_TOKEN_TTL,
    issuer: 'assetnode',
    audience: 'auth-security'
  })
}

export async function createSecurityChallenge(payload: SecurityChallenge): Promise<string> {
  const tokenId = crypto.randomBytes(32).toString('base64url')
  await AuthChallenge.create({
    tokenId,
    purpose: payload.purpose,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  })
  return signSecurityChallenge({ ...payload, tokenId })
}

export function verifySecurityChallenge(
  token: string,
  expectedPurpose: SecurityChallengePurpose
): SecurityChallenge {
  const payload = jwt.verify(token, signingSecret(), {
    issuer: 'assetnode',
    audience: 'auth-security'
  }) as SecurityChallenge

  if (payload.purpose !== expectedPurpose) {
    throw new Error('Security challenge purpose mismatch')
  }
  if (!payload.tokenId) throw new Error('Security challenge is missing its one-time token ID')
  return payload
}

export async function consumeSecurityChallenge(
  token: string,
  expectedPurpose: SecurityChallengePurpose
): Promise<SecurityChallenge> {
  const payload = verifySecurityChallenge(token, expectedPurpose)
  const consumed = await AuthChallenge.findOneAndDelete({
    tokenId: payload.tokenId,
    purpose: expectedPurpose,
    expiresAt: { $gt: new Date() }
  })
  if (!consumed) throw new Error('Security challenge was already used or expired')
  return payload
}

export function getWebAuthnConfig(): { rpID: string; rpName: string; origin: string } {
  const rawOrigin = process.env.WEBAUTHN_ORIGIN
    || process.env.APP_URL
    || process.env.CORS_ORIGIN
    || 'http://localhost:5173'
  const origin = new URL(rawOrigin).origin
  const hostname = new URL(origin).hostname

  return {
    rpID: process.env.WEBAUTHN_RP_ID || hostname,
    rpName: process.env.WEBAUTHN_RP_NAME || 'AssetNode',
    origin
  }
}

export function encodeBase32(input: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of input) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

export function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = 0
  let accumulator = 0
  const bytes: number[] = []

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index < 0) throw new Error('Invalid base32 secret')
    accumulator = (accumulator << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20))
}

export function generateTotp(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  ) >>> 0

  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, '0')
}

export function verifyTotp(
  secret: string,
  token: string,
  nowMs = Date.now(),
  window = 1
): number | null {
  const normalized = token.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return null
  const currentStep = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS)
  const provided = Buffer.from(normalized)

  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + offset
    const expected = Buffer.from(generateTotp(secret, step))
    if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
      return step
    }
  }
  return null
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashRecoveryCode(code: string): string {
  return crypto
    .createHmac('sha256', recoveryPepper())
    .update(normalizeRecoveryCode(code))
    .digest('hex')
}

export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(12)
    let raw = ''
    for (let index = 0; index < 12; index += 1) {
      raw += alphabet[bytes[index] % alphabet.length]
    }
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
  })
}

export function buildTotpUri(email: string, secret: string): string {
  const issuer = process.env.WEBAUTHN_RP_NAME || 'AssetNode'
  const label = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
}
