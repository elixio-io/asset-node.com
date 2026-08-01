import mongoose, { Schema } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const MAINTENANCE_TYPES = [
  'repair', 'preventive', 'upgrade', 'inspection', 'cleaning'
] as const
export type MaintenanceType = typeof MAINTENANCE_TYPES[number]

export const MAINTENANCE_STATUSES = [
  'scheduled', 'inProgress', 'completed', 'cancelled'
] as const
export type MaintenanceStatus = typeof MAINTENANCE_STATUSES[number]


const MaintenanceRecordSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  hardware: {
    type: Schema.Types.ObjectId,
    ref: 'Hardware',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: MAINTENANCE_TYPES,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  performedBy: {
    type: String,
    required: true,
    trim: true
  },
  cost: {
    type: Number,
    min: 0
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  completionDate: Date,
  status: {
    type: String,
    enum: MAINTENANCE_STATUSES,
    required: true,
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})


MaintenanceRecordSchema.index({ orgId: 1, hardware: 1, startDate: -1 })
MaintenanceRecordSchema.index({ orgId: 1, status: 1 })

export type IMaintenanceRecord = mongoose.InferSchemaType<typeof MaintenanceRecordSchema>

MaintenanceRecordSchema.plugin(changeTrackingPlugin)

export const MaintenanceRecord = mongoose.model('MaintenanceRecord', MaintenanceRecordSchema)
