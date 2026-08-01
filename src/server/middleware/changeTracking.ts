import { Schema } from 'mongoose'
import { AuditLog, AuditAction } from '../../models/AuditLog'
import { getRequestContext } from './requestContext'
import mongoose from 'mongoose'

const IGNORED_FIELDS = new Set([
  '_id', 'id', '__v', 'orgId', 'createdAt', 'updatedAt', 'deletedAt',
  'adminPassword', 'passwordHash', 'refreshTokenHash',
  'fullName'
])

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const diffBefore: Record<string, unknown> = {}
  const diffAfter: Record<string, unknown> = {}

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue

    const oldVal = before[key]
    const newVal = after[key]

    const oldStr = JSON.stringify(oldVal ?? null)
    const newStr = JSON.stringify(newVal ?? null)

    if (oldStr !== newStr) {
      diffBefore[key] = oldVal ?? null
      diffAfter[key] = newVal ?? null
    }
  }

  if (Object.keys(diffBefore).length === 0 && Object.keys(diffAfter).length === 0) {
    return null
  }

  return { before: diffBefore, after: diffAfter }
}

async function writeAuditLog(
  action: AuditAction,
  modelName: string,
  entityId: string | undefined,
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> },
  orgId?: string
) {
  try {
    const ctx = getRequestContext()

    await AuditLog.create({
      action,
      entityType: modelName,
      entityId,
      userId: ctx?.userId ? new mongoose.Types.ObjectId(ctx.userId) : undefined,
      userEmail: ctx?.userEmail || 'system',
      changes,
      orgId: orgId ? new mongoose.Types.ObjectId(orgId) : undefined,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('[ChangeTracking] Failed to write audit log:', error)
  }
}

const SNAPSHOT_KEY = Symbol('changeTracking:snapshot')

export function changeTrackingPlugin(schema: Schema) {


  schema.pre('save', function (next) {
    if (!this.isNew && this.isModified()) {
      const original: Record<string, unknown> = {}
      for (const path of this.modifiedPaths()) {
        if (IGNORED_FIELDS.has(path)) continue
        original[path] = (this as any).$__getValue(path)
      }
      ;(this as any)[SNAPSHOT_KEY] = { original, wasNew: false }
    } else if (this.isNew) {
      ;(this as any)[SNAPSHOT_KEY] = { wasNew: true }
    }
    next()
  })

  schema.post('save', function (doc: any) {
    const snapshot = doc[SNAPSHOT_KEY]
    if (!snapshot) return

    const entityId = String(doc._id)
    const orgId = doc.orgId ? String(doc.orgId) : undefined

    if (snapshot.wasNew) {
      const after: Record<string, unknown> = {}
      const obj = doc.toObject ? doc.toObject() : doc
      for (const [key, val] of Object.entries(obj)) {
        if (!IGNORED_FIELDS.has(key)) after[key] = val
      }
      writeAuditLog('create', doc.constructor.modelName || 'Unknown', entityId, { after }, orgId)
    } else {
      const obj = doc.toObject ? doc.toObject() : doc
      const after: Record<string, unknown> = {}
      const before: Record<string, unknown> = snapshot.original || {}

      for (const key of Object.keys(before)) {
        after[key] = obj[key] ?? null
      }

      const diff = computeDiff(before, after)
      if (diff) {
        writeAuditLog('update', doc.constructor.modelName || 'Unknown', entityId, diff, orgId)
      }
    }

    delete doc[SNAPSHOT_KEY]
  })


  schema.pre('findOneAndUpdate', async function () {
    try {
      const docToUpdate = await this.model.findOne(this.getFilter()).lean()
      if (docToUpdate) {
        ;(this as any)[SNAPSHOT_KEY] = docToUpdate
      }
    } catch {
    }
  })

  schema.post('findOneAndUpdate', function (doc: any) {
    if (!doc) return
    const before = (this as any)[SNAPSHOT_KEY]
    if (!before) return

    const after = doc.toObject ? doc.toObject() : doc
    const diff = computeDiff(before as Record<string, unknown>, after as Record<string, unknown>)

    if (diff) {
      const entityId = String(doc._id || before._id)
      const orgId = doc.orgId ? String(doc.orgId) : (before.orgId ? String(before.orgId) : undefined)
      writeAuditLog('update', doc.constructor?.modelName || this.model.modelName || 'Unknown', entityId, diff, orgId)
    }
  })


  schema.post('findOneAndDelete', function (doc: any) {
    if (!doc) return

    const obj = doc.toObject ? doc.toObject() : doc
    const before: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
      if (!IGNORED_FIELDS.has(key)) before[key] = val
    }

    const entityId = String(doc._id)
    const orgId = doc.orgId ? String(doc.orgId) : undefined
    writeAuditLog('delete', doc.constructor?.modelName || 'Unknown', entityId, { before }, orgId)
  })


  schema.pre('updateOne', async function () {
    try {
      const docToUpdate = await this.model.findOne(this.getFilter()).lean()
      if (docToUpdate) {
        ;(this as any)[SNAPSHOT_KEY] = docToUpdate
      }
    } catch {
    }
  })

  schema.post('updateOne', async function () {
    const before = (this as any)[SNAPSHOT_KEY]
    if (!before) return

    try {
      const after = await this.model.findOne({ _id: before._id }).lean()
      if (!after) return

      const diff = computeDiff(before as Record<string, unknown>, after as Record<string, unknown>)
      if (diff) {
        const entityId = String(before._id)
        const orgId = before.orgId ? String(before.orgId) : undefined
        writeAuditLog('update', this.model.modelName || 'Unknown', entityId, diff, orgId)
      }
    } catch {
    }
  })
}
