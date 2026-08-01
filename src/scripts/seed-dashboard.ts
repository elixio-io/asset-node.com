
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../db/connection'
import { Hardware } from '../models/Hardware'
import { Employee } from '../models/Employee'
import { Assignment } from '../models/Assignment'
import { SoftwareLicense } from '../models/SoftwareLicense'
import { Consumable } from '../models/Consumable'
import { MaintenanceRecord } from '../models/MaintenanceRecord'
import { Audit } from '../models/Audit'
import { AuditLog } from '../models/AuditLog'


function randomEl<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000)
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}


const firstNames = [
  'Emma', 'Liam', 'Sophia', 'Noah', 'Olivia', 'James', 'Ava', 'Lucas',
  'Mia', 'Ethan', 'Isabella', 'Mason', 'Charlotte', 'Logan', 'Amelia',
  'Alexander', 'Harper', 'Benjamin', 'Evelyn', 'Daniel', 'Luna', 'Henry',
  'Chloe', 'Sebastian'
]

const lastNames = [
  'Anderson', 'Brown', 'Chen', 'Davis', 'Evans', 'Fischer', 'Garcia',
  'Hughes', 'Ibrahim', 'Johnson', 'Kim', 'Liu', 'Martinez', 'Nakamura',
  'Olsen', 'Park', 'Quinn', 'Rodriguez', 'Smith', 'Thomson', 'Ueda',
  'Vasquez', 'Wang', 'Yamamoto'
]

const departments = ['Engineering', 'Design', 'Sales', 'Marketing', 'Operations']
const jobTitles = [
  'Software Engineer', 'Senior Developer', 'Product Designer', 'UX Researcher',
  'Sales Manager', 'Account Executive', 'Marketing Lead', 'Content Strategist',
  'DevOps Engineer', 'QA Engineer', 'Data Analyst', 'Project Manager'
]

const manufacturers: Record<string, string[]> = {
  laptop: ['Apple', 'Dell', 'Lenovo', 'HP', 'Microsoft'],
  desktop: ['Dell', 'HP', 'Lenovo', 'Custom Build'],
  monitor: ['Dell', 'LG', 'Samsung', 'BenQ', 'ASUS'],
  phone: ['Apple', 'Samsung', 'Google', 'OnePlus'],
  tablet: ['Apple', 'Samsung', 'Microsoft', 'Lenovo'],
  server: ['Dell', 'HPE', 'Supermicro', 'Lenovo'],
  networking: ['Cisco', 'Ubiquiti', 'Netgear', 'Meraki'],
  printer: ['HP', 'Brother', 'Canon', 'Epson'],
  other: ['Logitech', 'Jabra', 'Poly', 'Elgato']
}

const models: Record<string, string[]> = {
  laptop: ['MacBook Pro 14"', 'MacBook Air M3', 'ThinkPad X1 Carbon', 'XPS 15', 'Dell Latitude 7440', 'Surface Laptop 5', 'HP EliteBook 850'],
  desktop: ['OptiPlex 7010', 'ThinkCentre M90q', 'HP ProDesk 400', 'Custom Workstation'],
  monitor: ['UltraSharp U2723QE', 'LG 27UK850', 'Samsung S34J550', 'BenQ PD2700U'],
  phone: ['iPhone 15 Pro', 'iPhone 14', 'Pixel 8', 'Galaxy S24', 'OnePlus 12'],
  tablet: ['iPad Pro 12.9"', 'iPad Air', 'Galaxy Tab S9', 'Surface Pro 9'],
  server: ['PowerEdge R750', 'ProLiant DL380', 'ThinkSystem SR650'],
  networking: ['Catalyst 9300', 'UniFi Dream Machine', 'MR46 Access Point'],
  printer: ['LaserJet Pro M404', 'HL-L2370DW', 'PIXMA TR8620'],
  other: ['MX Keys', 'Evolve2 85', 'Studio P5 Webcam', 'Stream Deck XL']
}

const priceRanges: Record<string, [number, number]> = {
  laptop: [899, 3499], desktop: [599, 2499], monitor: [299, 1299],
  phone: [399, 1599], tablet: [449, 1899], server: [2999, 12999],
  networking: [149, 2999], printer: [149, 999], other: [29, 499]
}

const statusDistribution: { status: string; weight: number }[] = [
  { status: 'available', weight: 20 },
  { status: 'assigned', weight: 45 },
  { status: 'defective', weight: 5 },
  { status: 'forSale', weight: 3 },
  { status: 'inRepair', weight: 7 },
  { status: 'retired', weight: 8 },
  { status: 'lost', weight: 2 },
  { status: 'disposed', weight: 4 },
  { status: 'onOrder', weight: 6 }
]

function weightedStatus(): string {
  const total = statusDistribution.reduce((s, d) => s + d.weight, 0)
  let r = Math.random() * total
  for (const d of statusDistribution) {
    r -= d.weight
    if (r <= 0) return d.status
  }
  return 'available'
}

const categoryDistribution = [
  { cat: 'laptop', weight: 30 },
  { cat: 'desktop', weight: 10 },
  { cat: 'monitor', weight: 20 },
  { cat: 'phone', weight: 12 },
  { cat: 'tablet', weight: 5 },
  { cat: 'server', weight: 4 },
  { cat: 'networking', weight: 6 },
  { cat: 'printer', weight: 5 },
  { cat: 'other', weight: 8 }
]

function weightedCategory(): string {
  const total = categoryDistribution.reduce((s, d) => s + d.weight, 0)
  let r = Math.random() * total
  for (const d of categoryDistribution) {
    r -= d.weight
    if (r <= 0) return d.cat
  }
  return 'laptop'
}


const licenseData = [
  { name: 'Microsoft 365 Business', publisher: 'Microsoft', category: 'productivity', type: 'subscription', seats: 30, cost: 22, billing: 'monthly' },
  { name: 'Adobe Creative Cloud', publisher: 'Adobe', category: 'design', type: 'subscription', seats: 8, cost: 55, billing: 'monthly' },
  { name: 'Slack Business+', publisher: 'Salesforce', category: 'communication', type: 'subscription', seats: 50, cost: 12.50, billing: 'monthly' },
  { name: 'GitHub Enterprise', publisher: 'GitHub', category: 'development', type: 'subscription', seats: 20, cost: 21, billing: 'monthly' },
  { name: 'Figma Organization', publisher: 'Figma', category: 'design', type: 'subscription', seats: 10, cost: 45, billing: 'monthly' },
  { name: 'Jira Software Premium', publisher: 'Atlassian', category: 'development', type: 'subscription', seats: 25, cost: 14, billing: 'monthly' },
  { name: 'Windows 11 Enterprise', publisher: 'Microsoft', category: 'operating-system', type: 'volume', seats: 60, cost: 0, billing: 'one-time' },
  { name: 'macOS Sonoma', publisher: 'Apple', category: 'operating-system', type: 'freeware', seats: -1, cost: 0, billing: 'one-time' },
  { name: 'CrowdStrike Falcon', publisher: 'CrowdStrike', category: 'security', type: 'subscription', seats: 40, cost: 8.99, billing: 'monthly' },
  { name: 'Zoom Business', publisher: 'Zoom', category: 'communication', type: 'subscription', seats: 30, cost: 18.32, billing: 'monthly' },
  { name: 'JetBrains All Products', publisher: 'JetBrains', category: 'development', type: 'subscription', seats: 12, cost: 77.90, billing: 'annual' },
  { name: 'AWS Reserved Instances', publisher: 'Amazon', category: 'cloud', type: 'subscription', seats: 1, cost: 2400, billing: 'annual' }
]


const consumableData = [
  { name: 'USB-C Cable 2m', category: 'cable', qty: 45, min: 20, cost: 12.99 },
  { name: 'USB-C to HDMI Adapter', category: 'adapter', qty: 8, min: 10, cost: 24.99 },
  { name: 'AA Batteries (4-pack)', category: 'battery', qty: 3, min: 15, cost: 6.49 },
  { name: 'HP 58A Toner Cartridge', category: 'ink-toner', qty: 2, min: 5, cost: 89.99 },
  { name: 'Keyboard Wipes (100ct)', category: 'cleaning', qty: 12, min: 5, cost: 8.99 },
  { name: 'External SSD 1TB', category: 'storage-media', qty: 4, min: 3, cost: 79.99 },
  { name: 'Precision Screwdriver Set', category: 'tool', qty: 6, min: 2, cost: 34.99 },
  { name: 'RAM Module DDR5 16GB', category: 'component', qty: 1, min: 5, cost: 64.99 }
]


async function seed() {
  await connectDB()

  const User = mongoose.model('User')
  const Organization = mongoose.model('Organization')

  const user = await User.findOne({ email: 'admin@assetnode.com' }).lean() as any
  if (!user) {
    console.error('❌ User admin@assetnode.com not found. Log in first to create the account.')
    process.exit(1)
  }

  const org = await Organization.findById(user.orgId).lean() as any
  if (!org) {
    console.error('❌ Organization not found for user.')
    process.exit(1)
  }

  const orgId = org._id
  const userId = user._id
  const userEmail = user.email

  console.log(`\n🌱 Seeding data for org "${org.name}" (${orgId})...\n`)

  console.log('👥 Creating employees...')
  const employeeIds: mongoose.Types.ObjectId[] = []

  for (let i = 0; i < 24; i++) {
    const firstName = firstNames[i]
    const lastName = lastNames[i]
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${org.name?.toLowerCase().replace(/\s/g, '') || 'company'}.com`

    try {
      const emp = await Employee.create({
        orgId,
        firstName,
        lastName,
        email,
        department: randomEl(departments),
        jobTitle: randomEl(jobTitles),
        startDate: randomDate(daysAgo(1095), daysAgo(30)),
        isActive: i < 22,
        offboardingStatus: i >= 22 ? 'pending' : undefined
      })
      employeeIds.push(emp._id as mongoose.Types.ObjectId)
    } catch (err: any) {
      if (err.code === 11000) {
        const existing = await Employee.findOne({ orgId, email }).lean() as any
        if (existing) employeeIds.push(existing._id)
        continue
      }
      throw err
    }
  }
  console.log(`   ✅ ${employeeIds.length} employees ready`)

  console.log('💻 Creating hardware assets...')
  const hardwareIds: mongoose.Types.ObjectId[] = []
  const assignedHardwareIds: mongoose.Types.ObjectId[] = []

  for (let i = 0; i < 87; i++) {
    const category = weightedCategory()
    const status = weightedStatus()
    const manufacturer = randomEl(manufacturers[category] || ['Generic'])
    const model = randomEl(models[category] || ['Standard Model'])
    const [minPrice, maxPrice] = priceRanges[category] || [100, 1000]
    const purchasePrice = randomBetween(minPrice, maxPrice)
    const purchaseDate = randomDate(daysAgo(1095), daysAgo(30))

    let warrantyExpiry: Date | undefined
    const warrantyRoll = Math.random()
    if (warrantyRoll < 0.15) {
      warrantyExpiry = randomDate(daysAgo(180), daysAgo(1))
    } else if (warrantyRoll < 0.30) {
      warrantyExpiry = randomDate(daysFromNow(1), daysFromNow(90))
    } else if (warrantyRoll < 0.85) {
      warrantyExpiry = randomDate(daysFromNow(91), daysFromNow(730))
    }

    const sn = `SN-${category.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(4, '0')}-${randomBetween(1000, 9999)}`

    try {
      const hw = await Hardware.create({
        orgId,
        serialNumber: sn,
        model,
        category,
        manufacturer,
        status: status === 'assigned' ? 'available' : status,
        purchaseDate,
        purchasePrice,
        warrantyExpiry,
        assignedTo: null
      })
      hardwareIds.push(hw._id as mongoose.Types.ObjectId)
      if (status === 'assigned') {
        assignedHardwareIds.push(hw._id as mongoose.Types.ObjectId)
      }
    } catch (err: any) {
      if (err.code === 11000) continue
      throw err
    }
  }
  console.log(`   ✅ ${hardwareIds.length} hardware assets created`)

  console.log('🔗 Creating assignments...')
  let assignmentCount = 0

  for (let i = 0; i < Math.min(assignedHardwareIds.length, 18); i++) {
    const empId = randomEl(employeeIds)
    const hwId = assignedHardwareIds[i]
    const assignmentDate = randomDate(daysAgo(365), daysAgo(7))

    let status: 'active' | 'pendingReturn' = 'active'
    let returnRequestedAt: Date | undefined
    if (Math.random() < 0.2) {
      status = 'pendingReturn'
      returnRequestedAt = Math.random() < 0.5
        ? randomDate(daysAgo(14), daysAgo(1))
        : randomDate(daysFromNow(1), daysFromNow(14))
    }

    try {
      await Assignment.create({
        orgId,
        employeeId: empId,
        hardware: [hwId],
        assignmentDate,
        status,
        returnRequestedAt
      })
      assignmentCount++
    } catch {
      continue
    }
  }
  console.log(`   ✅ ${assignmentCount} assignments created`)

  console.log('📜 Creating software licenses...')
  let licenseCount = 0

  for (const lic of licenseData) {
    let expirationDate: Date | undefined
    const expRoll = Math.random()
    if (lic.type === 'subscription') {
      if (expRoll < 0.15) {
        expirationDate = randomDate(daysAgo(60), daysAgo(1))
      } else if (expRoll < 0.35) {
        expirationDate = randomDate(daysFromNow(1), daysFromNow(30))
      } else {
        expirationDate = randomDate(daysFromNow(31), daysFromNow(365))
      }
    }

    try {
      await SoftwareLicense.create({
        orgId,
        name: lic.name,
        publisher: lic.publisher,
        category: lic.category,
        licenseType: lic.type,
        totalSeats: lic.seats,
        costPerSeat: lic.cost,
        billingCycle: lic.billing,
        purchaseDate: randomDate(daysAgo(730), daysAgo(30)),
        expirationDate,
        isActive: true
      })
      licenseCount++
    } catch {
      continue
    }
  }
  console.log(`   ✅ ${licenseCount} licenses created`)

  console.log('📦 Creating consumables...')
  let consumableCount = 0

  for (const con of consumableData) {
    try {
      await Consumable.create({
        orgId,
        name: con.name,
        category: con.category,
        totalQuantity: con.qty,
        minimumQuantity: con.min,
        unitCost: con.cost,
        purchaseDate: randomDate(daysAgo(365), daysAgo(7)),
        isActive: true
      })
      consumableCount++
    } catch {
      continue
    }
  }
  console.log(`   ✅ ${consumableCount} consumables created`)

  console.log('🔧 Creating maintenance records...')
  const maintenanceTypes = ['repair', 'preventive', 'upgrade', 'inspection'] as const
  const maintenanceStatuses = ['scheduled', 'inProgress', 'completed'] as const
  let maintenanceCount = 0

  for (let i = 0; i < 6; i++) {
    const hwId = randomEl(hardwareIds)
    const mStatus = i < 3 ? randomEl(['scheduled', 'inProgress'] as const) : 'completed'

    try {
      await MaintenanceRecord.create({
        orgId,
        hardware: hwId,
        type: randomEl(maintenanceTypes),
        description: randomEl([
          'Replace damaged screen', 'Scheduled preventive maintenance',
          'RAM upgrade to 32GB', 'Annual hardware inspection',
          'Fan replacement due to overheating', 'Battery replacement'
        ]),
        performedBy: randomEl(['IT Support', 'AppleCare', 'Dell ProSupport', 'Internal Technician']),
        cost: randomBetween(50, 800),
        startDate: mStatus === 'completed' ? daysAgo(randomBetween(7, 60)) : daysAgo(randomBetween(0, 14)),
        completionDate: mStatus === 'completed' ? daysAgo(randomBetween(1, 6)) : undefined,
        status: mStatus
      })
      maintenanceCount++
    } catch {
      continue
    }
  }
  console.log(`   ✅ ${maintenanceCount} maintenance records created`)

  console.log('📋 Creating audits...')
  const auditData = [
    { name: 'Q1 2026 Hardware Audit', status: 'completed', due: daysAgo(30) },
    { name: 'Q2 2026 Engineering Audit', status: 'inProgress', due: daysAgo(5) },
    { name: 'April Security Check', status: 'scheduled', due: daysFromNow(12) },
    { name: 'Annual Compliance Audit', status: 'scheduled', due: daysAgo(3) }
  ]
  let auditCount = 0

  for (const a of auditData) {
    try {
      await Audit.create({
        orgId,
        name: a.name,
        schedule: 'oneTime',
        targetType: 'all',
        status: a.status,
        dueDate: a.due,
        completedAt: a.status === 'completed' ? daysAgo(28) : undefined,
        createdBy: userId
      })
      auditCount++
    } catch {
      continue
    }
  }
  console.log(`   ✅ ${auditCount} audits created`)

  console.log('📝 Creating audit log entries...')
  const actions = ['create', 'update', 'assign', 'unassign', 'status_change'] as const
  const entityTypes = ['hardware', 'employee', 'license', 'consumable', 'assignment']
  let logCount = 0

  for (let i = 0; i < 30; i++) {
    const action = randomEl(actions)
    const entityType = randomEl(entityTypes)
    const timestamp = randomDate(daysAgo(14), new Date())

    try {
      await AuditLog.create({
        orgId,
        action,
        entityType,
        entityId: randomEl(hardwareIds).toString(),
        userId,
        userEmail,
        timestamp,
        changes: {
          after: {
            status: randomEl(['available', 'assigned', 'defective', 'inRepair', 'retired', 'disposed', 'lost', 'forSale', 'onOrder']),
            ...(action === 'update' ? { model: 'Updated model' } : {})
          }
        }
      })
      logCount++
    } catch {
      continue
    }
  }
  console.log(`   ✅ ${logCount} audit log entries created`)

  console.log(`
╔══════════════════════════════════════════╗
║         🎉 SEED COMPLETE!               ║
╠══════════════════════════════════════════╣
║  Employees:      ${String(employeeIds.length).padStart(3)}                     ║
║  Hardware:       ${String(hardwareIds.length).padStart(3)}                     ║
║  Assignments:    ${String(assignmentCount).padStart(3)}                     ║
║  Licenses:       ${String(licenseCount).padStart(3)}                     ║
║  Consumables:    ${String(consumableCount).padStart(3)}                     ║
║  Maintenance:    ${String(maintenanceCount).padStart(3)}                     ║
║  Audits:         ${String(auditCount).padStart(3)}                     ║
║  Activity Logs:  ${String(logCount).padStart(3)}                     ║
╚══════════════════════════════════════════╝

Refresh the dashboard at http://localhost:5173/dashboard
`)

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
