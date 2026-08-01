import mongoose, { Schema, Document } from 'mongoose'

export interface IAILog extends Document {
  orgId: mongoose.Types.ObjectId
  timestamp: Date
  prompt: string
  rawResponse: string
  parsedResponse: {
    price: number
    source: string
    url: string
  }[]
  hardware: {
    manufacturer: string
    model: string
    category?: string
  }
  createdAt: Date
  updatedAt: Date
}

const AILogSchema = new Schema<IAILog>({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  prompt: {
    type: String,
    required: true
  },
  rawResponse: {
    type: String,
    required: true
  },
  parsedResponse: [{
    price: Number,
    source: String,
    url: String
  }],
  hardware: {
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    category: String
  }
}, {
  timestamps: true
})

AILogSchema.index({ orgId: 1, timestamp: -1 })
AILogSchema.index({ 'hardware.manufacturer': 1, 'hardware.model': 1 })

export const AILog = mongoose.model<IAILog>('AILog', AILogSchema)
