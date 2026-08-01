import mongoose, { Schema, InferSchemaType } from 'mongoose'


export const ASSET_EVENT_TYPES = [
  'created', 'statusChange', 'assigned', 'returned',
  'maintenance', 'audit', 'fieldChange', 'deleted'
] as const


const AssetEventSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  assetId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  assetType: {
    type: String,
    enum: ['hardware', 'peripheral'],
    required: true
  },
  eventType: {
    type: String,
    enum: ASSET_EVENT_TYPES,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  previousValue: String,
  newValue: String,
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
})

AssetEventSchema.index({ assetId: 1, timestamp: -1 })
AssetEventSchema.index({ orgId: 1, eventType: 1, timestamp: -1 })

export type IAssetEvent = InferSchemaType<typeof AssetEventSchema>
export const AssetEvent = mongoose.model('AssetEvent', AssetEventSchema)
