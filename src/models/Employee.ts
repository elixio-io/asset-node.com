import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { softDeletePlugin } from '../server/middleware/softDelete'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const EmployeeSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  jobTitle: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  externalId: {
    type: String,
    trim: true,
    default: null
  },
  managerId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  startDate: Date,
  endDate: Date,
  onboardingEmailSentAt: Date,
  offboardingProcessedAt: Date,
  notes: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  customFields: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
})

EmployeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`
})

EmployeeSchema.set('toJSON', { virtuals: true })
EmployeeSchema.set('toObject', { virtuals: true })

EmployeeSchema.index({ orgId: 1, isActive: 1 })
EmployeeSchema.index({ orgId: 1, email: 1 }, { unique: true })
EmployeeSchema.index({ orgId: 1, managerId: 1 })
EmployeeSchema.index({ orgId: 1, departmentId: 1 })
EmployeeSchema.index({ orgId: 1, locationId: 1 })
EmployeeSchema.index({ orgId: 1, externalId: 1 }, { sparse: true })

EmployeeSchema.plugin(softDeletePlugin)
EmployeeSchema.plugin(changeTrackingPlugin)

export type IEmployee = InferSchemaType<typeof EmployeeSchema>
export const Employee = mongoose.model('Employee', EmployeeSchema)
