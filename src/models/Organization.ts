import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'
import crypto from 'crypto'


const CustomFieldDefSchema = new Schema({
  name: { type: String, required: true },
  fieldType: {
    type: String,
    enum: ['text', 'number', 'date', 'boolean', 'select'],
    required: true
  },
  required: { type: Boolean, default: false },
  options: [String]
}, { _id: false })


const MdmIntuneSchema = new Schema({
  enabled: { type: Boolean, default: false },
  tenantId: { type: String, trim: true },
  clientId: { type: String, trim: true },
  clientSecret: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const MdmAutopilotSchema = new Schema({
  enabled: { type: Boolean, default: false },
  tenantId: { type: String, trim: true },
  clientId: { type: String, trim: true },
  clientSecret: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const MdmJamfSchema = new Schema({
  enabled: { type: Boolean, default: false },
  serverUrl: { type: String, trim: true },
  username: { type: String, trim: true },
  password: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const MdmKandjiSchema = new Schema({
  enabled: { type: Boolean, default: false },
  subdomain: { type: String, trim: true },
  apiToken: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const PersonioSchema = new Schema({
  enabled: { type: Boolean, default: false },
  clientId: { type: String, trim: true },
  clientSecret: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const ScimSchema = new Schema({
  enabled: { type: Boolean, default: false },
  bearerToken: { type: String, trim: true },
  tokenHash: { type: String, trim: true, index: true },
  provisionUsers: { type: Boolean, default: true },
  deprovisionUsers: { type: Boolean, default: false },
  autoCreateDepartments: { type: Boolean, default: true }
}, { _id: false })

const SsoSchema = new Schema({
  enabled: { type: Boolean, default: false },
  provider: { type: String, enum: ['saml', ''], default: '' },
  entityId: { type: String, trim: true },
  ssoUrl: { type: String, trim: true },
  certificate: { type: String, trim: true },
  forceSso: { type: Boolean, default: false },
  allowedDomains: [String]
}, { _id: false })

const BambooHRSchema = new Schema({
  enabled: { type: Boolean, default: false },
  subdomain: { type: String, trim: true },
  apiKey: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const GoogleWorkspaceSchema = new Schema({
  enabled: { type: Boolean, default: false },
  domain: { type: String, trim: true },
  serviceAccountKey: { type: String },
  adminEmail: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const HiBobSchema = new Schema({
  enabled: { type: Boolean, default: false },
  serviceUserId: { type: String, trim: true },
  apiToken: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const MdmMosyleSchema = new Schema({
  enabled: { type: Boolean, default: false },
  apiToken: { type: String, trim: true },
  syncInterval: { type: Number, default: 60 },
  lastSyncAt: Date
}, { _id: false })

const HelpdeskSchema = new Schema({
  enabled: { type: Boolean, default: false },
  provider: { type: String, enum: ['zendesk', 'freshdesk', ''], default: '' },


  subdomain: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 63,
    match: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  apiToken: { type: String, trim: true },
  lastDeliveryAt: Date,
  lastFailureAt: Date
}, { _id: false })

const SmartAutomationsSchema = new Schema({
  returnReminders: {
    enabled: { type: Boolean, default: true },
    daysBefore: { type: Number, default: 7 }
  },
  onboardingEmails: {
    enabled: { type: Boolean, default: true }
  },
  offboardingCleanup: {
    enabled: { type: Boolean, default: true }
  },
  assetAudits: {
    enabled: { type: Boolean, default: true },
    frequencyMonths: { type: Number, default: 6 }
  },
  autoProvisioning: {
    enabled: { type: Boolean, default: true },
    rules: [{
      jobTitlePattern: { type: String, trim: true },
      categories: [String]
    }]
  }
}, { _id: false })


const OrganizationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  ssoSlug: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'enterprise'],
    default: 'free',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  billing: {
    status: {
      type: String,
      enum: ['free', 'trialing', 'active', 'past_due', 'canceled'],
      default: 'free',
      index: true
    },
    interval: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly'
    },
    trialStartedAt: Date,
    trialEndsAt: { type: Date, index: true },
    trialWarningsSent: { type: [String], default: [] },
    guidanceEmailsSent: { type: [String], default: [] },
    currentPeriodStart: Date,
    currentPeriodEnd: { type: Date, index: true },
    lastPaymentAt: Date,
    lastInvoiceId: { type: String, trim: true },
    qontoClientId: { type: String, trim: true },
    lastQontoInvoiceId: { type: String, trim: true },


    pendingPlan: {
      type: String,
      enum: ['starter', 'pro', 'enterprise']
    },
    pendingInterval: {
      type: String,
      enum: ['monthly', 'annual']
    },
    pendingInvoiceId: { type: String, trim: true },
    pendingState: {
      type: String,
      enum: ['creating', 'finalizing', 'awaiting_payment', 'overdue', 'canceled', 'failed']
    },
    pendingRequestId: { type: String, trim: true },
    pendingLeaseExpiresAt: Date,
    pendingRequestedAt: Date,
    pendingPeriodStart: Date,
    pendingPeriodEnd: Date,
    pendingFailureAt: Date,
    pendingFailureCode: { type: String, trim: true, maxlength: 80 },


    supersededInvoiceIds: { type: [String], default: [] },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: Date,



    accessOverride: {
      plan: {
        type: String,
        enum: ['free', 'starter', 'pro', 'enterprise']
      },
      grantedAt: Date,
      expiresAt: { type: Date, index: true },
      grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, trim: true, maxlength: 200 }
    }
  },
  settings: {
    defaultCurrency: { type: String, default: 'EUR' },
    assetTagPrefix: { type: String, default: 'AN', trim: true, maxlength: 10 },
    depreciationYears: { type: Number, default: 3, min: 1, max: 20 },
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    customStatuses: [String],
    customFields: [CustomFieldDefSchema],
    integrations: {
      intune: { type: MdmIntuneSchema, default: () => ({}) },
      autopilot: { type: MdmAutopilotSchema, default: () => ({}) },
      jamf: { type: MdmJamfSchema, default: () => ({}) },
      kandji: { type: MdmKandjiSchema, default: () => ({}) },
      personio: { type: PersonioSchema, default: () => ({}) },
      scim: { type: ScimSchema, default: () => ({}) },
      sso: { type: SsoSchema, default: () => ({}) },
      bamboohr: { type: BambooHRSchema, default: () => ({}) },
      googleWorkspace: { type: GoogleWorkspaceSchema, default: () => ({}) },
      hibob: { type: HiBobSchema, default: () => ({}) },
      mosyle: { type: MdmMosyleSchema, default: () => ({}) },
      helpdesk: { type: HelpdeskSchema, default: () => ({}) }
    },
    smartAutomations: { type: SmartAutomationsSchema, default: () => ({}) },
    wizardCompleted: { type: Boolean, default: false },
    demoMode: {
      enabled: { type: Boolean, default: false },
      seedVersion: { type: Number, default: 0 },
      seededAt: Date,
      previousWizardCompleted: Boolean,
      records: {
        employees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
        hardware: [{ type: Schema.Types.ObjectId, ref: 'Hardware' }],
        assignments: [{ type: Schema.Types.ObjectId, ref: 'Assignment' }],
        licenses: [{ type: Schema.Types.ObjectId, ref: 'SoftwareLicense' }],
        workflows: [{ type: Schema.Types.ObjectId, ref: 'Workflow' }]
      },


      recordVersions: { type: Map, of: Date, default: () => ({}) },
      operationLock: {
        token: { type: String, trim: true },
        type: { type: String, enum: ['seed', 'remove'] },
        acquiredAt: Date,
        expiresAt: Date
      },


      recoveryRecords: {
        employees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
        hardware: [{ type: Schema.Types.ObjectId, ref: 'Hardware' }],
        assignments: [{ type: Schema.Types.ObjectId, ref: 'Assignment' }],
        licenses: [{ type: Schema.Types.ObjectId, ref: 'SoftwareLicense' }],
        workflows: [{ type: Schema.Types.ObjectId, ref: 'Workflow' }]
      },
      recoveryRecordVersions: { type: Map, of: Date, default: () => ({}) },
      recoveryPreviousWizardCompleted: Boolean
    }
  }
}, {
  timestamps: true
})

OrganizationSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
  if (!this.ssoSlug) {
    this.ssoSlug = crypto.randomBytes(4).toString('hex')
  }
  next()
})

OrganizationSchema.plugin(changeTrackingPlugin)

export type IOrganization = InferSchemaType<typeof OrganizationSchema>
export const Organization = mongoose.model('Organization', OrganizationSchema)
