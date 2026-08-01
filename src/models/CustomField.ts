import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'url', 'email'] as const
export const CUSTOM_FIELD_ENTITIES = [
  'hardware', 'peripheral', 'consumable', 'component', 'license', 'employee', 'location'
] as const

const CustomFieldSchema = new Schema({
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
  key: {
    type: String,
    required: true,
    trim: true,
    match: /^[a-zA-Z0-9_]+$/
  },
  entityType: {
    type: String,
    enum: CUSTOM_FIELD_ENTITIES,
    required: true
  },
  fieldType: {
    type: String,
    enum: CUSTOM_FIELD_TYPES,
    required: true
  },
  options: [{
    type: String,
    trim: true
  }],
  required: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: Schema.Types.Mixed,
    default: null
  },
  helpText: {
    type: String,
    trim: true,
    maxlength: 500
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

CustomFieldSchema.index({ orgId: 1, entityType: 1, key: 1 }, { unique: true })
CustomFieldSchema.index({ orgId: 1, entityType: 1, order: 1 })

CustomFieldSchema.plugin(changeTrackingPlugin)

export type ICustomField = InferSchemaType<typeof CustomFieldSchema>
export const CustomField = mongoose.model('CustomField', CustomFieldSchema)
