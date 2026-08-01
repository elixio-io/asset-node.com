
import { Status, DEFAULT_SYSTEM_STATUSES } from '../../models/Status'
import type { SystemStatusSlug } from '../../models/Status'



const cache = new Map<string, Map<string, string>>()

export async function resolveStatusId(orgId: string, slug: SystemStatusSlug): Promise<string> {
  let orgCache = cache.get(orgId)
  if (orgCache?.has(slug)) return orgCache.get(slug)!

  let status = await Status.findOne({ orgId, slug }).select('_id').lean()

  if (!status) {
    await seedSystemStatuses(orgId)
    status = await Status.findOne({ orgId, slug }).select('_id').lean()
  }

  if (!status) {
    throw new Error(`System status '${slug}' not found for org ${orgId} even after seeding.`)
  }

  if (!orgCache) {
    orgCache = new Map()
    cache.set(orgId, orgCache)
  }
  orgCache.set(slug, String(status._id))
  return String(status._id)
}

export async function resolveStatusIds(
  orgId: string,
  slugs: SystemStatusSlug[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const slug of slugs) {
    result[slug] = await resolveStatusId(orgId, slug)
  }
  return result
}

export async function tryResolveStatusId(orgId: string, slug: string): Promise<string | null> {
  let orgCache = cache.get(orgId)
  if (orgCache?.has(slug)) return orgCache.get(slug)!

  const status = await Status.findOne({ orgId, slug }).select('_id').lean()
  if (!status) return null

  if (!orgCache) {
    orgCache = new Map()
    cache.set(orgId, orgCache)
  }
  orgCache.set(slug, String(status._id))
  return String(status._id)
}

export function clearStatusCache(orgId?: string): void {
  if (orgId) cache.delete(orgId)
  else cache.clear()
}

export async function seedSystemStatuses(orgId: string): Promise<void> {
  for (const def of DEFAULT_SYSTEM_STATUSES) {
    const bySlug = await Status.findOne({ orgId, slug: def.slug }).lean()
    if (bySlug) continue

    const byName = await Status.findOne({ orgId, name: def.name }).lean()
    if (byName) {
      await Status.updateOne(
        { _id: byName._id },
        { $set: { slug: def.slug, isSystem: def.isSystem } }
      )
      continue
    }

    await Status.create({ orgId, ...def })
  }
  clearStatusCache(orgId)
}
