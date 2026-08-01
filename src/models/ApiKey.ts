import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'
import crypto from 'crypto'

const ApiKeySchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  keyHash: {
    type: String,
    required: true
  },
  keyPrefix: {
    type: String,
    required: true
  },
  lastUsedAt: Date,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true })

ApiKeySchema.index({ keyHash: 1 }, { unique: true })

ApiKeySchema.statics.generateKey = function () {
  const rawKey = `hm_${crypto.randomBytes(24).toString('base64url')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 11)
  return { rawKey, keyHash, keyPrefix }
}

ApiKeySchema.plugin(changeTrackingPlugin)

export type IApiKey = InferSchemaType<typeof ApiKeySchema>
export const ApiKey = mongoose.model('ApiKey', ApiKeySchema)
