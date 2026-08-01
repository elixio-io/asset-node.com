import crypto from 'crypto'
import { Assignment } from '../../models/Assignment'
import { AuditResponse } from '../../models/AuditResponse'
import { Available } from '../../models/Available'
import { BuybackQuote } from '../../models/BuybackQuote'
import { Category } from '../../models/Category'
import { Component } from '../../models/Component'
import { Consumable } from '../../models/Consumable'
import { Department } from '../../models/Department'
import { Depreciation } from '../../models/Depreciation'
import { Employee } from '../../models/Employee'
import { Hardware } from '../../models/Hardware'
import { MaintenanceRecord } from '../../models/MaintenanceRecord'
import { Manufacturer } from '../../models/Manufacturer'
import { Organization } from '../../models/Organization'
import { Peripheral } from '../../models/Peripheral'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Status } from '../../models/Status'
import { Workflow } from '../../models/Workflow'
import { createOrgDefaults } from './orgDefaults'

export const DEMO_SEED_VERSION = 2
export const DEMO_EMAIL_DOMAIN = 'demo.asset-node.invalid'
export const DEMO_MARKER = `[ASSETNODE_DEMO:v${DEMO_SEED_VERSION}]`

const LEGACY_EMPLOYEE_NOTE = '[DEMO] Sample employee'
const LEGACY_HARDWARE_NOTE = '[DEMO] Sample asset — safe to remove'
const LEGACY_LICENSE_NOTE = '[DEMO] Sample license'
const LEGACY_WORKFLOW_DESCRIPTION = 'Shows how a scheduled warranty notification can be automated.'

const EMPLOYEE_EMAILS = [
  `alex.meyer@${DEMO_EMAIL_DOMAIN}`,
  `sara.koch@${DEMO_EMAIL_DOMAIN}`,
  `jonas.weber@${DEMO_EMAIL_DOMAIN}`
]

const HARDWARE_SERIALS = ['DEMO-MBP-001', 'DEMO-MBA-002', 'DEMO-LAT-003', 'DEMO-MON-004', 'DEMO-MBP-005']
const LICENSE_NAME = '[DEMO] Microsoft 365 Business'
const WORKFLOW_NAME = '[DEMO] Warranty expiry alert'

type DemoRecordKey = 'employees' | 'hardware' | 'assignments' | 'licenses' | 'workflows'
export type DemoRecordManifest = Record<DemoRecordKey, string[]>

export class DemoDataConflictError extends Error {
  code: string
  dependencies: string[]

  constructor(message: string, code = 'DEMO_DATA_IN_USE', dependencies: string[] = []) {
    super(message)
    this.name = 'DemoDataConflictError'
    this.code = code
    this.dependencies = dependencies
  }
}

const DEMO_OPERATION_LOCK_MS = 10 * 60 * 1000

async function acquireDemoOperation(orgId: string, type: 'seed' | 'remove') {
  const now = new Date()
  const token = crypto.randomUUID()
  const org = await Organization.findOneAndUpdate({
    _id: orgId,
    $or: [
      { 'settings.demoMode.operationLock.token': { $exists: false } },
      { 'settings.demoMode.operationLock.expiresAt': { $lte: now } },
    ]
  }, {
    $set: {
      'settings.demoMode.operationLock': {
        token,
        type,
        acquiredAt: now,
        expiresAt: new Date(now.getTime() + DEMO_OPERATION_LOCK_MS)
      }
    }
  }, { new: true }).select('settings.wizardCompleted settings.demoMode').lean() as any

  if (!org) {
    const exists = await Organization.exists({ _id: orgId })
    if (!exists) throw new Error('Organization not found')
    throw new DemoDataConflictError(
      'Another demo operation is already running for this organization.',
      'DEMO_OPERATION_IN_PROGRESS'
    )
  }
  return { token, org }
}

async function releaseDemoOperation(orgId: string, token: string) {
  await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': token,
  }, {
    $unset: { 'settings.demoMode.operationLock': 1 }
  })
}

function mergeManifests(...manifests: DemoRecordManifest[]): DemoRecordManifest {
  const merged = emptyManifest()
  for (const key of Object.keys(merged) as DemoRecordKey[]) {
    merged[key] = [...new Set(manifests.flatMap(manifest => manifest[key]))]
  }
  return merged
}

const emptyManifest = (): DemoRecordManifest => ({
  employees: [],
  hardware: [],
  assignments: [],
  licenses: [],
  workflows: []
})

function ids(docs: any[]): string[] {
  return docs.map(doc => String(doc._id))
}

function normalizeManifest(value: any): DemoRecordManifest {
  const manifest = emptyManifest()
  for (const key of Object.keys(manifest) as DemoRecordKey[]) {
    manifest[key] = Array.isArray(value?.[key]) ? value[key].map(String) : []
  }
  return manifest
}

function hasManifestRecords(manifest: DemoRecordManifest): boolean {
  return Object.values(manifest).some(items => items.length > 0)
}

function normalizeRecordVersions(value: unknown): Record<string, number> {
  const raw = value instanceof Map
    ? Object.fromEntries(value.entries())
    : value && typeof (value as any).toObject === 'function'
      ? (value as any).toObject()
      : (value || {})

  const result: Record<string, number> = {}
  for (const [recordId, timestamp] of Object.entries(raw as Record<string, unknown>)) {
    const time = new Date(timestamp as string | number | Date).getTime()
    if (Number.isFinite(time)) result[recordId] = time
  }
  return result
}

async function trackRecoveryRecord(
  orgId: string,
  lockToken: string,
  key: DemoRecordKey,
  record: any
) {
  const recordId = String(record?._id || '')
  const updatedAt = record?.updatedAt ? new Date(record.updatedAt) : null
  if (!recordId || !updatedAt || Number.isNaN(updatedAt.getTime())) {
    throw new DemoDataConflictError(
      'A seeded record has no verifiable version and cannot be claimed by Demo Mode.',
      'DEMO_OWNERSHIP_UNVERIFIED'
    )
  }

  const result = await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': lockToken,
  }, {
    $addToSet: { [`settings.demoMode.recoveryRecords.${key}`]: recordId },
    $set: { [`settings.demoMode.recoveryRecordVersions.${recordId}`]: updatedAt }
  })
  if (result.matchedCount === 0) {
    throw new DemoDataConflictError('Demo operation lock was lost.', 'DEMO_OPERATION_LOCK_LOST')
  }
}

async function readCurrentRecordVersions(orgId: string, manifest: DemoRecordManifest) {
  const [employees, hardware, assignments, licenses, workflows] = await Promise.all([
    Employee.find({ orgId, _id: { $in: manifest.employees } }).select('_id updatedAt').lean(),
    Hardware.find({ orgId, _id: { $in: manifest.hardware } }).select('_id updatedAt').lean(),
    Assignment.find({ orgId, _id: { $in: manifest.assignments } }).select('_id updatedAt').lean(),
    SoftwareLicense.find({ orgId, _id: { $in: manifest.licenses } }).select('_id updatedAt').lean(),
    Workflow.find({ orgId, _id: { $in: manifest.workflows } }).select('_id updatedAt').lean(),
  ])
  const versions: Record<string, number> = {}
  for (const record of [...employees, ...hardware, ...assignments, ...licenses, ...workflows] as any[]) {
    const time = record.updatedAt ? new Date(record.updatedAt).getTime() : Number.NaN
    if (Number.isFinite(time)) versions[String(record._id)] = time
  }
  assertCompleteRecordVersions(manifest, versions)
  return Object.fromEntries(Object.entries(versions).map(([recordId, time]) => [recordId, new Date(time)]))
}

function onlyUnmodified<T extends { _id: unknown; updatedAt?: Date }>(
  documents: T[],
  versions: Record<string, number>
): T[] {
  return documents.filter(document => {
    const expected = versions[String(document._id)]
    const actual = document.updatedAt ? new Date(document.updatedAt).getTime() : Number.NaN
    return expected !== undefined && actual === expected
  })
}

function assertCompleteRecordVersions(manifest: DemoRecordManifest, versions: Record<string, number>) {
  const missing = Object.values(manifest)
    .flat()
    .filter(recordId => versions[recordId] === undefined)
  if (missing.length > 0) {
    throw new DemoDataConflictError(
      'Demo ownership cannot be verified because its record-version snapshot is incomplete.',
      'DEMO_OWNERSHIP_UNVERIFIED'
    )
  }
}

function versionedIdFilter(recordIds: string[], versions: Record<string, number>) {
  if (recordIds.length === 0) return { _id: { $in: [] } }
  return {
    $or: recordIds.map(recordId => ({
      _id: recordId,
      updatedAt: new Date(versions[recordId])
    }))
  }
}

async function resolveOwnedDemoRecords(
  orgId: string,
  stored: DemoRecordManifest,
  recordVersions: Record<string, number>
): Promise<DemoRecordManifest> {
  if (!hasManifestRecords(stored)) return emptyManifest()
  assertCompleteRecordVersions(stored, recordVersions)
  const [employees, hardware, assignments, licenses, workflows] = await Promise.all([
    Employee.find({
      orgId,
      email: { $in: EMPLOYEE_EMAILS },
      notes: { $in: [`${DEMO_MARKER} Sample employee`, LEGACY_EMPLOYEE_NOTE] },
      _id: { $in: stored.employees }
    }).select('_id updatedAt').lean(),
    Hardware.find({
      orgId,
      serialNumber: { $in: HARDWARE_SERIALS },
      $or: [
        { tags: `assetnode-demo-v${DEMO_SEED_VERSION}` },
        { tags: 'demo', notes: LEGACY_HARDWARE_NOTE }
      ],
      _id: { $in: stored.hardware }
    }).select('_id updatedAt').lean(),
    Assignment.find({
      orgId,
      notes: { $regex: /^\[(?:ASSETNODE_DEMO:v2|DEMO)\]/ },
      _id: { $in: stored.assignments }
    }).select('_id updatedAt').lean(),
    SoftwareLicense.find({
      orgId,
      name: LICENSE_NAME,
      notes: { $in: [`${DEMO_MARKER} Sample license`, LEGACY_LICENSE_NOTE] },
      _id: { $in: stored.licenses }
    }).select('_id updatedAt').lean(),
    Workflow.find({
      orgId,
      name: WORKFLOW_NAME,
      $or: [
        { description: { $regex: /^\[ASSETNODE_DEMO:v2\]/ } },
        { description: LEGACY_WORKFLOW_DESCRIPTION }
      ],
      _id: { $in: stored.workflows }
    }).select('_id updatedAt').lean()
  ])

  return {
    employees: ids(onlyUnmodified(employees as any[], recordVersions)),
    hardware: ids(onlyUnmodified(hardware as any[], recordVersions)),
    assignments: ids(onlyUnmodified(assignments as any[], recordVersions)),
    licenses: ids(onlyUnmodified(licenses as any[], recordVersions)),
    workflows: ids(onlyUnmodified(workflows as any[], recordVersions))
  }
}

async function findExternalDependencies(orgId: string, manifest: DemoRecordManifest): Promise<string[]> {
  const employeeIds = manifest.employees
  const hardwareIds = manifest.hardware
  const assignmentIds = manifest.assignments
  const licenseIds = manifest.licenses
  const checks: Array<[string, PromiseLike<unknown>]> = []

  if (employeeIds.length > 0 || hardwareIds.length > 0) {
    checks.push(['assignments', Assignment.exists({
      orgId,
      _id: { $nin: assignmentIds },
      $or: [
        ...(employeeIds.length ? [{ employeeId: { $in: employeeIds } }] : []),
        ...(hardwareIds.length ? [{ hardware: { $in: hardwareIds } }] : [])
      ]
    })])
  }

  if (employeeIds.length > 0) {
    checks.push(
      ['hardware assignments', Hardware.exists({ orgId, _id: { $nin: hardwareIds }, assignedTo: { $in: employeeIds } })],
      ['peripheral assignments', Peripheral.exists({ orgId, assignedTo: { $in: employeeIds } })],
      ['license seats', SoftwareLicense.exists({ orgId, _id: { $nin: licenseIds }, 'seats.employeeId': { $in: employeeIds } })],
      ['consumable checkouts', Consumable.exists({ orgId, 'checkouts.employeeId': { $in: employeeIds } })],
      ['employee hierarchy', Employee.exists({ orgId, _id: { $nin: employeeIds }, managerId: { $in: employeeIds } })],
      ['department managers', Department.exists({ orgId, managerId: { $in: employeeIds } })],
      ['audit responses', AuditResponse.exists({ orgId, employeeId: { $in: employeeIds } })]
    )
  }

  if (hardwareIds.length > 0) {
    checks.push(
      ['maintenance records', MaintenanceRecord.exists({ orgId, hardware: { $in: hardwareIds } })],
      ['installed components', Component.exists({ orgId, hardwareId: { $in: hardwareIds } })],
      ['depreciation records', Depreciation.exists({ orgId, hardwareId: { $in: hardwareIds } })],
      ['buyback quotes', BuybackQuote.exists({ orgId, 'assets.hardwareId': { $in: hardwareIds } })],
      ['availability records', Available.exists({ hardware: { $in: hardwareIds } })],
      ['asset audit responses', AuditResponse.exists({ orgId, 'assets.assetId': { $in: hardwareIds } })]
    )
  }

  const results = await Promise.all(checks.map(async ([label, query]) => [label, await query] as const))
  return results.filter(([, result]) => Boolean(result)).map(([label]) => label)
}

async function assertNoSeedKeyConflicts(orgId: string) {
  const [employees, hardware, license, workflow] = await Promise.all([
    Employee.find({ orgId, email: { $in: EMPLOYEE_EMAILS } }).select('email notes').lean(),
    Hardware.find({ orgId, serialNumber: { $in: HARDWARE_SERIALS } }).select('serialNumber notes tags').lean(),
    SoftwareLicense.findOne({ orgId, name: LICENSE_NAME }).select('notes').lean(),
    Workflow.findOne({ orgId, name: WORKFLOW_NAME }).select('description').lean()
  ])





  if (employees.length > 0 || hardware.length > 0 || license || workflow) {
    throw new DemoDataConflictError(
      'Demo data could not be added because one or more reserved demo identifiers are already in use.',
      'DEMO_IDENTIFIER_CONFLICT'
    )
  }
}

async function seedDemoDataLocked(orgId: string, userId: string, lockToken: string, org: any) {
  const existingDemo = (org.settings as any)?.demoMode || {}
  const existingManifest = normalizeManifest(existingDemo.records)
  const recoveryManifest = normalizeManifest(existingDemo.recoveryRecords)
  if (hasManifestRecords(recoveryManifest)) {
    throw new DemoDataConflictError(
      'A previous demo seed stopped part-way through. Remove its versioned recovery records before seeding again.',
      'DEMO_RECOVERY_REQUIRED'
    )
  }
  const hasExistingSeed = Boolean(existingDemo.seededAt) || hasManifestRecords(existingManifest)




  if (hasExistingSeed) {
    if (!hasManifestRecords(existingManifest)) {
      throw new DemoDataConflictError(
        'Demo mode cannot be re-entered because its ownership manifest is incomplete.',
        'DEMO_STATE_INVALID'
      )
    }

    const stillOwned = await resolveOwnedDemoRecords(
      orgId,
      existingManifest,
      normalizeRecordVersions(existingDemo.recordVersions)
    )
    const trackedCount = Object.values(existingManifest).reduce((sum, entries) => sum + entries.length, 0)
    const ownedCount = Object.values(stillOwned).reduce((sum, entries) => sum + entries.length, 0)
    if (ownedCount !== trackedCount) {
      throw new DemoDataConflictError(
        'Demo mode cannot be re-entered because one or more sample records were edited or removed.',
        'DEMO_DATA_MODIFIED'
      )
    }

    const reentered = await Organization.updateOne({
      _id: orgId,
      'settings.demoMode.operationLock.token': lockToken,
    }, {
      $set: {
        'settings.demoMode.enabled': true,
        'settings.wizardCompleted': true
      },
      $unset: { 'settings.demoMode.operationLock': 1 }
    })
    if (reentered.matchedCount === 0) {
      throw new DemoDataConflictError('Demo operation lock was lost.', 'DEMO_OPERATION_LOCK_LOST')
    }

    return {
      enabled: true,
      hasData: true,
      seedVersion: existingDemo.seedVersion || DEMO_SEED_VERSION,
      seededAt: existingDemo.seededAt,
      tourRecommended: true,
      counts: {
        employees: existingManifest.employees.length,
        hardware: existingManifest.hardware.length,
        assignments: existingManifest.assignments.length,
        workflows: existingManifest.workflows.length,
        licenses: existingManifest.licenses.length
      }
    }
  }

  await assertNoSeedKeyConflicts(orgId)
  await createOrgDefaults(orgId)

  const previousWizardCompleted = existingDemo.previousWizardCompleted ?? (org.settings as any)?.wizardCompleted === true
  const recoveryStarted = await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': lockToken,
  }, {
    $set: { 'settings.demoMode.recoveryPreviousWizardCompleted': previousWizardCompleted }
  })
  if (recoveryStarted.matchedCount === 0) {
    throw new DemoDataConflictError('Demo operation lock was lost.', 'DEMO_OPERATION_LOCK_LOST')
  }

  const [laptopCategory, monitorCategory, productivityCategory, apple, dell, engineering, sales, available, assigned] = await Promise.all([
    Category.findOne({ orgId, slug: 'laptops' }),
    Category.findOne({ orgId, slug: 'monitors' }),
    Category.findOne({ orgId, slug: 'productivity' }),
    Manufacturer.findOne({ orgId, name: 'Apple' }),
    Manufacturer.findOne({ orgId, name: 'Dell' }),
    Department.findOne({ orgId, slug: 'engineering' }),
    Department.findOne({ orgId, slug: 'sales' }),
    Status.findOne({ orgId, slug: 'available' }),
    Status.findOne({ orgId, slug: 'assigned' })
  ])

  if (!laptopCategory || !monitorCategory || !apple || !dell || !available || !assigned) {
    throw new Error('Demo prerequisites could not be created')
  }

  const employeeDefs = [
    { firstName: 'Alex', lastName: 'Meyer', email: EMPLOYEE_EMAILS[0], departmentId: engineering?._id, jobTitle: 'Software Engineer' },
    { firstName: 'Sara', lastName: 'Koch', email: EMPLOYEE_EMAILS[1], departmentId: sales?._id, jobTitle: 'Account Executive' },
    { firstName: 'Jonas', lastName: 'Weber', email: EMPLOYEE_EMAILS[2], departmentId: engineering?._id, jobTitle: 'IT Administrator' }
  ]

  const employees = []
  for (const def of employeeDefs) {
    const employee = await Employee.findOneAndUpdate(
      { orgId, email: def.email },
      {
        $set: { notes: `${DEMO_MARKER} Sample employee` },
        $setOnInsert: { ...def, orgId, isActive: true }
      },
      { upsert: true, new: true }
    )
    await trackRecoveryRecord(orgId, lockToken, 'employees', employee)
    employees.push(employee)
  }

  // Explicit assetTags: upserts bypass the pre('save') auto-tag hook, and two
  // tagless assets in one org used to collide on the unique index (E11000).
  const hardwareDefs = [
    { serialNumber: HARDWARE_SERIALS[0], assetTag: 'DEMO-TAG-001', model: 'MacBook Pro 14-inch', categoryId: laptopCategory._id, manufacturerId: apple._id, statusId: assigned._id, assignedTo: employees[0]._id, purchasePrice: 2499 },
    { serialNumber: HARDWARE_SERIALS[1], assetTag: 'DEMO-TAG-002', model: 'MacBook Air 13-inch', categoryId: laptopCategory._id, manufacturerId: apple._id, statusId: assigned._id, assignedTo: employees[1]._id, purchasePrice: 1399 },
    { serialNumber: HARDWARE_SERIALS[2], assetTag: 'DEMO-TAG-003', model: 'Latitude 7440', categoryId: laptopCategory._id, manufacturerId: dell._id, statusId: assigned._id, assignedTo: employees[2]._id, purchasePrice: 1699 },
    { serialNumber: HARDWARE_SERIALS[3], assetTag: 'DEMO-TAG-004', model: 'UltraSharp U2723QE', categoryId: monitorCategory._id, manufacturerId: dell._id, statusId: available._id, purchasePrice: 629 },
    { serialNumber: HARDWARE_SERIALS[4], assetTag: 'DEMO-TAG-005', model: 'MacBook Pro 16-inch', categoryId: laptopCategory._id, manufacturerId: apple._id, statusId: available._id, purchasePrice: 3199 }
  ]

  const hardware = []
  for (const def of hardwareDefs) {
    const asset = await Hardware.findOneAndUpdate(
      { orgId, serialNumber: def.serialNumber },
      {
        $set: {
          notes: `${DEMO_MARKER} Sample asset — safe to remove`,
          tags: ['demo', `assetnode-demo-v${DEMO_SEED_VERSION}`]
        },
        $setOnInsert: {
          ...def,
          orgId,
          currency: 'EUR',
          purchaseDate: new Date('2026-01-15'),
          warrantyExpiry: new Date('2029-01-15')
        }
      },
      { upsert: true, new: true }
    )
    await trackRecoveryRecord(orgId, lockToken, 'hardware', asset)
    hardware.push(asset)
  }

  const assignmentDefs = [
    { employee: employees[0], assets: [hardware[0]], note: `${DEMO_MARKER} Engineering starter kit` },
    { employee: employees[1], assets: [hardware[1]], note: `${DEMO_MARKER} Sales starter kit` },
    { employee: employees[2], assets: [hardware[2]], note: `${DEMO_MARKER} IT administration kit` }
  ]
  const assignments = []
  for (const item of assignmentDefs) {
    let assignment = await Assignment.findOne({ orgId, notes: item.note })
    if (!assignment) {
      const legacyNote = item.note.replace(DEMO_MARKER, '[DEMO]')
      assignment = await Assignment.findOne({ orgId, notes: legacyNote })
    }
    if (assignment) {
      throw new DemoDataConflictError(
        'Demo data could not be added because a reserved assignment identifier is already in use.',
        'DEMO_IDENTIFIER_CONFLICT'
      )
    }
    assignment = await Assignment.create({
      orgId,
      employeeId: item.employee._id,
      hardware: item.assets.map(asset => asset._id),
      status: 'active',
      assignmentDate: new Date('2026-02-01'),
      acknowledgedAt: new Date('2026-02-02'),
      notes: item.note
    })
    await trackRecoveryRecord(orgId, lockToken, 'assignments', assignment)
    assignments.push(assignment)
  }

  const license = await SoftwareLicense.findOneAndUpdate(
    { orgId, name: LICENSE_NAME },
    {
      $set: { notes: `${DEMO_MARKER} Sample license` },
      $setOnInsert: {
        orgId,
        name: LICENSE_NAME,
        publisher: 'Microsoft',
        categoryId: productivityCategory?._id,
        totalSeats: 25,
        costPerSeat: 12.5,
        billingCycle: 'monthly',
        currency: 'EUR'
      }
    },
    { upsert: true, new: true }
  )
  await trackRecoveryRecord(orgId, lockToken, 'licenses', license)

  const workflow = await Workflow.findOneAndUpdate(
    { orgId, name: WORKFLOW_NAME },
    {
      $set: { description: `${DEMO_MARKER} Shows how a scheduled warranty notification can be automated.` },
      $setOnInsert: {
        orgId,
        name: WORKFLOW_NAME,
        isActive: false,
        triggers: [{ nodeId: 'demo-trigger', type: 'schedule', cron: '*/24h', cronLabel: 'Daily' }],
        nodes: [
          { id: 'demo-trigger', type: 'trigger-schedule', position: { x: 100, y: 160 }, data: { cron: '*/24h' } },
          { id: 'demo-condition', type: 'condition', position: { x: 420, y: 160 }, data: { entity: 'hardware', field: 'warrantyExpiringCount', operator: 'gt', value: '0' } },
          { id: 'demo-notify', type: 'action-notify', position: { x: 760, y: 100 }, data: { channel: 'email', title: 'Warranty expires soon', message: 'A device warranty expires within 30 days.' } }
        ],
        edges: [
          { id: 'demo-edge-1', source: 'demo-trigger', target: 'demo-condition', animated: true },
          { id: 'demo-edge-2', source: 'demo-condition', target: 'demo-notify', sourceHandle: 'true', animated: true }
        ],
        createdBy: userId
      }
    },
    { upsert: true, new: true }
  )
  await trackRecoveryRecord(orgId, lockToken, 'workflows', workflow)

  const seededAt = existingDemo.seededAt || new Date()
  const records: DemoRecordManifest = {
    employees: ids(employees),
    hardware: ids(hardware),
    assignments: ids(assignments),
    licenses: [String(license._id)],
    workflows: [String(workflow._id)]
  }


  const recordVersions = await readCurrentRecordVersions(orgId, records)
  const recoverySnapshot = await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': lockToken,
  }, {
    $set: {
      'settings.demoMode.recoveryRecords': records,
      'settings.demoMode.recoveryRecordVersions': recordVersions,
    }
  })
  if (recoverySnapshot.matchedCount === 0) {
    throw new DemoDataConflictError('Demo operation lock was lost.', 'DEMO_OPERATION_LOCK_LOST')
  }

  const finalized = await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': lockToken,
  }, {
    $set: {
      'settings.demoMode.enabled': true,
      'settings.demoMode.seedVersion': DEMO_SEED_VERSION,
      'settings.demoMode.seededAt': seededAt,
      'settings.demoMode.previousWizardCompleted': previousWizardCompleted,
      'settings.demoMode.records': records,
      'settings.demoMode.recordVersions': recordVersions,
      'settings.wizardCompleted': true
    },
    $unset: {
      'settings.demoMode.operationLock': 1,
      'settings.demoMode.recoveryRecords': 1,
      'settings.demoMode.recoveryRecordVersions': 1,
      'settings.demoMode.recoveryPreviousWizardCompleted': 1,
    }
  })
  if (finalized.matchedCount === 0) {
    throw new DemoDataConflictError('Demo operation lock was lost.', 'DEMO_OPERATION_LOCK_LOST')
  }

  return {
    enabled: true,
    hasData: true,
    seedVersion: DEMO_SEED_VERSION,
    seededAt,
    tourRecommended: true,
    counts: {
      employees: employees.length,
      hardware: hardware.length,
      assignments: assignments.length,
      workflows: 1,
      licenses: 1
    }
  }
}

export async function seedDemoData(orgId: string, userId: string) {
  const { token, org } = await acquireDemoOperation(orgId, 'seed')
  try {
    return await seedDemoDataLocked(orgId, userId, token, org)
  } catch (error) {
    await releaseDemoOperation(orgId, token)
    throw error
  }
}

export async function exitDemoMode(orgId: string) {
  const org = await Organization.findById(orgId).select('settings.demoMode').lean()
  if (!org) throw new Error('Organization not found')

  const demo = (org.settings as any)?.demoMode || {}
  const exited = await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': { $exists: false },
  }, {
    $set: { 'settings.demoMode.enabled': false }
  })
  if (exited.matchedCount === 0) {
    throw new DemoDataConflictError(
      'Demo Mode cannot be exited while another demo operation is running.',
      'DEMO_OPERATION_IN_PROGRESS'
    )
  }

  return {
    enabled: false,
    hasData: hasManifestRecords(normalizeManifest(demo.records)),
    seededAt: demo.seededAt
  }
}

async function removeDemoDataLocked(
  orgId: string,
  lockToken: string,
  org: any,
  options: { failOnModified?: boolean } = {}
) {
  const demo = (org.settings as any)?.demoMode || {}
  const stored = mergeManifests(
    normalizeManifest(demo.records),
    normalizeManifest(demo.recoveryRecords)
  )
  const recordVersions = {
    ...normalizeRecordVersions(demo.recordVersions),
    ...normalizeRecordVersions(demo.recoveryRecordVersions),
  }
  if (!demo.seededAt && !hasManifestRecords(stored)) {
    return {
      enabled: false,
      hasData: false,
      preservedModified: 0,
      deleted: { employees: 0, hardware: 0, assignments: 0, licenses: 0, workflows: 0 }
    }
  }

  const owned = await resolveOwnedDemoRecords(
    orgId,
    stored,
    recordVersions
  )

  const preservedModified = hasManifestRecords(stored)
    ? (Object.values(stored).reduce((sum, entries) => sum + entries.length, 0) -
       Object.values(owned).reduce((sum, entries) => sum + entries.length, 0))
    : 0

  if (options.failOnModified && preservedModified > 0) {
    throw new DemoDataConflictError(
      'Demo reset stopped because one or more sample records were edited. Remove or restore those records before resetting.',
      'DEMO_DATA_MODIFIED'
    )
  }

  const dependencies = await findExternalDependencies(orgId, owned)
  if (dependencies.length > 0) {
    throw new DemoDataConflictError(
      'Demo cleanup stopped because real records reference sample data. Remove those links before deleting or resetting the demo.',
      'DEMO_DATA_IN_USE',
      dependencies
    )
  }

  const [assignmentResult, hardwareResult, employeeResult, licenseResult, workflowResult] = await Promise.all([
    Assignment.deleteMany({ orgId, ...versionedIdFilter(owned.assignments, recordVersions), notes: { $regex: /^\[(?:ASSETNODE_DEMO:v2|DEMO)\]/ } }),
    Hardware.deleteMany({ orgId, ...versionedIdFilter(owned.hardware, recordVersions), serialNumber: { $in: HARDWARE_SERIALS } }),
    Employee.deleteMany({ orgId, ...versionedIdFilter(owned.employees, recordVersions), email: { $in: EMPLOYEE_EMAILS } }),
    SoftwareLicense.deleteMany({ orgId, ...versionedIdFilter(owned.licenses, recordVersions), name: LICENSE_NAME }),
    Workflow.deleteMany({ orgId, ...versionedIdFilter(owned.workflows, recordVersions), name: WORKFLOW_NAME })
  ])

  const previousWizardCompleted = demo.previousWizardCompleted ?? demo.recoveryPreviousWizardCompleted ?? false
  const finalized = await Organization.updateOne({
    _id: orgId,
    'settings.demoMode.operationLock.token': lockToken,
  }, {
    $set: {
      'settings.wizardCompleted': previousWizardCompleted,
      'settings.demoMode.enabled': false,
      'settings.demoMode.seedVersion': 0
    },
    $unset: {
      'settings.demoMode.seededAt': 1,
      'settings.demoMode.previousWizardCompleted': 1,
      'settings.demoMode.records': 1,
      'settings.demoMode.recordVersions': 1,
      'settings.demoMode.recoveryRecords': 1,
      'settings.demoMode.recoveryRecordVersions': 1,
      'settings.demoMode.recoveryPreviousWizardCompleted': 1,
      'settings.demoMode.operationLock': 1,
    }
  })
  if (finalized.matchedCount === 0) {
    throw new DemoDataConflictError('Demo operation lock was lost.', 'DEMO_OPERATION_LOCK_LOST')
  }

  return {
    enabled: false,
    hasData: false,
    preservedModified,
    deleted: {
      employees: employeeResult.deletedCount,
      hardware: hardwareResult.deletedCount,
      assignments: assignmentResult.deletedCount,
      licenses: licenseResult.deletedCount,
      workflows: workflowResult.deletedCount
    }
  }
}

export async function removeDemoData(orgId: string, options: { failOnModified?: boolean } = {}) {
  const { token, org } = await acquireDemoOperation(orgId, 'remove')
  try {
    return await removeDemoDataLocked(orgId, token, org, options)
  } finally {
    await releaseDemoOperation(orgId, token)
  }
}

export async function resetDemoData(orgId: string, userId: string) {
  await removeDemoData(orgId, { failOnModified: true })
  return seedDemoData(orgId, userId)
}
