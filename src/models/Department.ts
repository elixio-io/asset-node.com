import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


export const DEFAULT_SYSTEM_DEPARTMENTS: { slug: string; name: string }[] = [
  { slug: 'management',        name: 'Geschäftsführung' },
  { slug: 'it-infrastructure', name: 'IT & Infrastruktur' },
  { slug: 'engineering',       name: 'Engineering' },
  { slug: 'design',            name: 'Design' },
  { slug: 'sales',             name: 'Vertrieb' },
  { slug: 'human-resources',   name: 'Personal / HR' },
]

const DepartmentSchema = new Schema({
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
  managerId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
})

DepartmentSchema.index({ orgId: 1, name: 1 }, { unique: true })
DepartmentSchema.index({ orgId: 1, slug: 1 }, { unique: true, sparse: true })

DepartmentSchema.plugin(changeTrackingPlugin)

export type IDepartment = InferSchemaType<typeof DepartmentSchema>
export const Department = mongoose.model('Department', DepartmentSchema)

