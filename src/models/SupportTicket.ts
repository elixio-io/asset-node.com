import mongoose, {
  type Document,
  type Model,
  type Types,
} from 'mongoose'


export interface ISupportTicket extends Document {
  orgId: Types.ObjectId
  userId: Types.ObjectId
  userEmail: string
  userName: string
  ticketRef: string
  subject: string
  description: string

  category:
    | 'bug'
    | 'feature'
    | 'question'
    | 'billing'
    | 'other'

  priority:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical'

  status:
    | 'open'
    | 'in_progress'
    | 'resolved'
    | 'closed'

  metadata: {
    url?: string
    userAgent?: string
    appVersion?: string
    errorStack?: string
    screenSize?: string
    clientLog?: string
  }

  adminNotes?: string
  resolvedAt?: Date

  gitlabIssueIid?: number

  externalProvider?: 'zendesk' | 'freshdesk'
  externalTicketId?: string

  deliveryStatus: 'pending' | 'processing' | 'delivered' | 'failed'
  deliveryChannel?: 'helpdesk' | 'gitlab' | 'email'
  deliveryAttempts: number
  nextDeliveryAttemptAt?: Date
  deliveryLeaseUntil?: Date
  deliveredAt?: Date

  createdAt: Date
  updatedAt: Date
}

interface ISupportTicketCounter {
  _id: string
  seq: number
}

const supportTicketCounterSchema =
  new mongoose.Schema<ISupportTicketCounter>(
    {
      _id: {
        type: String,
        required: true,
      },

      seq: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    {
      versionKey: false,
    }
  )

const SupportTicketCounter =
  (
    mongoose.models.SupportTicketCounter as
      | Model<ISupportTicketCounter>
      | undefined
  ) ??
  mongoose.model<ISupportTicketCounter>(
    'SupportTicketCounter',
    supportTicketCounterSchema
  )

const supportTicketSchema =
  new mongoose.Schema<ISupportTicket>(
    {
      orgId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
      },

      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
      },

      userEmail: {
        type: String,
        required: true,
        trim: true,
      },

      userName: {
        type: String,
        required: true,
        trim: true,
      },

      ticketRef: {
        type: String,
        required: true,
        unique: true,
        immutable: true,
        index: true,
      },

      subject: {
        type: String,
        required: true,
        maxlength: 200,
        trim: true,
      },

      description: {
        type: String,
        required: true,
        maxlength: 5000,
      },

      category: {
        type: String,
        enum: [
          'bug',
          'feature',
          'question',
          'billing',
          'other',
        ],
        default: 'bug',
      },

      priority: {
        type: String,
        enum: [
          'low',
          'medium',
          'high',
          'critical',
        ],
        default: 'medium',
      },

      status: {
        type: String,
        enum: [
          'open',
          'in_progress',
          'resolved',
          'closed',
        ],
        default: 'open',
        index: true,
      },

      metadata: {
        url: String,
        userAgent: String,
        appVersion: String,
        errorStack: String,
        screenSize: String,
        clientLog: String,
      },

      adminNotes: String,

      resolvedAt: Date,

      gitlabIssueIid: {
        type: Number,
        select: false,
      },

      externalProvider: {
        type: String,
        enum: ['zendesk', 'freshdesk'],
        select: false,
      },

      externalTicketId: {
        type: String,
        select: false,
      },




      deliveryStatus: {
        type: String,
        enum: ['pending', 'processing', 'delivered', 'failed'],
        default: 'pending',
        index: true,
      },

      deliveryChannel: {
        type: String,
        enum: ['helpdesk', 'gitlab', 'email'],
      },

      deliveryAttempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      nextDeliveryAttemptAt: {
        type: Date,
        default: Date.now,
        index: true,
      },

      deliveryLeaseUntil: Date,
      deliveredAt: Date,
    },
    {
      timestamps: true,
    }
  )

supportTicketSchema.index({
  orgId: 1,
  status: 1,
  createdAt: -1,
})

supportTicketSchema.index({
  deliveryStatus: 1,
  nextDeliveryAttemptAt: 1,
  deliveryLeaseUntil: 1,
})

supportTicketSchema.pre('validate', async function () {
  if (!this.isNew || this.ticketRef) {
    return
  }

  const counter =
    await SupportTicketCounter.findOneAndUpdate(
      {
        _id: 'support-ticket',
      },
      {
        $inc: {
          seq: 1,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean()

  if (!counter) {
    throw new Error(
      'Could not generate support-ticket reference'
    )
  }

  this.ticketRef =
    `AN-${String(counter.seq).padStart(5, '0')}`
})

export const SupportTicket =
  (
    mongoose.models.SupportTicket as
      | Model<ISupportTicket>
      | undefined
  ) ??
  mongoose.model<ISupportTicket>(
    'SupportTicket',
    supportTicketSchema
  )
