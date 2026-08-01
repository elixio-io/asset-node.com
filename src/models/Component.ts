import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const ComponentSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  serialNumber: { type: String, trim: true },
  manufacturerId: { type: Schema.Types.ObjectId, ref: 'Manufacturer', default: null },
  model: { type: String, trim: true },

  hardwareId: { type: Schema.Types.ObjectId, ref: 'Hardware', default: null, index: true },
  installedAt: Date,

  quantity: { type: Number, min: 1, default: 1 },
  minimumQuantity: { type: Number, min: 0 },

  purchasePrice: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'EUR', maxlength: 3, trim: true },
  purchaseDate: Date,
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },

  notes: { type: String, trim: true, maxlength: 5000 },
  status: {
    type: String,
    enum: ['available', 'installed', 'defective', 'retired'],
    default: 'available',
    index: true
  }
}, { timestamps: true })

ComponentSchema.index({ orgId: 1, name: 1 })
ComponentSchema.index({ orgId: 1, categoryId: 1 })
ComponentSchema.index({ orgId: 1, hardwareId: 1 })

ComponentSchema.plugin(changeTrackingPlugin)

export type IComponent = InferSchemaType<typeof ComponentSchema>
export const Component = mongoose.model('Component', ComponentSchema)
