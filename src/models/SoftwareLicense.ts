import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { softDeletePlugin } from '../server/middleware/softDelete'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const LicenseSeatSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  checkedOutAt: { type: Date, default: Date.now },
  checkedOutBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true, maxlength: 500 }
}, { _id: true })

const SoftwareLicenseSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  publisher: { type: String, trim: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  licenseType: {
    type: String,
    enum: ['perpetual', 'subscription', 'oem', 'volume', 'freeware', 'open-source'],
    default: 'subscription'
  },
  licenseKey: { type: String, trim: true },
  totalSeats: { type: Number, required: true, min: 1 },
  seats: [LicenseSeatSchema],

  manufacturerId: { type: Schema.Types.ObjectId, ref: 'Manufacturer', default: null },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },

  costPerSeat: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'EUR', maxlength: 3, trim: true },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual', 'one-time', 'other'],
    default: 'annual'
  },
  purchaseDate: Date,
  expirationDate: { type: Date, index: true },
  renewalDate: Date,

  version: { type: String, trim: true },
  purchaseOrderNumber: { type: String, trim: true },
  reassignable: { type: Boolean, default: true },
  notes: { type: String, trim: true, maxlength: 5000 },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true })

SoftwareLicenseSchema.index({ orgId: 1, name: 1 })
SoftwareLicenseSchema.index({ orgId: 1, expirationDate: 1 })
SoftwareLicenseSchema.index({ orgId: 1, categoryId: 1 })
SoftwareLicenseSchema.index({ orgId: 1, supplierId: 1 })

SoftwareLicenseSchema.virtual('availableSeats').get(function () {
  if (this.totalSeats === -1) return Infinity
  return this.totalSeats - (this.seats?.length || 0)
})

SoftwareLicenseSchema.set('toJSON', { virtuals: true })
SoftwareLicenseSchema.set('toObject', { virtuals: true })

SoftwareLicenseSchema.plugin(softDeletePlugin)
SoftwareLicenseSchema.plugin(changeTrackingPlugin)

export type ISoftwareLicense = InferSchemaType<typeof SoftwareLicenseSchema>
export const SoftwareLicense = mongoose.model('SoftwareLicense', SoftwareLicenseSchema)
