
import { Category, DEFAULT_SYSTEM_CATEGORIES } from '../../models/Category'
import { Manufacturer, DEFAULT_SYSTEM_MANUFACTURERS } from '../../models/Manufacturer'
import { Department, DEFAULT_SYSTEM_DEPARTMENTS } from '../../models/Department'
import { seedSystemStatuses } from './statusResolver'

export async function createOrgDefaults(orgId: string): Promise<void> {
  const [catCount, mfrCount, deptCount] = await Promise.all([
    Category.countDocuments({ orgId }),
    Manufacturer.countDocuments({ orgId }),
    Department.countDocuments({ orgId }),
  ])

  await Promise.all([
    catCount  === 0 ? Category.insertMany(DEFAULT_SYSTEM_CATEGORIES.map(c => ({ ...c, orgId })))        : backfillCategorySlugs(orgId),
    mfrCount  === 0 ? Manufacturer.insertMany(DEFAULT_SYSTEM_MANUFACTURERS.map(m => ({ ...m, orgId }))) : Promise.resolve(),
    deptCount === 0 ? Department.insertMany(DEFAULT_SYSTEM_DEPARTMENTS.map(d => ({ ...d, orgId })))     : Promise.resolve(),
    seedSystemStatuses(orgId),
  ])
}

// Categories created before the slug field existed have none, which breaks
// slug-based lookups (e.g. the demo data seeder). Match them to the system
// defaults by name + entityType and fill in the missing slug.
async function backfillCategorySlugs(orgId: string): Promise<void> {
  await Promise.all(DEFAULT_SYSTEM_CATEGORIES.map(c =>
    Category.updateOne(
      { orgId, name: c.name, entityType: c.entityType, slug: { $in: [null, ''] } },
      { $set: { slug: c.slug } }
    )
  ))
}
