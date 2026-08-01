import mongoose, { Schema, InferSchemaType } from 'mongoose'


export const AUDIT_STATUSES = ['scheduled', 'inProgress', 'completed', 'cancelled'] as const

const AuditSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true },
  schedule: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual', 'oneTime'],
    default: 'oneTime'
  },
  targetType: {
    type: String,
    enum: ['all', 'location', 'department'],
    required: true
  },
  targetId: { type: Schema.Types.ObjectId, default: null },
  status: {
    type: String,
    enum: AUDIT_STATUSES,
    default: 'scheduled'
  },
  sentAt: Date,
  dueDate: { type: Date, required: true },
  completedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true, maxlength: 5000 }
}, { timestamps: true })

AuditSchema.index({ orgId: 1, status: 1 })
AuditSchema.index({ orgId: 1, dueDate: 1 })

export type IAudit = InferSchemaType<typeof AuditSchema>
export const Audit = mongoose.model('Audit', AuditSchema)
