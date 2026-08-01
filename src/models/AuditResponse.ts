import mongoose, { Schema, InferSchemaType } from 'mongoose'
import crypto from 'crypto'


const AuditAssetResponseSchema = new Schema({
  assetId: { type: Schema.Types.ObjectId, required: true },
  assetType: { type: String, enum: ['hardware', 'peripheral'], required: true },
  confirmed: { type: Boolean, default: false },
  condition: {
    type: String,
    enum: ['good', 'fair', 'damaged', 'missing'],
    default: null
  },
  notes: { type: String, trim: true, maxlength: 2000 }
}, { _id: false })

const AuditResponseSchema = new Schema({
  auditId: { type: Schema.Types.ObjectId, ref: 'Audit', required: true, index: true },
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  assets: [AuditAssetResponseSchema],
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'overdue'],
    default: 'pending'
  },
  respondedAt: Date,
  signature: String
}, { timestamps: true })

AuditResponseSchema.index({ auditId: 1, employeeId: 1 }, { unique: true })

export type IAuditResponse = InferSchemaType<typeof AuditResponseSchema>
export const AuditResponse = mongoose.model('AuditResponse', AuditResponseSchema)
