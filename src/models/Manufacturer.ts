import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const DEFAULT_SYSTEM_MANUFACTURERS: { name: string }[] = [
  { name: 'Apple' },
  { name: 'Dell' },
  { name: 'Lenovo' },
  { name: 'HP' },
  { name: 'LG' },
  { name: 'Samsung' },
  { name: 'Logitech' },
  { name: 'Microsoft' },
]

const ManufacturerSchema = new Schema({
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
  url: {
    type: String,
    trim: true
  },
  supportUrl: {
    type: String,
    trim: true
  },
  supportEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})


ManufacturerSchema.index({ orgId: 1, name: 1 }, { unique: true })

ManufacturerSchema.plugin(changeTrackingPlugin)

export type IManufacturer = InferSchemaType<typeof ManufacturerSchema>
export const Manufacturer = mongoose.model('Manufacturer', ManufacturerSchema)
