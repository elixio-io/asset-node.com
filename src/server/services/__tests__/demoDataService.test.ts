import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const query = (value: unknown) => ({
    __value: value,
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
    lean: vi.fn().mockResolvedValue(value)
  })

  return {
    query,
    mode: 'seed' as 'seed' | 'cleanup',
    orgValue: {} as any,
    Organization: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn(),
      exists: vi.fn(),
    },
    Employee: { find: vi.fn(), findOneAndUpdate: vi.fn(), exists: vi.fn(), deleteMany: vi.fn() },
    Hardware: { find: vi.fn(), findOneAndUpdate: vi.fn(), exists: vi.fn(), deleteMany: vi.fn() },
    Assignment: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), exists: vi.fn(), deleteMany: vi.fn() },
    SoftwareLicense: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), exists: vi.fn(), deleteMany: vi.fn() },
    Workflow: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), deleteMany: vi.fn() },
    Category: { findOne: vi.fn() },
    Manufacturer: { findOne: vi.fn() },
    Department: { findOne: vi.fn(), exists: vi.fn() },
    Status: { findOne: vi.fn() },
    Peripheral: { exists: vi.fn() },
    Consumable: { exists: vi.fn() },
    AuditResponse: { exists: vi.fn() },
    Available: { exists: vi.fn() },
    BuybackQuote: { exists: vi.fn() },
    Component: { exists: vi.fn() },
    Depreciation: { exists: vi.fn() },
    MaintenanceRecord: { exists: vi.fn() },
    createOrgDefaults: vi.fn()
  }
})

vi.mock('../../../models/Organization', () => ({ Organization: mocks.Organization }))
vi.mock('../../../models/Employee', () => ({ Employee: mocks.Employee }))
vi.mock('../../../models/Hardware', () => ({ Hardware: mocks.Hardware }))
vi.mock('../../../models/Assignment', () => ({ Assignment: mocks.Assignment }))
vi.mock('../../../models/SoftwareLicense', () => ({ SoftwareLicense: mocks.SoftwareLicense }))
vi.mock('../../../models/Workflow', () => ({ Workflow: mocks.Workflow }))
vi.mock('../../../models/Category', () => ({ Category: mocks.Category }))
vi.mock('../../../models/Manufacturer', () => ({ Manufacturer: mocks.Manufacturer }))
vi.mock('../../../models/Department', () => ({ Department: mocks.Department }))
vi.mock('../../../models/Status', () => ({ Status: mocks.Status }))
vi.mock('../../../models/Peripheral', () => ({ Peripheral: mocks.Peripheral }))
vi.mock('../../../models/Consumable', () => ({ Consumable: mocks.Consumable }))
vi.mock('../../../models/AuditResponse', () => ({ AuditResponse: mocks.AuditResponse }))
vi.mock('../../../models/Available', () => ({ Available: mocks.Available }))
vi.mock('../../../models/BuybackQuote', () => ({ BuybackQuote: mocks.BuybackQuote }))
vi.mock('../../../models/Component', () => ({ Component: mocks.Component }))
vi.mock('../../../models/Depreciation', () => ({ Depreciation: mocks.Depreciation }))
vi.mock('../../../models/MaintenanceRecord', () => ({ MaintenanceRecord: mocks.MaintenanceRecord }))
vi.mock('../orgDefaults', () => ({ createOrgDefaults: mocks.createOrgDefaults }))

const {
  DEMO_MARKER,
  removeDemoData,
  resetDemoData,
  seedDemoData
} = await import('../demoDataService')

const ORG_ID = '64b000000000000000000001'
const USER_ID = '64b000000000000000000002'
const SEEDED_AT = new Date('2026-07-21T12:00:00.000Z')
const employeeDocs = [1, 2, 3].map(n => ({ _id: `employee-${n}`, updatedAt: SEEDED_AT }))
const hardwareDocs = [1, 2, 3, 4, 5].map(n => ({ _id: `hardware-${n}`, updatedAt: SEEDED_AT }))
const assignmentDocs = [1, 2, 3].map(n => ({ _id: `assignment-${n}`, updatedAt: SEEDED_AT, save: vi.fn() }))
const licenseDoc = { _id: 'license-1', updatedAt: SEEDED_AT }
const workflowDoc = { _id: 'workflow-1', updatedAt: SEEDED_AT }

function manifestForFixtures() {
  return {
    employees: employeeDocs.map(doc => doc._id),
    hardware: hardwareDocs.map(doc => doc._id),
    assignments: assignmentDocs.map(doc => doc._id),
    licenses: [licenseDoc._id],
    workflows: [workflowDoc._id]
  }
}

function versionsForFixtures(at = SEEDED_AT) {
  return Object.fromEntries([
    ...employeeDocs,
    ...hardwareDocs,
    ...assignmentDocs,
    licenseDoc,
    workflowDoc
  ].map(doc => [doc._id, at]))
}

function setupDependenciesAsUnused() {
  for (const model of [
    mocks.Assignment,
    mocks.Hardware,
    mocks.Peripheral,
    mocks.SoftwareLicense,
    mocks.Consumable,
    mocks.Employee,
    mocks.Department,
    mocks.AuditResponse,
    mocks.MaintenanceRecord,
    mocks.Component,
    mocks.Depreciation,
    mocks.BuybackQuote,
    mocks.Available
  ]) {
    if ('exists' in model) model.exists.mockResolvedValue(null)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-21T12:00:00.000Z'))
  mocks.mode = 'seed'
  setupDependenciesAsUnused()
  mocks.createOrgDefaults.mockResolvedValue(undefined)

  mocks.orgValue = {
    settings: { wizardCompleted: false, demoMode: {} }
  }
  mocks.Organization.findById.mockImplementation(() => mocks.query(mocks.orgValue))
  mocks.Organization.findOneAndUpdate.mockImplementation(() => {
    const current = (mocks.Organization.findById() as any).__value
    if (!current) return mocks.query(null)
    return mocks.query(current)
  })
  mocks.Organization.findByIdAndUpdate.mockResolvedValue({})
  mocks.Organization.exists.mockResolvedValue({ _id: ORG_ID })
  mocks.Organization.updateOne.mockImplementation((_filter: any, update: any) => {
    const apply = (path: string, value: any) => {
      const parts = path.split('.')
      let target = mocks.orgValue
      for (const part of parts.slice(0, -1)) target = target[part] ??= {}
      target[parts.at(-1)!] = value
    }
    const remove = (path: string) => {
      const parts = path.split('.')
      let target = mocks.orgValue
      for (const part of parts.slice(0, -1)) {
        target = target?.[part]
        if (!target) return
      }
      delete target[parts.at(-1)!]
    }
    for (const [path, value] of Object.entries(update.$set || {})) apply(path, value)
    for (const path of Object.keys(update.$unset || {})) remove(path)
    for (const [path, value] of Object.entries(update.$addToSet || {})) {
      const parts = path.split('.')
      let target = mocks.orgValue
      for (const part of parts.slice(0, -1)) target = target[part] ??= {}
      const key = parts.at(-1)!
      target[key] = [...new Set([...(target[key] || []), value])]
    }
    return Promise.resolve({ matchedCount: 1, modifiedCount: 1 })
  })

  mocks.Employee.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in ? employeeDocs : []))
  mocks.Hardware.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in ? hardwareDocs : []))
  mocks.Assignment.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in ? assignmentDocs : []))
  mocks.SoftwareLicense.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in ? [licenseDoc] : []))
  mocks.Workflow.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in ? [workflowDoc] : []))
  mocks.SoftwareLicense.findOne.mockImplementation(() => mocks.query(null))
  mocks.Workflow.findOne.mockImplementation(() => mocks.query(null))

  mocks.Category.findOne.mockImplementation(({ slug }: { slug: string }) => Promise.resolve({ _id: `category-${slug}` }))
  mocks.Manufacturer.findOne.mockImplementation(({ name }: { name: string }) => Promise.resolve({ _id: `manufacturer-${name}` }))
  mocks.Department.findOne.mockImplementation(({ slug }: { slug: string }) => Promise.resolve({ _id: `department-${slug}` }))
  mocks.Status.findOne.mockImplementation(({ slug }: { slug: string }) => Promise.resolve({ _id: `status-${slug}` }))

  let employeeIndex = 0
  mocks.Employee.findOneAndUpdate.mockImplementation(() => Promise.resolve(employeeDocs[employeeIndex++ % employeeDocs.length]))
  let hardwareIndex = 0
  mocks.Hardware.findOneAndUpdate.mockImplementation(() => Promise.resolve(hardwareDocs[hardwareIndex++ % hardwareDocs.length]))

  const assignmentByNote = new Map<string, any>()
  mocks.Assignment.findOne.mockImplementation(({ notes }: { notes: string }) => Promise.resolve(assignmentByNote.get(notes) || null))
  let assignmentIndex = 0
  mocks.Assignment.create.mockImplementation((value: any) => {
    const doc = assignmentDocs[assignmentIndex++]
    assignmentByNote.set(value.notes, doc)
    return Promise.resolve(doc)
  })
  mocks.SoftwareLicense.findOneAndUpdate.mockResolvedValue(licenseDoc)
  mocks.Workflow.findOneAndUpdate.mockResolvedValue(workflowDoc)

  mocks.Assignment.deleteMany.mockResolvedValue({ deletedCount: 3 })
  mocks.Hardware.deleteMany.mockResolvedValue({ deletedCount: 5 })
  mocks.Employee.deleteMany.mockResolvedValue({ deletedCount: 3 })
  mocks.SoftwareLicense.deleteMany.mockResolvedValue({ deletedCount: 1 })
  mocks.Workflow.deleteMany.mockResolvedValue({ deletedCount: 1 })
})

describe('Demo data lifecycle', () => {
  it('is idempotent and persists the exact generated record manifest', async () => {
    const first = await seedDemoData(ORG_ID, USER_ID)
    const second = await seedDemoData(ORG_ID, USER_ID)

    expect(first.counts).toEqual({ employees: 3, hardware: 5, assignments: 3, workflows: 1, licenses: 1 })
    expect(second.counts).toEqual(first.counts)
    expect(mocks.Assignment.create).toHaveBeenCalledTimes(3)
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: ORG_ID,
        'settings.demoMode.operationLock.token': expect.any(String),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
        'settings.demoMode.enabled': true,
        'settings.demoMode.records': {
          employees: ['employee-1', 'employee-2', 'employee-3'],
          hardware: ['hardware-1', 'hardware-2', 'hardware-3', 'hardware-4', 'hardware-5'],
          assignments: ['assignment-1', 'assignment-2', 'assignment-3'],
          licenses: ['license-1'],
          workflows: ['workflow-1']
        }
      })
      })
    )
  })

  it('deletes only manifest IDs that still carry demo markers and restores wizard state', async () => {
    mocks.mode = 'cleanup'
    const records = manifestForFixtures()
    const recordVersions = versionsForFixtures()
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: {
        wizardCompleted: true,
        demoMode: { enabled: true, previousWizardCompleted: false, records, recordVersions }
      }
    }))
    mocks.Employee.find.mockImplementation(() => mocks.query(employeeDocs))
    mocks.Hardware.find.mockImplementation(() => mocks.query(hardwareDocs))
    mocks.Assignment.find.mockImplementation(() => mocks.query(assignmentDocs))
    mocks.SoftwareLicense.find.mockImplementation(() => mocks.query([licenseDoc]))
    mocks.Workflow.find.mockImplementation(() => mocks.query([workflowDoc]))

    const result = await removeDemoData(ORG_ID)

    expect(result.deleted).toEqual({ employees: 3, hardware: 5, assignments: 3, licenses: 1, workflows: 1 })
    expect(mocks.Employee.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      $or: records.employees.map(recordId => ({ _id: recordId, updatedAt: SEEDED_AT }))
    }))
    expect(mocks.Hardware.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      $or: records.hardware.map(recordId => ({ _id: recordId, updatedAt: SEEDED_AT }))
    }))
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'settings.demoMode.operationLock.token': expect.any(String) }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'settings.wizardCompleted': false,
          'settings.demoMode.enabled': false
        }),
        $unset: expect.objectContaining({ 'settings.demoMode.records': 1 })
      })
    )
  })

  it('refuses a reset when a tracked demo record was edited', async () => {
    const records = manifestForFixtures()
    const recordVersions = versionsForFixtures()
    mocks.Organization.findById.mockImplementation(() => mocks.query({ settings: { demoMode: { records, recordVersions } } }))
    mocks.Employee.find.mockImplementation(() => mocks.query(employeeDocs.slice(1)))
    mocks.Hardware.find.mockImplementation(() => mocks.query(hardwareDocs))
    mocks.Assignment.find.mockImplementation(() => mocks.query(assignmentDocs))
    mocks.SoftwareLicense.find.mockImplementation(() => mocks.query([licenseDoc]))
    mocks.Workflow.find.mockImplementation(() => mocks.query([workflowDoc]))

    await expect(resetDemoData(ORG_ID, USER_ID)).rejects.toMatchObject({ code: 'DEMO_DATA_MODIFIED' })
    expect(mocks.Employee.deleteMany).not.toHaveBeenCalled()
  })

  it('stops cleanup when real records reference demo records', async () => {
    const records = manifestForFixtures()
    const recordVersions = versionsForFixtures()
    mocks.Organization.findById.mockImplementation(() => mocks.query({ settings: { demoMode: { records, recordVersions } } }))
    mocks.Employee.find.mockImplementation(() => mocks.query(employeeDocs))
    mocks.Hardware.find.mockImplementation(() => mocks.query(hardwareDocs))
    mocks.Assignment.find.mockImplementation(() => mocks.query(assignmentDocs))
    mocks.SoftwareLicense.find.mockImplementation(() => mocks.query([licenseDoc]))
    mocks.Workflow.find.mockImplementation(() => mocks.query([workflowDoc]))
    mocks.MaintenanceRecord.exists.mockResolvedValue({ _id: 'real-maintenance' })

    await expect(removeDemoData(ORG_ID)).rejects.toMatchObject({
      code: 'DEMO_DATA_IN_USE',
      dependencies: ['maintenance records']
    })
    expect(mocks.Hardware.deleteMany).not.toHaveBeenCalled()
  })

  it('does not discover or delete marker-like records without demo ownership state', async () => {
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: { wizardCompleted: false, demoMode: {} }
    }))

    const result = await removeDemoData(ORG_ID)

    expect(result.deleted).toEqual({ employees: 0, hardware: 0, assignments: 0, licenses: 0, workflows: 0 })
    expect(mocks.Employee.find).not.toHaveBeenCalled()
    expect(mocks.Employee.deleteMany).not.toHaveBeenCalled()
    expect(mocks.Organization.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('preserves a manifest record whenever its updatedAt version changed', async () => {
    const seededAt = new Date('2026-07-21T10:00:00.000Z')
    const changedAt = new Date('2026-07-21T11:00:00.000Z')
    const versionedEmployees = employeeDocs.map((doc, index) => ({
      ...doc,
      updatedAt: index === 0 ? changedAt : seededAt
    }))
    const versionedHardware = hardwareDocs.map(doc => ({ ...doc, updatedAt: seededAt }))
    const versionedAssignments = assignmentDocs.map(doc => ({ ...doc, updatedAt: seededAt }))
    const versionedLicense = { ...licenseDoc, updatedAt: seededAt }
    const versionedWorkflow = { ...workflowDoc, updatedAt: seededAt }
    const records = {
      employees: employeeDocs.map(doc => doc._id),
      hardware: hardwareDocs.map(doc => doc._id),
      assignments: assignmentDocs.map(doc => doc._id),
      licenses: [licenseDoc._id],
      workflows: [workflowDoc._id]
    }
    const allRecords = [
      ...employeeDocs,
      ...hardwareDocs,
      ...assignmentDocs,
      licenseDoc,
      workflowDoc
    ]
    const recordVersions = Object.fromEntries(allRecords.map(doc => [doc._id, seededAt]))
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: { demoMode: { seededAt, records, recordVersions } }
    }))
    mocks.Employee.find.mockImplementation(() => mocks.query(versionedEmployees))
    mocks.Hardware.find.mockImplementation(() => mocks.query(versionedHardware))
    mocks.Assignment.find.mockImplementation(() => mocks.query(versionedAssignments))
    mocks.SoftwareLicense.find.mockImplementation(() => mocks.query([versionedLicense]))
    mocks.Workflow.find.mockImplementation(() => mocks.query([versionedWorkflow]))

    const result = await removeDemoData(ORG_ID)

    expect(result.preservedModified).toBe(1)
    expect(mocks.Employee.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      $or: [
        { _id: 'employee-2', updatedAt: seededAt },
        { _id: 'employee-3', updatedAt: seededAt },
      ]
    }))
  })

  it('re-enters an unchanged demo without upserting or replacing its ownership snapshot', async () => {
    const seededAt = new Date('2026-07-21T10:00:00.000Z')
    const records = {
      employees: employeeDocs.map(doc => doc._id),
      hardware: hardwareDocs.map(doc => doc._id),
      assignments: assignmentDocs.map(doc => doc._id),
      licenses: [licenseDoc._id],
      workflows: [workflowDoc._id]
    }
    const allRecords = [...employeeDocs, ...hardwareDocs, ...assignmentDocs, licenseDoc, workflowDoc]
    const recordVersions = Object.fromEntries(allRecords.map(doc => [doc._id, seededAt]))
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: {
        wizardCompleted: true,
        demoMode: { enabled: false, seedVersion: 2, seededAt, records, recordVersions }
      }
    }))
    mocks.Employee.find.mockImplementation(() => mocks.query(employeeDocs.map(doc => ({ ...doc, updatedAt: seededAt }))))
    mocks.Hardware.find.mockImplementation(() => mocks.query(hardwareDocs.map(doc => ({ ...doc, updatedAt: seededAt }))))
    mocks.Assignment.find.mockImplementation(() => mocks.query(assignmentDocs.map(doc => ({ ...doc, updatedAt: seededAt }))))
    mocks.SoftwareLicense.find.mockImplementation(() => mocks.query([{ ...licenseDoc, updatedAt: seededAt }]))
    mocks.Workflow.find.mockImplementation(() => mocks.query([{ ...workflowDoc, updatedAt: seededAt }]))

    const result = await seedDemoData(ORG_ID, USER_ID)

    expect(result.counts).toEqual({ employees: 3, hardware: 5, assignments: 3, workflows: 1, licenses: 1 })
    expect(mocks.createOrgDefaults).not.toHaveBeenCalled()
    expect(mocks.Employee.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mocks.Hardware.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mocks.Assignment.create).not.toHaveBeenCalled()
    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'settings.demoMode.operationLock.token': expect.any(String) }),
      {
        $set: {
          'settings.demoMode.enabled': true,
          'settings.wizardCompleted': true
        },
        $unset: { 'settings.demoMode.operationLock': 1 }
      }
    )
    const update = mocks.Organization.updateOne.mock.calls.find(([, candidate]) =>
      candidate?.$set?.['settings.demoMode.enabled'] === true
    )?.[1]
    expect(update?.$set).not.toHaveProperty('settings.demoMode.recordVersions')
    expect(update?.$set).not.toHaveProperty('settings.demoMode.records')
  })

  it('refuses demo re-entry instead of re-claiming a user-modified manifest record', async () => {
    const seededAt = new Date('2026-07-21T10:00:00.000Z')
    const changedAt = new Date('2026-07-21T11:00:00.000Z')
    const records = {
      employees: employeeDocs.map(doc => doc._id),
      hardware: hardwareDocs.map(doc => doc._id),
      assignments: assignmentDocs.map(doc => doc._id),
      licenses: [licenseDoc._id],
      workflows: [workflowDoc._id]
    }
    const allRecords = [...employeeDocs, ...hardwareDocs, ...assignmentDocs, licenseDoc, workflowDoc]
    const recordVersions = Object.fromEntries(allRecords.map(doc => [doc._id, seededAt]))
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: { demoMode: { enabled: false, seedVersion: 2, seededAt, records, recordVersions } }
    }))
    mocks.Employee.find.mockImplementation(() => mocks.query(employeeDocs.map((doc, index) => ({
      ...doc,
      updatedAt: index === 0 ? changedAt : seededAt
    }))))
    mocks.Hardware.find.mockImplementation(() => mocks.query(hardwareDocs.map(doc => ({ ...doc, updatedAt: seededAt }))))
    mocks.Assignment.find.mockImplementation(() => mocks.query(assignmentDocs.map(doc => ({ ...doc, updatedAt: seededAt }))))
    mocks.SoftwareLicense.find.mockImplementation(() => mocks.query([{ ...licenseDoc, updatedAt: seededAt }]))
    mocks.Workflow.find.mockImplementation(() => mocks.query([{ ...workflowDoc, updatedAt: seededAt }]))

    await expect(seedDemoData(ORG_ID, USER_ID)).rejects.toMatchObject({ code: 'DEMO_DATA_MODIFIED' })
    expect(mocks.Organization.findByIdAndUpdate).not.toHaveBeenCalled()
    expect(mocks.Employee.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mocks.Hardware.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mocks.Assignment.create).not.toHaveBeenCalled()
  })

  it('does not trust marker text to reclaim a preserved record after ownership state was cleared', async () => {
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: { wizardCompleted: false, demoMode: {} }
    }))
    mocks.Employee.find.mockImplementation(() => mocks.query([{
      _id: 'preserved-user-record',
      email: 'alex.meyer@demo.asset-node.invalid',
      notes: `${DEMO_MARKER} Sample employee`
    }]))

    await expect(seedDemoData(ORG_ID, USER_ID)).rejects.toMatchObject({
      code: 'DEMO_IDENTIFIER_CONFLICT'
    })
    expect(mocks.Employee.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mocks.Organization.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('uses explicit versioned markers for seeded records', async () => {
    await seedDemoData(ORG_ID, USER_ID)
    expect(DEMO_MARKER).toBe('[ASSETNODE_DEMO:v2]')
    expect(mocks.Employee.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: { notes: `${DEMO_MARKER} Sample employee` } }),
      expect.anything()
    )
  })

  it('fails closed when a demo manifest has no record-version snapshot', async () => {
    const records = manifestForFixtures()
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: { demoMode: { seededAt: SEEDED_AT, records } }
    }))

    await expect(removeDemoData(ORG_ID)).rejects.toMatchObject({
      code: 'DEMO_OWNERSHIP_UNVERIFIED'
    })
    expect(mocks.Employee.deleteMany).not.toHaveBeenCalled()
    expect(mocks.Hardware.deleteMany).not.toHaveBeenCalled()
  })

  it('fails closed when even one tracked demo record has no version', async () => {
    const records = manifestForFixtures()
    const recordVersions = versionsForFixtures()
    delete recordVersions['hardware-5']
    mocks.Organization.findById.mockImplementation(() => mocks.query({
      settings: { demoMode: { seededAt: SEEDED_AT, records, recordVersions } }
    }))

    await expect(removeDemoData(ORG_ID)).rejects.toMatchObject({
      code: 'DEMO_OWNERSHIP_UNVERIFIED'
    })
    expect(mocks.Employee.deleteMany).not.toHaveBeenCalled()
    expect(mocks.Hardware.deleteMany).not.toHaveBeenCalled()
  })

  it('re-reads final versions after assignment hooks mutate seeded records', async () => {
    const afterAssignmentHook = new Date('2026-07-21T12:05:00.000Z')
    mocks.Employee.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in
      ? employeeDocs.map((doc, index) => ({ ...doc, updatedAt: index === 0 ? afterAssignmentHook : SEEDED_AT }))
      : []))
    mocks.Hardware.find.mockImplementation((filter: any) => mocks.query(filter?._id?.$in
      ? hardwareDocs.map((doc, index) => ({ ...doc, updatedAt: index === 0 ? afterAssignmentHook : SEEDED_AT }))
      : []))

    await seedDemoData(ORG_ID, USER_ID)

    const finalUpdate = mocks.Organization.updateOne.mock.calls.find(([, update]) =>
      update?.$set?.['settings.demoMode.recordVersions']
    )?.[1]
    expect(finalUpdate.$set['settings.demoMode.recordVersions']).toMatchObject({
      'employee-1': afterAssignmentHook,
      'hardware-1': afterAssignmentHook,
      'employee-2': SEEDED_AT,
    })
  })

  it('allows only one concurrent demo seed to acquire the organization lock', async () => {
    let lockClaims = 0
    mocks.Organization.findOneAndUpdate.mockImplementation(() => {
      lockClaims++
      return mocks.query(lockClaims === 1 ? mocks.orgValue : null)
    })

    const results = await Promise.allSettled([
      seedDemoData(ORG_ID, USER_ID),
      seedDemoData(ORG_ID, USER_ID),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: 'DEMO_OPERATION_IN_PROGRESS' })
    expect(mocks.Assignment.create).toHaveBeenCalledTimes(3)
  })

  it('tracks each created record in a cleanup manifest before continuing the seed', async () => {
    mocks.Employee.findOneAndUpdate
      .mockResolvedValueOnce(employeeDocs[0])
      .mockRejectedValueOnce(new Error('simulated crash after first record'))

    await expect(seedDemoData(ORG_ID, USER_ID)).rejects.toThrow('simulated crash')

    expect(mocks.Organization.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: ORG_ID,
        'settings.demoMode.operationLock.token': expect.any(String),
      }),
      expect.objectContaining({
        $addToSet: { 'settings.demoMode.recoveryRecords.employees': 'employee-1' },
        $set: { 'settings.demoMode.recoveryRecordVersions.employee-1': SEEDED_AT },
      })
    )

    await expect(removeDemoData(ORG_ID)).resolves.toMatchObject({ hasData: false })
    expect(mocks.Employee.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      $or: [{ _id: 'employee-1', updatedAt: SEEDED_AT }]
    }))
  })
})
