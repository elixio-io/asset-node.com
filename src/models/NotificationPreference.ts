import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'


const ChannelConfigSchema = new Schema({
  enabled: { type: Boolean, default: false },
  webhookUrl: { type: String, trim: true },
  address: { type: String, trim: true }
}, { _id: false })

const EventToggleSchema = new Schema({
  email: { type: Boolean, default: false },
  slack: { type: Boolean, default: false },
  teams: { type: Boolean, default: false }
}, { _id: false })

const NotificationPreferenceSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true
  },
  channels: {
    email: { type: ChannelConfigSchema, default: () => ({}) },
    slack: { type: ChannelConfigSchema, default: () => ({}) },
    teams: { type: ChannelConfigSchema, default: () => ({}) }
  },
  events: {
    checkInOut: { type: EventToggleSchema, default: () => ({}) },
    lowStock: { type: EventToggleSchema, default: () => ({}) },
    licenseExpiry: { type: EventToggleSchema, default: () => ({}) },
    warrantyExpiry: { type: EventToggleSchema, default: () => ({}) },
    assetAudit: { type: EventToggleSchema, default: () => ({}) },
    assetDueBack: { type: EventToggleSchema, default: () => ({}) },
    endOfLife: { type: EventToggleSchema, default: () => ({}) },
    maintenanceDone: { type: EventToggleSchema, default: () => ({}) }
  },
  intervals: {
    first: { type: Number, default: 60 },
    second: { type: Number, default: 30 },
    third: { type: Number, default: 14 },
    fourth: { type: Number, default: 0 }
  }
}, { timestamps: true })

NotificationPreferenceSchema.plugin(changeTrackingPlugin)

export type INotificationPreference = InferSchemaType<typeof NotificationPreferenceSchema>
export const NotificationPreference = mongoose.model('NotificationPreference', NotificationPreferenceSchema)
