import mongoose, { Schema, type Document } from 'mongoose'
import type { SecurityChallengePurpose } from '../server/services/authSecurity'

export interface IAuthChallenge extends Document {
  tokenId: string
  purpose: SecurityChallengePurpose
  expiresAt: Date
  createdAt: Date
}

const AuthChallengeSchema = new Schema<IAuthChallenge>({
  tokenId: { type: String, required: true, unique: true, index: true },
  purpose: {
    type: String,
    required: true,
    enum: ['mfa-login', 'passkey-registration', 'passkey-login']
  },
  expiresAt: { type: Date, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
})



AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const AuthChallenge = mongoose.model<IAuthChallenge>('AuthChallenge', AuthChallengeSchema)
