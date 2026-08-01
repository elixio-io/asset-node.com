import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processSmartAutomations } from '../smartAutomationsWorker'
import { Organization } from '../../../models/Organization'
import { Employee } from '../../../models/Employee'
import { Assignment } from '../../../models/Assignment'
import { Hardware } from '../../../models/Hardware'
import * as emailService from '../emailService'

vi.mock('../emailService', () => ({
  sendReturnReminderEmail: vi.fn(),
  sendOnboardingEmail: vi.fn(),
  sendAssetAuditEmail: vi.fn()
}))

const mockQuery = (value: any) => {
  const p = Promise.resolve(value) as any
  p.populate = vi.fn().mockReturnValue(p)
  p.lean = vi.fn().mockReturnValue(p)
  p.sort = vi.fn().mockReturnValue(p)
  return p
}

describe('Smart Automations Worker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(Assignment, 'find').mockReturnValue(mockQuery([]))
    vi.spyOn(Employee, 'find').mockReturnValue(mockQuery([]))
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([]))
    vi.spyOn(Hardware, 'findByIdAndUpdate').mockResolvedValue({} as any)
  })

  it('should not process anything if no organizations have automations enabled', async () => {
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([]))

    await processSmartAutomations()

    expect(Organization.find).toHaveBeenCalledWith({
      $or: [
        { 'smartAutomations.returnReminders.enabled': true },
        { 'smartAutomations.onboardingEmails.enabled': true },
        { 'smartAutomations.offboardingCleanup.enabled': true },
        { 'smartAutomations.assetAudits.enabled': true },
        { 'smartAutomations.autoProvisioning.enabled': true }
      ]
    })
    expect(Assignment.find).not.toHaveBeenCalled()
    expect(Employee.find).not.toHaveBeenCalled()
  })

  it('should process return reminders correctly', async () => {
    const org = {
      _id: 'org1',
      smartAutomations: {
        returnReminders: { enabled: true, daysBefore: 3 }
      }
    }
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([org]))

    const mockSave = vi.fn()
    const assignment = {
      _id: 'ass1',
      employeeId: { email: 'test@example.com', firstName: 'John' },
      hardwareId: { manufacturer: 'Apple', model: 'MacBook Pro', serialNumber: '123' },
      expectedReturnDate: new Date('2023-12-01T00:00:00Z'),
      save: mockSave
    }

    vi.spyOn(Assignment, 'find').mockReturnValue(mockQuery([assignment]))
    vi.mocked(emailService.sendReturnReminderEmail).mockResolvedValue(true)

    await processSmartAutomations()

    expect(Assignment.find).toHaveBeenCalledWith({
      orgId: 'org1',
      returnedAt: { $exists: false },
      returnReminderSentAt: { $exists: false },
      expectedReturnDate: expect.any(Object)
    })

    expect(emailService.sendReturnReminderEmail).toHaveBeenCalledWith(
      'test@example.com',
      'John',
      'Apple MacBook Pro (123)',
      expect.any(String)
    )
    expect(mockSave).toHaveBeenCalled()
    expect(assignment.returnReminderSentAt).toBeDefined()
  })

  it('should process onboarding emails correctly', async () => {
    const org = {
      _id: 'org1',
      name: 'Test Org',
      smartAutomations: {
        onboardingEmails: { enabled: true, daysBefore: 0 }
      }
    }
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([org]))

    const mockSave = vi.fn()
    const employee = {
      _id: 'emp1',
      email: 'new@example.com',
      firstName: 'Jane',
      startDate: new Date('2023-11-01T00:00:00Z'),
      save: mockSave
    }
    vi.spyOn(Employee, 'find').mockReturnValue(mockQuery([employee]))
    vi.mocked(emailService.sendOnboardingEmail).mockResolvedValue(true)

    await processSmartAutomations()

    expect(Employee.find).toHaveBeenCalledWith({
      orgId: 'org1',
      startDate: expect.any(Object),
      onboardingEmailSentAt: { $exists: false },
      isActive: true
    })

    expect(emailService.sendOnboardingEmail).toHaveBeenCalledWith(
      'new@example.com',
      'Jane',
      expect.any(String),
      'Test Org'
    )
    expect(mockSave).toHaveBeenCalled()
    expect(employee.onboardingEmailSentAt).toBeDefined()
  })

  it('should process offboarding cleanup correctly', async () => {
    const org = {
      _id: 'org1',
      smartAutomations: {
        offboardingCleanup: { enabled: true }
      }
    }
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([org]))

    const mockEmpSave = vi.fn()
    const employee = {
      _id: 'emp1',
      endDate: new Date('2023-10-01T00:00:00Z'),
      save: mockEmpSave,
      isActive: true
    }

    const mockAssSave = vi.fn()
    const assignment: any = {
      _id: 'ass1',
      hardwareId: 'hw1',
      save: mockAssSave
    }

    vi.spyOn(Employee, 'find').mockReturnValue(mockQuery([employee]))
    vi.spyOn(Assignment, 'find').mockReturnValue(mockQuery([assignment]))

    await processSmartAutomations()

    expect(Employee.find).toHaveBeenCalledWith({
      orgId: 'org1',
      endDate: expect.any(Object),
      offboardingProcessedAt: { $exists: false },
      isActive: true
    })

    expect(Assignment.find).toHaveBeenCalledWith({
      employeeId: 'emp1',
      returnedAt: { $exists: false }
    })

    expect(mockAssSave).toHaveBeenCalled()
    expect(assignment.returnedAt).toBeDefined()
    expect(assignment.returnCondition).toBe('good')

    expect(Hardware.findByIdAndUpdate).toHaveBeenCalledWith('hw1', {
      status: 'available',
      assignedTo: null
    })

    expect(mockEmpSave).toHaveBeenCalled()
    expect(employee.isActive).toBe(false)
    expect(employee.offboardingProcessedAt).toBeDefined()
  })

  it('should process asset audits correctly', async () => {
    const org = {
      _id: 'org1',
      smartAutomations: {
        assetAudits: { enabled: true, frequencyMonths: 6 }
      }
    }
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([org]))

    const mockUpdateMany = vi.spyOn(Assignment, 'updateMany').mockResolvedValue({} as any)
    const assignment = {
      _id: 'ass1',
      employeeId: { _id: 'emp1', email: 'audit@example.com', firstName: 'AuditUser', isActive: true },
      hardwareId: { manufacturer: 'Apple', model: 'MacBook Pro', serialNumber: '123' },
      assignmentDate: new Date('2023-01-01T00:00:00Z')
    }

    vi.spyOn(Assignment, 'find').mockReturnValue(mockQuery([assignment]))
    vi.mocked(emailService.sendAssetAuditEmail).mockResolvedValue(true)

    await processSmartAutomations()

    expect(Assignment.find).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org1',
      status: 'active'
    }))

    expect(emailService.sendAssetAuditEmail).toHaveBeenCalledWith(
      'audit@example.com',
      'AuditUser',
      expect.any(String)
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['ass1'] } },
      { $set: { auditReminderSentAt: expect.any(Date) } }
    )
  })

  it('should process auto-provisioning correctly', async () => {
    const org = {
      _id: 'org1',
      smartAutomations: {
        autoProvisioning: {
          enabled: true,
          rules: [{ jobTitlePattern: 'Engineer', categories: ['laptop'] }]
        }
      }
    }
    vi.spyOn(Organization, 'find').mockReturnValue(mockQuery([org]))

    const employee = {
      _id: 'emp1',
      jobTitle: 'Software Engineer',
      isActive: true
    }
    vi.spyOn(Employee, 'find').mockReturnValue(mockQuery([employee]))

    vi.spyOn(Assignment, 'countDocuments').mockResolvedValue(0)

    const mockHwSave = vi.fn()
    const hardware = {
      _id: 'hw1',
      category: 'laptop',
      status: 'available',
      save: mockHwSave
    }
    vi.spyOn(Hardware, 'findOne').mockReturnValue(mockQuery(hardware))
    const mockAssCreate = vi.spyOn(Assignment, 'create').mockResolvedValue({} as any)

    await processSmartAutomations()

    expect(Hardware.findOne).toHaveBeenCalledWith({
      orgId: 'org1',
      category: 'laptop',
      status: 'available'
    })

    expect(mockAssCreate).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org1',
      employeeId: 'emp1',
      hardwareId: 'hw1',
      status: 'active'
    }))

    expect(mockHwSave).toHaveBeenCalled()
    expect(hardware.status).toBe('assigned')
    expect(hardware.assignedTo).toBe('emp1')
  })
})
