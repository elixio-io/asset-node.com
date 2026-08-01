import { createServiceLogger } from './logger'
import { Organization } from '../../models/Organization'
import { Employee } from '../../models/Employee'
import { Assignment } from '../../models/Assignment'
import { Hardware } from '../../models/Hardware'
import { sendReturnReminderEmail, sendOnboardingEmail, sendAssetAuditEmail } from './emailService'
import jwt from 'jsonwebtoken'

const log = createServiceLogger('SmartAutomations')

export async function processSmartAutomations(): Promise<void> {
  const now = new Date()

  try {
    const orgs = await Organization.find({
      $or: [
        { 'smartAutomations.returnReminders.enabled': true },
        { 'smartAutomations.onboardingEmails.enabled': true },
        { 'smartAutomations.offboardingCleanup.enabled': true },
        { 'smartAutomations.assetAudits.enabled': true },
        { 'smartAutomations.autoProvisioning.enabled': true }
      ]
    }).lean()

    for (const org of orgs) {
      const automations = (org as any).smartAutomations || {}

      if (automations.returnReminders?.enabled) {
        await processReturnReminders(org, automations.returnReminders.daysBefore || 3, now)
      }

      if (automations.onboardingEmails?.enabled) {
        await processOnboardingEmails(org, automations.onboardingEmails.daysBefore || 0, now)
      }

      if (automations.offboardingCleanup?.enabled) {
        await processOffboardingCleanup(org, now)
      }

      if (automations.assetAudits?.enabled) {
        await processAssetAudits(org, automations.assetAudits.frequencyMonths || 6, now)
      }

      if (automations.autoProvisioning?.enabled) {
        await processAutoProvisioning(org, automations.autoProvisioning.rules || [], now)
      }
    }
  } catch (err) {
    log.error({ err }, 'Failed to process smart automations')
    throw err
  }
}

async function processReturnReminders(org: any, daysBefore: number, now: Date) {
  const targetMs = now.getTime() + daysBefore * 24 * 60 * 60 * 1000
  const targetDate = new Date(targetMs)

  const assignments = await Assignment.find({
    orgId: org._id,
    returnedAt: { $exists: false },
    returnReminderSentAt: { $exists: false },
    expectedReturnDate: { $lte: targetDate, $exists: true }
  }).populate('employeeId').populate('hardwareId')

  for (const assignment of assignments) {
    const employee: any = assignment.employeeId
    const hardware: any = assignment.hardwareId

    if (!employee || !employee.email || !hardware) continue

    const expectedDateStr = new Date(assignment.expectedReturnDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const assetName = `${hardware.manufacturer} ${hardware.model} (${hardware.serialNumber})`

    try {
      const success = await sendReturnReminderEmail(
        employee.email,
        employee.firstName || 'Nutzer',
        assetName,
        expectedDateStr
      )

      if (success) {
        assignment.returnReminderSentAt = now
        await assignment.save()
        log.info({ orgId: org._id, assignmentId: assignment._id }, 'Return reminder sent')
      }
    } catch (err) {
      log.error({ err, orgId: org._id, assignmentId: assignment._id }, 'Failed to send return reminder email')
    }
  }
}

async function processOnboardingEmails(org: any, daysBefore: number, now: Date) {
  const targetMs = now.getTime() + daysBefore * 24 * 60 * 60 * 1000
  const targetDate = new Date(targetMs)

  const employees = await Employee.find({
    orgId: org._id,
    startDate: { $lte: targetDate, $exists: true },
    onboardingEmailSentAt: { $exists: false },
    isActive: true
  })

  for (const employee of employees) {
    if (!employee.email) continue

    const startDateStr = new Date(employee.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

    try {
      const success = await sendOnboardingEmail(
        employee.email,
        employee.firstName || 'Nutzer',
        startDateStr,
        org.name
      )

      if (success) {
        employee.onboardingEmailSentAt = now
        await employee.save()
        log.info({ orgId: org._id, employeeId: employee._id }, 'Onboarding email sent')
      }
    } catch (err) {
      log.error({ err, orgId: org._id, employeeId: employee._id }, 'Failed to send onboarding email')
    }
  }
}

async function processOffboardingCleanup(org: any, now: Date) {
  const employees = await Employee.find({
    orgId: org._id,
    endDate: { $lte: now, $exists: true },
    offboardingProcessedAt: { $exists: false },
    isActive: true
  })

  for (const employee of employees) {
    try {
      const activeAssignments = await Assignment.find({
        employeeId: employee._id,
        returnedAt: { $exists: false }
      })

      for (const assignment of activeAssignments) {
        assignment.returnedAt = now
        assignment.returnCondition = 'good'
        assignment.notes = (assignment.notes ? assignment.notes + '\n' : '') + 'Automatically returned during offboarding cleanup.'
        await assignment.save()

        await Hardware.findByIdAndUpdate(assignment.hardwareId, {
          status: 'available',
          assignedTo: null
        })
      }

      employee.isActive = false
      employee.offboardingProcessedAt = now
      await employee.save()

      log.info({
        orgId: org._id,
        employeeId: employee._id,
        releasedAssets: activeAssignments.length
      }, 'Offboarding cleanup processed')

    } catch (err) {
      log.error({ err, orgId: org._id, employeeId: employee._id }, 'Failed to process offboarding cleanup')
    }
  }
}

async function processAssetAudits(org: any, frequencyMonths: number, now: Date) {
  const cutoffMs = now.getTime() - frequencyMonths * 30 * 24 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoffMs)



  const reminderCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const assignmentsToAudit = await Assignment.find({
    orgId: org._id,
    status: 'active',
    $or: [
      { lastAuditedAt: { $exists: false }, assignmentDate: { $lte: cutoffDate } },
      { lastAuditedAt: { $lte: cutoffDate } }
    ],
    $and: [
      {
        $or: [
          { auditReminderSentAt: { $exists: false } },
          { auditReminderSentAt: { $lte: reminderCutoff } }
        ]
      }
    ]
  }).populate('employeeId').populate('hardwareId')

  if (assignmentsToAudit.length === 0) return

  const employeeAssignmentsMap = new Map<string, typeof assignmentsToAudit>()
  for (const assignment of assignmentsToAudit) {
    if (!assignment.employeeId) continue
    const empId = (assignment.employeeId as any)._id.toString()
    if (!employeeAssignmentsMap.has(empId)) {
      employeeAssignmentsMap.set(empId, [])
    }
    employeeAssignmentsMap.get(empId)!.push(assignment)
  }

  const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET is required') })()
    : 'dev-jwt-secret-not-for-production-use-change-in-prod')

  const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

  for (const [empId, assignments] of employeeAssignmentsMap) {
    const employee: any = assignments[0].employeeId
    if (!employee || !employee.email || !employee.isActive) continue

    const token = jwt.sign(
      { employeeId: empId, orgId: org._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    const magicLink = `${BASE_URL}/api/audits/acknowledge?token=${token}`

    try {
      const success = await sendAssetAuditEmail(employee.email, employee.firstName || 'Nutzer', magicLink)
      if (success) {
        const assignmentIds = assignments.map(a => a._id)
        await Assignment.updateMany(
          { _id: { $in: assignmentIds } },
          { $set: { auditReminderSentAt: now } }
        )
        log.info({ orgId: org._id, employeeId: empId }, 'Asset audit email sent')
      }
    } catch (err) {
      log.error({ err, orgId: org._id, employeeId: empId }, 'Failed to send asset audit email')
    }
  }
}

async function processAutoProvisioning(org: any, rules: any[], now: Date) {
  if (!rules || rules.length === 0) return

  const activeEmployees = await Employee.find({
    orgId: org._id,
    isActive: true
  }).lean()

  for (const employee of activeEmployees) {
    if (!employee.jobTitle) continue

    const activeAssignmentsCount = await Assignment.countDocuments({
      employeeId: employee._id,
      status: 'active'
    })

    if (activeAssignmentsCount > 0) continue

    for (const rule of rules) {
      if (!rule.jobTitlePattern || !rule.categories || rule.categories.length === 0) continue

      const regex = new RegExp(rule.jobTitlePattern, 'i')
      if (regex.test(employee.jobTitle)) {
        for (const category of rule.categories) {
          const availableHardware = await Hardware.findOne({
            orgId: org._id,
            category: category,
            status: 'available'
          }).sort({ purchaseDate: -1 })

          if (availableHardware) {
            await Assignment.create({
              orgId: org._id,
              employeeId: employee._id,
              hardwareId: availableHardware._id,
              assignmentDate: now,
              status: 'active',
              notes: 'Automatically provisioned based on role: ' + rule.jobTitlePattern
            })

            availableHardware.status = 'assigned'
            availableHardware.assignedTo = employee._id as any
            await availableHardware.save()

            log.info({
              orgId: org._id,
              employeeId: employee._id,
              hardwareId: availableHardware._id
            }, `Auto-provisioned ${category} for role ${rule.jobTitlePattern}`)
          } else {
            log.info({
              orgId: org._id,
              employeeId: employee._id,
              category
            }, `Auto-provisioning failed: No available hardware for category ${category}`)
          }
        }
        break
      }
    }
  }
}


const AUTOMATIONS_CRON_INTERVAL = 60 * 60 * 1000

export function startSmartAutomationsCron(): void {
  setTimeout(() => {
    processSmartAutomations().catch(err =>
      log.error({ err }, 'Smart automations cron initial run failed')
    )
  }, 45_000)

  setInterval(() => {
    processSmartAutomations().catch(err =>
      log.error({ err }, 'Smart automations cron run failed')
    )
  }, AUTOMATIONS_CRON_INTERVAL)

  log.info('Smart automations cron started (every 1h)')
}
