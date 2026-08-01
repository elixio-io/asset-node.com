import type { Model } from 'mongoose'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'

/**
 * Reconcile asset indexes whose live options have drifted from the schema.
 *
 * Mongoose only ever CREATES indexes. It never alters one whose options
 * changed, and `createIndex` with an existing key pattern but different
 * options fails with IndexOptionsConflict (85), which autoIndex swallows. So
 * every options change ever made to these schemas is still missing from any
 * database that predates it — the old index just quietly stays in force.
 *
 * Every entry below is the same failure: a unique index that also indexes
 * documents where the field is absent, so the SECOND doc without that field
 * collides with the first (E11000 → HTTP 409 "already exists").
 *
 * Idempotent: an index is dropped only while it still has the stale shape, and
 * createIndex is a no-op once the desired variant exists.
 */

type IndexFix = {
  name: string
  key: Record<string, 1 | -1>
  options: Record<string, unknown>
  isStale: (live: any) => boolean
  reason: string
  /**
   * Field carrying the uniqueness constraint. Set it whenever `options.unique`
   * is set: the field is checked for pre-existing duplicates before anything is
   * dropped, because a unique index that cannot build would otherwise leave the
   * collection with no index on that key at all.
   */
  uniqueOn?: string
}

const FIXES: { model: Model<any>; indexes: IndexFix[] }[] = [
  {
    model: Hardware,
    indexes: [
      {
        // A compound SPARSE index only skips a doc when EVERY indexed field is
        // missing; orgId is always present, so tagless assets indexed as null.
        name: 'orgId_1_assetTag_1',
        key: { orgId: 1, assetTag: 1 },
        options: { unique: true, partialFilterExpression: { assetTag: { $type: 'string' } } },
        isStale: live => !live.partialFilterExpression,
        reason: 'sparse → partial (tagless assets collided)',
        uniqueOn: 'assetTag'
      },
      {
        // Shipped unique + non-sparse in the initial schema; 645001f
        // (2026-04-06) relaxed it to plain sparse because "some assets have no
        // SN", but nothing dropped the original, so older databases still
        // reject the second asset saved without a serial number.
        //
        // Neither shape is what we want: non-sparse unique rejects the second
        // serial-less asset, plain sparse stops catching genuine duplicates
        // (and no route checks for them — both rely on E11000). Unique+partial
        // over real strings gives us both.
        name: 'orgId_1_serialNumber_1',
        key: { orgId: 1, serialNumber: 1 },
        options: { unique: true, partialFilterExpression: { serialNumber: { $type: 'string' } } },
        isStale: live => !live.partialFilterExpression,
        reason: 'unique non-sparse → unique partial (assets without a serial number collided)',
        uniqueOn: 'serialNumber'
      }
    ]
  },
  {
    model: Peripheral,
    indexes: [
      {
        // Same history as Hardware's serial index, relaxed in the same commit.
        name: 'orgId_1_serialNumber_1',
        key: { orgId: 1, serialNumber: 1 },
        options: { unique: true, partialFilterExpression: { serialNumber: { $type: 'string' } } },
        isStale: live => !live.partialFilterExpression,
        reason: 'unique non-sparse → unique partial (peripherals without a serial number collided)',
        uniqueOn: 'serialNumber'
      }
    ]
  }
]

/**
 * Values that would violate `fix`'s unique constraint if it were built now.
 *
 * Scoped by the index's own partialFilterExpression so the check covers exactly
 * the documents the index will cover — including soft-deleted ones, which still
 * occupy the index even though the soft-delete plugin hides them from every
 * model-level query.
 */
async function findBlockingDuplicates(collection: any, fix: IndexFix) {
  const scope = (fix.options.partialFilterExpression as Record<string, unknown>) ?? {}
  return collection.aggregate([
    { $match: scope },
    { $group: { _id: { orgId: '$orgId', value: `$${fix.uniqueOn}` }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
    { $project: { _id: 0, value: '$_id.value', count: 1 } }
  ]).toArray()
}

export async function fixAssetIndexes(): Promise<void> {
  for (const { model, indexes } of FIXES) {
    const collection = model.collection

    let live: any[]
    try {
      live = await collection.indexes()
    } catch (err: any) {
      // A collection that does not exist yet has nothing to reconcile;
      // autoIndex builds the current schema shape on first write.
      console.warn(`⚠️ [Migration] could not read ${collection.collectionName} indexes (non-fatal):`, err?.message ?? err)
      continue
    }

    for (const fix of indexes) {
      try {
        const existing = live.find(index => index.name === fix.name)
        const stale = existing && fix.isStale(existing)

        if (stale && fix.uniqueOn) {
          // Check BEFORE dropping. dropIndex + a createIndex that then fails on
          // pre-existing duplicates would leave the collection with no index on
          // this key, silently degrading every query that relies on it.
          const duplicates = await findBlockingDuplicates(collection, fix)
          if (duplicates.length > 0) {
            const sample = duplicates.map((d: any) => `${d.value} ×${d.count}`).join(', ')
            console.warn(
              `⚠️ [Migration] SKIPPED ${collection.collectionName}.${fix.name}: ` +
              `existing duplicate ${fix.uniqueOn} values block the unique index (${sample}). ` +
              `Index left as-is; resolve the duplicates and restart to apply.`
            )
            continue
          }
        }

        if (stale) {
          await collection.dropIndex(fix.name)
          console.log(`⚡ [Migration] dropped stale ${collection.collectionName}.${fix.name}: ${fix.reason}`)
        }
        await collection.createIndex(fix.key as any, fix.options)
      } catch (err: any) {
        console.warn(`⚠️ [Migration] ${collection.collectionName}.${fix.name} fix failed (non-fatal):`, err?.message ?? err)
      }
    }
  }
}
