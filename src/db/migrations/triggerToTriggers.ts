import { Workflow } from '../../models/Workflow'

/**
 * Migrate the legacy single `trigger` object into the `triggers[]` array.
 *
 * Idempotent: only touches documents that have a legacy `trigger` but no
 * `triggers` array yet. Safe to run on every server boot. Runs BEFORE the
 * event bus / cron register (which now query `triggers.*`), so an active
 * event/cron/webhook workflow keeps firing across a deploy rather than going
 * silent until it happens to be re-saved.
 *
 * Reads via the raw driver collection because `trigger` is no longer in the
 * Mongoose schema — hydrated reads would drop it, but the raw doc still has it.
 */
export async function migrateTriggerToTriggers(): Promise<number> {
  const collection = Workflow.collection
  const legacy = await collection
    .find({ trigger: { $exists: true }, triggers: { $exists: false } })
    .toArray()

  let migrated = 0
  for (const doc of legacy) {
    const trigger = (doc as any).trigger || {}
    const triggerNode = Array.isArray((doc as any).nodes)
      ? (doc as any).nodes.find((n: any) => String(n?.type || '').startsWith('trigger-'))
      : undefined

    const entry: Record<string, unknown> = {
      nodeId: triggerNode?.id || 'trigger',
      type: trigger.type || 'manual'
    }
    if (trigger.event) entry.event = trigger.event
    if (trigger.cron) entry.cron = trigger.cron
    if (trigger.cronLabel) entry.cronLabel = trigger.cronLabel
    if (trigger.webhookId) entry.webhookId = trigger.webhookId
    if (trigger.method) entry.method = trigger.method

    await collection.updateOne(
      { _id: doc._id },
      { $set: { triggers: [entry] }, $unset: { trigger: 1 } }
    )
    migrated++
  }

  if (migrated > 0) {
    console.log(`⚡ [Migration] trigger → triggers[]: migrated ${migrated} workflow(s)`)
  }
  return migrated
}
