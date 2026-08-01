import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const LocationSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  contactName: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
})

LocationSchema.index({ orgId: 1, name: 1 }, { unique: true })

LocationSchema.plugin(changeTrackingPlugin)

export type ILocation = InferSchemaType<typeof LocationSchema>
export const Location = mongoose.model('Location', LocationSchema)
