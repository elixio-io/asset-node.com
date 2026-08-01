import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const CATEGORY_ENTITY_TYPES = [
  'hardware', 'peripheral', 'consumable', 'component', 'license'
] as const

export const DEFAULT_SYSTEM_CATEGORIES: {
  slug: string
  name: string
  entityType: typeof CATEGORY_ENTITY_TYPES[number]
  isDefault: boolean
  icon: string
  color: string
}[] = [
  { slug: 'laptops',           name: 'Laptops',         entityType: 'hardware',   isDefault: true, icon: 'mdi-laptop',          color: '#1976D2' },
  { slug: 'desktops',          name: 'Desktops',        entityType: 'hardware',   isDefault: true, icon: 'mdi-desktop-classic',  color: '#1976D2' },
  { slug: 'monitors',          name: 'Monitore',        entityType: 'hardware',   isDefault: true, icon: 'mdi-monitor',          color: '#1976D2' },
  { slug: 'mobile-devices',    name: 'Mobilgeräte',     entityType: 'hardware',   isDefault: true, icon: 'mdi-cellphone',        color: '#1976D2' },
  { slug: 'networking',        name: 'Netzwerk',        entityType: 'hardware',   isDefault: true, icon: 'mdi-router-network',   color: '#1976D2' },
  { slug: 'servers',           name: 'Server',          entityType: 'hardware',   isDefault: true, icon: 'mdi-server',           color: '#1976D2' },
  { slug: 'printers',          name: 'Drucker',         entityType: 'hardware',   isDefault: true, icon: 'mdi-printer',          color: '#1976D2' },
  { slug: 'other-hardware',    name: 'Sonstige',        entityType: 'hardware',   isDefault: true, icon: 'mdi-shape',            color: '#9E9E9E' },
  { slug: 'mouse',             name: 'Maus',            entityType: 'peripheral', isDefault: true, icon: 'mdi-mouse',            color: '#388E3C' },
  { slug: 'keyboard',          name: 'Tastatur',        entityType: 'peripheral', isDefault: true, icon: 'mdi-keyboard',         color: '#388E3C' },
  { slug: 'monitor-peripheral', name: 'Monitor',        entityType: 'peripheral', isDefault: true, icon: 'mdi-monitor',          color: '#388E3C' },
  { slug: 'headset',           name: 'Headset',         entityType: 'peripheral', isDefault: true, icon: 'mdi-headset',          color: '#388E3C' },
  { slug: 'webcam',            name: 'Webcam',          entityType: 'peripheral', isDefault: true, icon: 'mdi-webcam',           color: '#388E3C' },
  { slug: 'docking-station',   name: 'Docking Station', entityType: 'peripheral', isDefault: true, icon: 'mdi-dock-bottom',      color: '#388E3C' },
  { slug: 'charger',           name: 'Ladegerät',       entityType: 'peripheral', isDefault: true, icon: 'mdi-power-plug',       color: '#388E3C' },
  { slug: 'cable',             name: 'Kabel',           entityType: 'peripheral', isDefault: true, icon: 'mdi-cable-data',       color: '#388E3C' },
  { slug: 'adapter',           name: 'Adapter',         entityType: 'peripheral', isDefault: true, icon: 'mdi-connection',       color: '#388E3C' },
  { slug: 'other-peripheral',  name: 'Sonstige',        entityType: 'peripheral', isDefault: true, icon: 'mdi-shape',            color: '#9E9E9E' },
  { slug: 'cables-adapters',   name: 'Kabel & Adapter', entityType: 'consumable', isDefault: true, icon: 'mdi-cable-data',       color: '#F57C00' },
  { slug: 'office-supplies',   name: 'Büromaterial',    entityType: 'consumable', isDefault: true, icon: 'mdi-pencil',           color: '#F57C00' },
  { slug: 'storage',           name: 'Speicher',        entityType: 'component',  isDefault: true, icon: 'mdi-harddisk',         color: '#7B1FA2' },
  { slug: 'memory',            name: 'Arbeitsspeicher', entityType: 'component',  isDefault: true, icon: 'mdi-memory',           color: '#7B1FA2' },
  { slug: 'productivity',      name: 'Produktivität',   entityType: 'license',    isDefault: true, icon: 'mdi-briefcase',        color: '#00796B' },
  { slug: 'development',       name: 'Entwicklung',     entityType: 'license',    isDefault: true, icon: 'mdi-code-braces',      color: '#00796B' },
  { slug: 'security',          name: 'Sicherheit',      entityType: 'license',    isDefault: true, icon: 'mdi-shield-check',     color: '#00796B' },
]

const CategorySchema = new Schema({
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
  entityType: {
    type: String,
    enum: CATEGORY_ENTITY_TYPES,
    required: true,
    index: true
  },
  icon: {
    type: String,
    trim: true,
    default: 'mdi-shape'
  },
  color: {
    type: String,
    trim: true,
    default: '#1976D2'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

CategorySchema.index({ orgId: 1, entityType: 1, name: 1 }, { unique: true })
CategorySchema.index({ orgId: 1, slug: 1 }, { unique: true, sparse: true })

CategorySchema.plugin(changeTrackingPlugin)

export type ICategory = InferSchemaType<typeof CategorySchema>
export const Category = mongoose.model('Category', CategorySchema)
