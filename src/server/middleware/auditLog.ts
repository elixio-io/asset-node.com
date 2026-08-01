import { FastifyRequest } from 'fastify'
import { AuditLog, AuditAction } from '../../models/AuditLog'
import { User } from '../../models/User'

export async function createAuditEntry(
  request: FastifyRequest,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  changes?: {
    before?: unknown
    after?: unknown
  },
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (!request.user) return

    let userEmail = 'unknown'
    try {
      const user = await User.findById(request.user.userId).select('email').lean()
      if (user) userEmail = user.email
    } catch {
    }

    await AuditLog.create({
      action,
      entityType,
      entityId,
      userId: request.user.userId,
      userEmail,
      changes,
      metadata,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date()
    })
  } catch (error) {
    request.log.error({ error, action, entityType, entityId }, 'Failed to create audit log entry')
  }
}
