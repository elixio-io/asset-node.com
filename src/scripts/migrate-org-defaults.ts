
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Organization } from '../models/Organization'
import { Category } from '../models/Category'
import { Manufacturer } from '../models/Manufacturer'
import { Department } from '../models/Department'
import { createOrgDefaults } from '../server/services/orgDefaults'

dotenv.config()

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

    const [catCount, mfrCount, deptCount] = await Promise.all([
      Category.countDocuments({ orgId }),
      Manufacturer.countDocuments({ orgId }),
      Department.countDocuments({ orgId }),
    ])

    console.log(`  📊 Current: ${catCount} categories, ${mfrCount} manufacturers, ${deptCount} departments`)

    await createOrgDefaults(orgId)

    const [newCatCount, newMfrCount, newDeptCount] = await Promise.all([
      Category.countDocuments({ orgId }),
      Manufacturer.countDocuments({ orgId }),
      Department.countDocuments({ orgId }),
    ])

    const createdCats = newCatCount - catCount
    const createdMfrs = newMfrCount - mfrCount
    const createdDepts = newDeptCount - deptCount

    if (createdCats > 0) console.log(`  🌱 Created ${createdCats} default categories`)
    if (createdMfrs > 0) console.log(`  🌱 Created ${createdMfrs} default manufacturers`)
    if (createdDepts > 0) console.log(`  🌱 Created ${createdDepts} default departments`)

    if (createdCats === 0 && createdMfrs === 0 && createdDepts === 0) {
      console.log(`  ✓ All defaults already present`)
    }
  }

  console.log('\n✅ Migration complete')
  await mongoose.disconnect()
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
