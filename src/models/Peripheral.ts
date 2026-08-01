import mongoose, { Schema } from 'mongoose'
import { softDeletePlugin } from '../server/middleware/softDelete'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const PeripheralSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  statusId: {
    type: Schema.Types.ObjectId,
    ref: 'Status',
    default: null,
    index: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  manufacturerId: {
    type: Schema.Types.ObjectId,
    ref: 'Manufacturer',
    default: null
  },
  supplierId: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },

  quantity: {
    type: Number,
    min: 1,
    default: 1
  },
  minimumQuantity: {
    type: Number,
    min: 0
  },

  purchaseDate: Date,
  purchasePrice: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    maxlength: 3,
    trim: true
  },
  orderNumber: {
    type: String,
    trim: true
  },
  warrantyExpiry: Date,

  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})


PeripheralSchema.index({ orgId: 1, serialNumber: 1 }, { sparse: true })
PeripheralSchema.index({ orgId: 1, categoryId: 1, statusId: 1 })
PeripheralSchema.index({ orgId: 1, assignedTo: 1 })

export type IPeripheral = mongoose.InferSchemaType<typeof PeripheralSchema>

PeripheralSchema.plugin(softDeletePlugin)
PeripheralSchema.plugin(changeTrackingPlugin)

export const Peripheral = mongoose.model('Peripheral', PeripheralSchema)
