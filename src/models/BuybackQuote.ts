import mongoose, { Schema } from 'mongoose'


export type BuybackStatus = 'draft' | 'submitted' | 'quoted' | 'accepted' | 'shipped' | 'completed' | 'rejected' | 'expired'

export interface IBuybackAsset {
  hardwareId: mongoose.Types.ObjectId
  model: string
  serialNumber?: string
  category: string
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  purchasePrice?: number
  purchaseDate?: Date
  estimatedValue: number
}

const BuybackAssetSchema = new Schema({
  hardwareId: { type: Schema.Types.ObjectId, ref: 'Hardware', required: true },
  model:      { type: String, required: true, trim: true },
  serialNumber: { type: String, trim: true },
  category:   { type: String, required: true, trim: true },
  condition:  { type: String, enum: ['excellent', 'good', 'fair', 'poor'], required: true },
  purchasePrice: { type: Number, min: 0 },
  purchaseDate: Date,
  estimatedValue: { type: Number, required: true, min: 0 }
}, { _id: false })

const BuybackQuoteSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  partnerSlug: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  quoteRef: {
    type: String,
    trim: true,
    index: true
  },
  partnerName: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'quoted', 'accepted', 'shipped', 'completed', 'rejected', 'expired'],
    default: 'draft',
    index: true
  },
  assets: {
    type: [BuybackAssetSchema],
    required: true,
    validate: [(v: any[]) => v.length > 0, 'At least one asset is required']
  },
  totalEstimatedValue: { type: Number, required: true, min: 0 },
  totalActualValue:    { type: Number, min: 0 },
  currency: { type: String, default: 'EUR', maxlength: 3 },
  contactName:  { type: String, trim: true },
  contactEmail: { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  notes: { type: String, trim: true },
  partnerNotes: { type: String, trim: true },
  partnerQuoteRef: { type: String, trim: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  submittedAt: Date,
  quotedAt:    Date,
  acceptedAt:  Date,
  shippedAt:   Date,
  completedAt: Date,
  rejectedAt:  Date,
}, {
  timestamps: true
})

BuybackQuoteSchema.index({ orgId: 1, status: 1, createdAt: -1 })
BuybackQuoteSchema.index({ orgId: 1, partnerSlug: 1 })

export const BuybackQuote = mongoose.model('BuybackQuote', BuybackQuoteSchema)
