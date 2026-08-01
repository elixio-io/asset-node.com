import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export type UserRole = 'superAdmin' | 'admin' | 'manager' | 'employee' | 'viewer'

export interface IUserPasskey {
  credentialId: string
  publicKey: Buffer
  counter: number
  transports: string[]
  deviceType: 'singleDevice' | 'multiDevice'
  backedUp: boolean
  name: string
  createdAt: Date
  lastUsedAt?: Date
}

export interface IUser extends Document {
  email: string
  firstName: string
  lastName: string
  orgId: mongoose.Types.ObjectId
  companyName: string
  department?: string
  role: UserRole
  permissions: string[]
  hashedPassword: string
  isActive: boolean
  lastLoginAt?: Date
  passwordChangedAt?: Date
  refreshToken?: string
  authVersion: number
  ssoOnly?: boolean
  onboardingCompleted: boolean
  resetToken?: string
  resetTokenExpiry?: Date
  passkeys: IUserPasskey[]
  totpEnabled: boolean
  totpSecretEncrypted?: string
  totpPendingSecretEncrypted?: string
  totpPendingExpiresAt?: Date
  totpLastUsedStep?: number
  recoveryCodeHashes: string[]
  mfaEnrolledAt?: Date
  mfaResetAt?: Date
  gdprConsent: boolean
  gdprConsentDate?: Date
  dataProcessingConsent: boolean
  marketingConsent: boolean
  accountDeletionRequestedAt?: Date
  createdAt: Date
  updatedAt: Date
  setPassword: (password: string) => Promise<void>
  validatePassword: (password: string) => Promise<boolean>
  fullName: string
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['superAdmin', 'admin', 'manager', 'employee', 'viewer'],
    default: 'employee',
    required: true,
    index: true
  },
  permissions: {
    type: [String],
    default: []
  },
  hashedPassword: {
    type: String,
    required: true,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLoginAt: Date,
  passwordChangedAt: Date,
  refreshToken: {
    type: String,
    select: false
  },
  authVersion: {
    type: Number,
    default: 0,
    min: 0,
    select: false
  },
  ssoOnly: {
    type: Boolean,
    default: false
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  gdprConsent: {
    type: Boolean,
    default: false
  },
  gdprConsentDate: Date,
  dataProcessingConsent: {
    type: Boolean,
    default: false
  },
  marketingConsent: {
    type: Boolean,
    default: false
  },
  accountDeletionRequestedAt: Date,
  resetToken: {
    type: String,
    select: false
  },
  resetTokenExpiry: {
    type: Date,
    select: false
  },
  passkeys: {
    type: [{
      credentialId: { type: String, required: true },
      publicKey: { type: Buffer, required: true },
      counter: { type: Number, required: true, default: 0 },
      transports: { type: [String], default: [] },
      deviceType: { type: String, enum: ['singleDevice', 'multiDevice'], required: true },
      backedUp: { type: Boolean, default: false },
      name: { type: String, required: true, trim: true, maxlength: 80 },
      createdAt: { type: Date, default: Date.now },
      lastUsedAt: Date
    }],
    default: [],
    select: false
  },
  totpEnabled: {
    type: Boolean,
    default: false
  },
  totpSecretEncrypted: {
    type: String,
    select: false
  },
  totpPendingSecretEncrypted: {
    type: String,
    select: false
  },
  totpPendingExpiresAt: {
    type: Date,
    select: false
  },
  totpLastUsedStep: {
    type: Number,
    select: false
  },
  recoveryCodeHashes: {
    type: [String],
    default: [],
    select: false
  },
  mfaEnrolledAt: Date,
  mfaResetAt: Date
}, {
  timestamps: true
})

UserSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`
})

function removeAuthenticationFields(_document: unknown, value: Record<string, unknown>) {


  delete value.hashedPassword
  delete value.refreshToken
  delete value.authVersion
  delete value.resetToken
  delete value.resetTokenExpiry
  delete value.passkeys
  delete value.totpSecretEncrypted
  delete value.totpPendingSecretEncrypted
  delete value.totpPendingExpiresAt
  delete value.totpLastUsedStep
  delete value.recoveryCodeHashes
  return value
}

UserSchema.set('toJSON', { virtuals: true, transform: removeAuthenticationFields })
UserSchema.set('toObject', { virtuals: true, transform: removeAuthenticationFields })

UserSchema.methods.setPassword = async function (password: string): Promise<void> {
  this.hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
  this.passwordChangedAt = new Date()
}

UserSchema.methods.validatePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.hashedPassword)
}

UserSchema.index({ orgId: 1, role: 1 })
UserSchema.index({ orgId: 1, isActive: 1 })
UserSchema.index({ 'passkeys.credentialId': 1 }, { unique: true, sparse: true })

export const User = mongoose.model<IUser>('User', UserSchema)
