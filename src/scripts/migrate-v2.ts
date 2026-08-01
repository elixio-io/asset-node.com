import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hardware-manager'

async function migrate() {
  console.log('🚀 Starting v2 migration...')
  console.log(`   Connecting to ${MONGO_URI}`)

  await mongoose.connect(MONGO_URI)
  console.log('✅ Connected to MongoDB')

  const db = mongoose.connection.db
  if (!db) throw new Error('Database connection not initialized')


  const hardware = db.collection('hardwares')
  const hardwareCount = await hardware.countDocuments()
  console.log(`\n📦 Found ${hardwareCount} hardware documents`)

  const macBookProResult = await hardware.updateMany(
    { type: 'MacBook Pro' },
    {
      $set: { category: 'laptop', manufacturer: 'Apple' },
      $unset: { type: '' }
    }
  )
  console.log(`   MacBook Pro → laptop/Apple: ${macBookProResult.modifiedCount} updated`)

  const macBookAirResult = await hardware.updateMany(
    { type: 'MacBook Air' },
    {
      $set: { category: 'laptop', manufacturer: 'Apple' },
      $unset: { type: '' }
    }
  )
  console.log(`   MacBook Air → laptop/Apple: ${macBookAirResult.modifiedCount} updated`)

  const tagsResult = await hardware.updateMany(
    { tags: { $exists: false } },
    { $set: { tags: [] } }
  )
  console.log(`   Added tags: ${tagsResult.modifiedCount} docs`)

  const cfResult = await hardware.updateMany(
    { customFields: { $exists: false } },
    { $set: { customFields: {} } }
  )
  console.log(`   Added customFields: ${cfResult.modifiedCount} docs`)

  const legacyTypeResult = await hardware.updateMany(
    { type: { $exists: true }, category: { $exists: false } },
    {
      $set: { category: 'other', manufacturer: 'Unknown' },
      $unset: { type: '' }
    }
  )
  if (legacyTypeResult.modifiedCount > 0) {
    console.log(`   Legacy types → other: ${legacyTypeResult.modifiedCount} updated`)
  }


  const peripherals = db.collection('peripherals')
  const peripheralCount = await peripherals.countDocuments()
  console.log(`\n🔌 Found ${peripheralCount} peripheral documents`)

  const statusResult = await peripherals.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'available' } }
  )
  console.log(`   Added status: ${statusResult.modifiedCount} docs`)


  console.log('\n✅ Migration complete!')

  const verifyCategories = await hardware.distinct('category')
  const verifyStatuses = await hardware.distinct('status')
  const remainingTypes = await hardware.countDocuments({ type: { $exists: true } })

  console.log(`\n📊 Verification:`)
  console.log(`   Categories in use: ${verifyCategories.join(', ') || '(none)'}`)
  console.log(`   Statuses in use: ${verifyStatuses.join(', ') || '(none)'}`)
  console.log(`   Remaining 'type' fields: ${remainingTypes}`)

  await mongoose.disconnect()
  console.log('\n👋 Disconnected from MongoDB')
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})
