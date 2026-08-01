import mongoose from 'mongoose'
import {
  extractWorkflowTargetIds,
  type WorkflowTargetEntity
} from '../../shared/workflowRouting'

interface TenantScopedModel {
  find(filter: Record<string, unknown>): {
    select(fields: string): {
      lean(): Promise<Array<{ _id: unknown }>>
    }
  }
}

export async function requireTenantWorkflowTargets(
  Model: TenantScopedModel,
  entity: WorkflowTargetEntity,
  orgId: string,
  triggerData: Record<string, unknown>
): Promise<string[]> {
  const ids = extractWorkflowTargetIds(triggerData, entity)
  if (ids.length === 0) return []

  if (ids.some(id => !mongoose.isValidObjectId(id))) {
    throw new Error(`Invalid ${entity} target in workflow context`)
  }

  const records = await Model.find({
    _id: { $in: ids },
    orgId,
    deletedAt: null
  }).select('_id').lean()

  const allowedIds = new Set(records.map(record => String(record._id)))
  if (allowedIds.size !== ids.length || ids.some(id => !allowedIds.has(id))) {
    throw new Error(`${entity} target was not found in this organization`)
  }

  return ids
}
