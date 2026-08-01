import mongoose, { Schema, Document } from 'mongoose'

export interface IAvailable extends Document {
  employeeId: string
  employeeName: string
  hardware: mongoose.Types.ObjectId[]
  peripherals: mongoose.Types.ObjectId[]
  AvailableDate: Date
  createdAt: Date
  updatedAt: Date
}

const AvailableSchema = new Schema<IAvailable>({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
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
  AvailableDate: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
})

AvailableSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('hardware')) {
    try {
      const Status = mongoose.model('Status')
      const Hardware = mongoose.model('Hardware')
      const hw = await Hardware.findOne({ _id: { $in: this.hardware } }).select('orgId').lean() as any
      if (hw?.orgId) {
        const assignedStatus = await Status.findOne({ orgId: hw.orgId, slug: 'assigned' }).select('_id').lean()
        if (assignedStatus) {
          await Hardware.updateMany(
            { _id: { $in: this.hardware } },
            { $set: { statusId: assignedStatus._id, assignedTo: this.employeeName } }
          )
        }
      }
    } catch (error) {
      next(error instanceof Error ? error : new Error('Failed to update hardware status'))
    }
  }
  next()
})

AvailableSchema.pre('remove', async function(next) {
  try {
    const Status = mongoose.model('Status')
    const Hardware = mongoose.model('Hardware')
    const hw = await Hardware.findOne({ _id: { $in: this.hardware } }).select('orgId').lean() as any
    if (hw?.orgId) {
      const availableStatus = await Status.findOne({ orgId: hw.orgId, slug: 'available' }).select('_id').lean()
      if (availableStatus) {
        await Hardware.updateMany(
          { _id: { $in: this.hardware } },
          { $set: { statusId: availableStatus._id }, $unset: { assignedTo: 1 } }
        )
      }
    }
  } catch (error) {
    next(error instanceof Error ? error : new Error('Failed to update hardware status'))
  }
  next()
})

export const Available = mongoose.model<IAvailable>('Available', AvailableSchema)
