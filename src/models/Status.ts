import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const STATUS_TYPES = [
  'deployable', 'deployed', 'undeployable', 'pending', 'archived'
] as const




export const SYSTEM_STATUS_SLUGS = [
  'available', 'assigned', 'defective', 'for-sale',
  'in-repair', 'retired', 'lost', 'disposed', 'on-order'
] as const
export type SystemStatusSlug = typeof SYSTEM_STATUS_SLUGS[number]

export const DEFAULT_SYSTEM_STATUSES: {
  slug: SystemStatusSlug
  name: string
  type: typeof STATUS_TYPES[number]
  color: string
  icon: string
  isDefault: boolean
  isSystem: boolean
  description: string
}[] = [
  { slug: 'available',  name: 'Einsatzbereit', type: 'deployable',   color: '#4CAF50', icon: 'pi pi-check-circle',          isDefault: true,  isSystem: true, description: 'Gerät kann zugewiesen werden' },
  { slug: 'assigned',   name: 'Zugewiesen',    type: 'deployed',     color: '#2196F3', icon: 'pi pi-user',                  isDefault: false, isSystem: true, description: 'Gerät ist einem Mitarbeiter zugewiesen' },
  { slug: 'defective',  name: 'Defekt',         type: 'undeployable', color: '#F44336', icon: 'pi pi-exclamation-triangle',  isDefault: false, isSystem: true, description: 'Gerät ist defekt und nicht einsatzfähig' },
  { slug: 'in-repair',  name: 'In Reparatur',   type: 'undeployable', color: '#FF9800', icon: 'pi pi-wrench',               isDefault: false, isSystem: true, description: 'Gerät wird repariert' },
  { slug: 'retired',    name: 'Ausgemustert',   type: 'archived',     color: '#9E9E9E', icon: 'pi pi-ban',                  isDefault: false, isSystem: true, description: 'Gerät ist aus dem Verkehr gezogen' },
  { slug: 'for-sale',   name: 'Zum Verkauf',    type: 'pending',      color: '#9C27B0', icon: 'pi pi-shopping-cart',         isDefault: false, isSystem: true, description: 'Gerät wird zum Verkauf angeboten' },
  { slug: 'lost',       name: 'Verloren',       type: 'undeployable', color: '#E91E63', icon: 'pi pi-question-circle',       isDefault: false, isSystem: true, description: 'Gerät ist verloren gegangen' },
  { slug: 'disposed',   name: 'Entsorgt',       type: 'archived',     color: '#607D8B', icon: 'pi pi-trash',                isDefault: false, isSystem: true, description: 'Gerät wurde fachgerecht entsorgt' },
  { slug: 'on-order',   name: 'Bestellt',       type: 'pending',      color: '#00BCD4', icon: 'pi pi-clock',                isDefault: false, isSystem: true, description: 'Gerät wurde bestellt, Lieferung ausstehend' },
]

const StatusSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  type: {
    type: String,
    enum: STATUS_TYPES,
    required: true
  },
  color: {
    type: String,
    trim: true,
    default: '#1976D2'
  },
  icon: {
    type: String,
    trim: true,
    default: 'pi pi-circle'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
})

StatusSchema.index({ orgId: 1, name: 1 }, { unique: true })
StatusSchema.index({ orgId: 1, slug: 1 }, { unique: true, sparse: true })
StatusSchema.index({ orgId: 1, type: 1 })

StatusSchema.plugin(changeTrackingPlugin)

export type IStatus = InferSchemaType<typeof StatusSchema>
export const Status = mongoose.model('Status', StatusSchema)
