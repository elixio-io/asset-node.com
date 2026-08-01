import mongoose, { Schema, Document } from 'mongoose'

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'assign' | 'unassign' | 'status_change'

export interface IAuditLog extends Document {
  orgId?: mongoose.Types.ObjectId
  action: AuditAction
  entityType: string
  entityId?: string
  userId?: mongoose.Types.ObjectId
  userEmail: string
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

const AuditLogSchema = new Schema<IAuditLog>({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'login', 'logout', 'assign', 'unassign', 'status_change', 'impersonate'],
    required: true,
    index: true
  },
  entityType: {
    type: String,
    required: true,
    index: true
  },
  entityId: {
    type: String,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userEmail: {
    type: String
  },
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed
  },
  metadata: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false
})

AuditLogSchema.index({ orgId: 1, entityType: 1, entityId: 1, timestamp: -1 })
AuditLogSchema.index({ orgId: 1, userId: 1, timestamp: -1 })
AuditLogSchema.index({ timestamp: -1 })

AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 })

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
