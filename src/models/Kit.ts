import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const KitItemSchema = new Schema({
  itemType: {
    type: String,
    enum: ['hardware', 'peripheral', 'license', 'consumable'],
    required: true
  },
  category: {
    type: String,
    trim: true
  },
  referenceId: {
    type: Schema.Types.ObjectId,
    default: null
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  }
}, { _id: false })


const KitSchema = new Schema({
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
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  items: {
    type: [KitItemSchema],
    default: []
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})


KitSchema.index({ orgId: 1, name: 1 }, { unique: true })

KitSchema.plugin(changeTrackingPlugin)

export type IKit = InferSchemaType<typeof KitSchema>
export const Kit = mongoose.model('Kit', KitSchema)
