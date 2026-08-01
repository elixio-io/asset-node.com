import type { IUser } from '../../models/User'
import { User } from '../../models/User'
import type { JwtPayload } from '../middleware/auth'
import { decrypt } from './encryption'
import { verifyTotp } from './authSecurity'

const RECENT_AUTH_SECONDS = 10 * 60

export function hasRecentStrongAuthentication(payload: JwtPayload | undefined): boolean {
  if (!payload?.authTime) return false
  if (payload.authTime < Math.floor(Date.now() / 1000) - RECENT_AUTH_SECONDS) return false
  return ['totp', 'recovery-code', 'passkey'].includes(payload.authMethod || '')
}

export async function confirmMfaStepUp(
  user: IUser,
  payload: JwtPayload | undefined,
  code?: string
): Promise<boolean> {
  if (!user.totpEnabled) return true
  if (hasRecentStrongAuthentication(payload)) return true
  if (!code || !user.totpSecretEncrypted) return false

  const step = verifyTotp(decrypt(user.totpSecretEncrypted), code)
  if (step === null || (user.totpLastUsedStep !== undefined && step <= user.totpLastUsedStep)) return false

  const claimed = await User.updateOne({
    _id: user._id,
    totpEnabled: true,
    $or: [
      { totpLastUsedStep: { $exists: false } },
      { totpLastUsedStep: { $lt: step } }
    ]
  }, { $set: { totpLastUsedStep: step } })
  return claimed.modifiedCount === 1
}
