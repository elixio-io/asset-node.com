import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const DEPRECIATION_METHODS = ['straightLine', 'decliningBalance'] as const

const DepreciationSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  hardwareId: {
    type: Schema.Types.ObjectId,
    ref: 'Hardware',
    required: true,
    index: true
  },
  method: {
    type: String,
    enum: DEPRECIATION_METHODS,
    required: true,
    default: 'straightLine'
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salvageValue: {
    type: Number,
    default: 0,
    min: 0
  },
  usefulLifeMonths: {
    type: Number,
    required: true,
    min: 1
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  depreciationRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 20
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  }
}, {
  timestamps: true
})

DepreciationSchema.index({ orgId: 1, hardwareId: 1 }, { unique: true })

DepreciationSchema.plugin(changeTrackingPlugin)

export type IDepreciation = InferSchemaType<typeof DepreciationSchema>
export const Depreciation = mongoose.model('Depreciation', DepreciationSchema)
