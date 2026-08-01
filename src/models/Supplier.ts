import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const SupplierSchema = new Schema({
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
  contactName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})


SupplierSchema.index({ orgId: 1, name: 1 }, { unique: true })

SupplierSchema.plugin(changeTrackingPlugin)

export type ISupplier = InferSchemaType<typeof SupplierSchema>
export const Supplier = mongoose.model('Supplier', SupplierSchema)
