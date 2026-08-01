
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Organization } from '../models/Organization'
import { Status, DEFAULT_SYSTEM_STATUSES } from '../models/Status'
import { seedSystemStatuses } from '../server/services/statusResolver'

dotenv.config()

const NAME_TO_SLUG: Record<string, string> = {
  'einsatzbereit': 'available',
  'verfügbar': 'available',
  'available': 'available',
  'zugewiesen': 'assigned',
  'assigned': 'assigned',
  'defekt': 'defective',
  'defective': 'defective',
  'in reparatur': 'in-repair',
  'in repair': 'in-repair',
  'ausgemustert': 'retired',
  'retired': 'retired',
  'zum verkauf': 'for-sale',
  'for sale': 'for-sale',
  'verloren': 'lost',
  'lost': 'lost',
  'entsorgt': 'disposed',
  'disposed': 'disposed',
  'bestellt': 'on-order',
  'on order': 'on-order',
}

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) {
    console.error('❌ No MONGODB_URI or DATABASE_URL set')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('✅ Connected to MongoDB')

  const orgs = await Organization.find({}).select('_id name').lean()
  console.log(`📋 Found ${orgs.length} organization(s)\n`)

  for (const org of orgs) {
    const orgId = String(org._id)
    console.log(`\n─── Processing: ${org.name || orgId} ───`)

    const existingStatuses = await Status.find({ orgId }).lean()
    let matched = 0

    for (const status of existingStatuses) {
      if (status.slug) continue

      const normalizedName = status.name.toLowerCase().trim()
      const matchedSlug = NAME_TO_SLUG[normalizedName]

      if (matchedSlug) {
        const slugTaken = existingStatuses.some(
          s => s.slug === matchedSlug && String(s._id) !== String(status._id)
        )
        if (!slugTaken) {
          await Status.updateOne(
            { _id: status._id },
            { $set: { slug: matchedSlug, isSystem: true } }
          )
          console.log(`  ✅ Matched "${status.name}" → slug: "${matchedSlug}"`)
          matched++
        }
      }
    }

    if (matched > 0) {
      console.log(`  📎 Matched ${matched} existing status(es) by name`)
    }

    const beforeCount = await Status.countDocuments({ orgId, slug: { $exists: true, $ne: null } })
    await seedSystemStatuses(orgId)
    const afterCount = await Status.countDocuments({ orgId, slug: { $exists: true, $ne: null } })
    const created = afterCount - beforeCount

    if (created > 0) {
      console.log(`  🌱 Seeded ${created} missing system status(es)`)
    } else {
      console.log(`  ✓ All ${DEFAULT_SYSTEM_STATUSES.length} system statuses present`)
    }
  }

  console.log('\n✅ Migration complete')
  await mongoose.disconnect()
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
