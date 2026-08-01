import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'
import crypto from 'crypto'

const WebhookSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  events: [{
    type: String,
    enum: [
      'asset.assigned', 'asset.returned', 'asset.created', 'asset.deleted',
      'maintenance.completed', 'audit.completed',
      'employee.onboarded', 'employee.offboarded',
      'lowStock.alert'
    ]
  }],
  description: { type: String, trim: true, maxlength: 500 },
  signingSecret: {
    type: String,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  isActive: { type: Boolean, default: true },
  lastTriggeredAt: Date,
  failureCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

WebhookSchema.index({ orgId: 1, isActive: 1 })

WebhookSchema.plugin(changeTrackingPlugin)

export type IWebhook = InferSchemaType<typeof WebhookSchema>
export const Webhook = mongoose.model('Webhook', WebhookSchema)
