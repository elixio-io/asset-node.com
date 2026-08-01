import mongoose, { Schema, Document } from 'mongoose'

export interface IInvite extends Document {
  email: string
  orgId: mongoose.Types.ObjectId
  role: 'admin' | 'manager' | 'employee' | 'viewer'
  hashedToken: string
  expiresAt: Date
  invitedBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const InviteSchema = new Schema<IInvite>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'employee', 'viewer'],
    default: 'employee',
    required: true
  },
  hashedToken: {
    type: String,
    required: true,
    select: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

InviteSchema.index({ orgId: 1, email: 1 }, { unique: true })

export const Invite = mongoose.model<IInvite>('Invite', InviteSchema)
