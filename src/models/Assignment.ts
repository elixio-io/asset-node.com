import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const AssignmentSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  hardware: [{
    type: Schema.Types.ObjectId,
    ref: 'Hardware',
    required: true
  }],
  peripherals: [{
    type: Schema.Types.ObjectId,
    ref: 'Peripheral'
  }],
  assignmentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedReturnDate: Date,

  checkoutLocationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  checkoutCondition: {
    type: Number,
    min: 1,
    max: 5,
    default: 5
  },

  acknowledgedAt: Date,
  signature: String,

  lastAuditedAt: Date,
  auditReminderSentAt: Date,

  returnRequestedAt: Date,
  returnReminderSentAt: Date,
  returnedAt: Date,
  returnCondition: {
    type: String,
    enum: ['good', 'fair', 'damaged']
  },
  notes: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ['active', 'pendingReturn', 'returned'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true
})


AssignmentSchema.index({ orgId: 1, employeeId: 1 })
AssignmentSchema.index({ orgId: 1, status: 1, assignmentDate: -1 })
AssignmentSchema.index({ orgId: 1, expectedReturnDate: 1 })


export function buildAssignmentHardwareTenantFilter(
  orgId: unknown,
  hardware: unknown[]
): Record<string, unknown> {
  return {
    _id: { $in: hardware },
    orgId,
    deletedAt: null
  }
}

AssignmentSchema.pre('save', async function (next) {


  const isActiveAssignment = this.status === 'active'
  const isNewOrHardwareChanged = this.isNew || this.isModified('hardware')

  if (isActiveAssignment && isNewOrHardwareChanged) {
    try {
      const Status = mongoose.model('Status')
      const deployedStatus = await Status.findOne({
        orgId: this.orgId,
        type: 'deployed'
      }).lean()

      if (deployedStatus) {
        await mongoose.model('Hardware').updateMany(
          buildAssignmentHardwareTenantFilter(this.orgId, this.hardware),
          {
            $set: {
              statusId: (deployedStatus as any)._id,
              assignedTo: this.employeeId
            }
          }
        )
      }
    } catch (error) {
      next(error instanceof Error ? error : new Error('Failed to update hardware status'))
      return
    }
  }


  next()
})

AssignmentSchema.plugin(changeTrackingPlugin)

export type IAssignment = InferSchemaType<typeof AssignmentSchema>
export const Assignment = mongoose.model('Assignment', AssignmentSchema)
