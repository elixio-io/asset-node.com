import mongoose, { Schema } from 'mongoose'
import { softDeletePlugin } from '../server/middleware/softDelete'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'
import { assetTagPattern, formatAssetTag, nextAssetTagSequence } from '../shared/assetTag'


const HardwareSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  assetTag: {
    type: String,
    trim: true,
    index: true
  },
  assetName: {
    type: String,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true,
    index: true
  },
  model: {
    type: String,
    required: true,
    trim: true
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
    required: true,
    index: true
  },
  manufacturerId: {
    type: Schema.Types.ObjectId,
    ref: 'Manufacturer',
    required: true
  },
  supplierId: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
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

  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
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
  endOfLife: Date,

  imageUrl: {
    type: String,
    trim: true
  },
  adminPassword: {
    type: String,
    select: false
  },
  defectDescription: {
    type: String,
    trim: true
  },
  salePrice: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  tags: {
    type: [String],
    default: []
  },
  customFields: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true
})


// Partial, not sparse: a compound sparse index still indexes docs that have
// orgId but no assetTag (as null), so two tagless assets in one org would
// collide. The partial filter restricts uniqueness to real string tags.
HardwareSchema.index(
  { orgId: 1, assetTag: 1 },
  { unique: true, partialFilterExpression: { assetTag: { $type: 'string' } } }
)
HardwareSchema.index({ orgId: 1, serialNumber: 1 }, { sparse: true })
HardwareSchema.index({ orgId: 1, categoryId: 1, statusId: 1 })
HardwareSchema.index({ orgId: 1, manufacturerId: 1 })
HardwareSchema.index({ orgId: 1, departmentId: 1 })
HardwareSchema.index({ orgId: 1, warrantyExpiry: 1 })
HardwareSchema.index({ orgId: 1, assignedTo: 1 })
HardwareSchema.index({ orgId: 1, supplierId: 1 })
HardwareSchema.index({ tags: 1 })


HardwareSchema.pre('save', async function (next) {



  if (this.serialNumber === '') this.serialNumber = null as any
  if (this.assetTag === '') this.assetTag = null as any

  if (this.isNew && !this.assetTag) {
    try {
      const org = await mongoose.model('Organization').findById(this.orgId).select('settings.assetTagPrefix').lean()
      const prefix = (org as any)?.settings?.assetTagPrefix || 'AN'
      this.assetTag = await generateAssetTag(this.orgId, prefix)
    } catch (err: any) {
      // Fall through untagged rather than blocking the save; the partial index
      // permits tagless assets. Logged so this stops failing invisibly.
      console.warn('⚠️ [Hardware] asset tag generation failed:', err?.message ?? err)
    }
  }
  next()
})

/**
 * Highest sequence ever issued for `prefix` in this org, plus one.
 *
 * Runs against the raw collection on purpose: the soft-delete plugin filters
 * `deletedAt: null` out of every model query, but a soft-deleted asset still
 * holds its tag in the unique {orgId, assetTag} index. Scanning through the
 * model therefore re-issued the tag of the most recently deleted asset and the
 * insert died with E11000 (surfaced as "asset tag already exists").
 *
 * Sorting is numeric, not lexicographic — `AN-9` must not outrank `AN-100000`.
 */
async function generateAssetTag(orgId: mongoose.Types.ObjectId, prefix: string): Promise<string> {
  const [highest] = await Hardware.collection.aggregate([
    { $match: { orgId, assetTag: { $regex: assetTagPattern(prefix) } } },
    { $project: { sequence: { $toLong: { $substrCP: ['$assetTag', prefix.length + 1, { $strLenCP: '$assetTag' }] } } } },
    { $sort: { sequence: -1 } },
    { $limit: 1 }
  ]).toArray()

  return formatAssetTag(prefix, nextAssetTagSequence(highest?.sequence))
}

export type IHardware = mongoose.InferSchemaType<typeof HardwareSchema>

HardwareSchema.plugin(softDeletePlugin)
HardwareSchema.plugin(changeTrackingPlugin)

export const Hardware = mongoose.model('Hardware', HardwareSchema)
