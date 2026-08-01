import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { softDeletePlugin } from '../server/middleware/softDelete'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const ConsumableCheckoutSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  quantity: { type: Number, required: true, min: 1 },
  checkedOutAt: { type: Date, default: Date.now },
  checkedOutBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true, maxlength: 500 }
}, { _id: true })

const ConsumableSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  manufacturerId: { type: Schema.Types.ObjectId, ref: 'Manufacturer', default: null },
  modelNumber: { type: String, trim: true },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location', default: null, index: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },

  totalQuantity: { type: Number, required: true, min: 0 },
  minimumQuantity: { type: Number, default: 5, min: 0 },
  checkouts: [ConsumableCheckoutSchema],

  unitCost: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'EUR', maxlength: 3, trim: true },
  purchaseDate: Date,
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  orderNumber: { type: String, trim: true },

  notes: { type: String, trim: true, maxlength: 5000 },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true })

ConsumableSchema.index({ orgId: 1, name: 1 })
ConsumableSchema.index({ orgId: 1, categoryId: 1 })
ConsumableSchema.index({ orgId: 1, supplierId: 1 })

ConsumableSchema.virtual('isLowStock').get(function () {
  return this.totalQuantity <= this.minimumQuantity
})

ConsumableSchema.virtual('totalCheckedOut').get(function () {
  return (this.checkouts || []).reduce((sum, c) => sum + c.quantity, 0)
})

ConsumableSchema.set('toJSON', { virtuals: true })
ConsumableSchema.set('toObject', { virtuals: true })

ConsumableSchema.plugin(softDeletePlugin)
ConsumableSchema.plugin(changeTrackingPlugin)

export type IConsumable = InferSchemaType<typeof ConsumableSchema>
export const Consumable = mongoose.model('Consumable', ConsumableSchema)
