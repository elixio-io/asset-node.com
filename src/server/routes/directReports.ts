import { FastifyPluginAsync } from 'fastify'
import { Employee } from '../../models/Employee'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Assignment } from '../../models/Assignment'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter } from '../middleware/tenantScope'

const directReportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/', async (request, reply) => {
    const user = request.user as { userId: string; orgId: string }
    const tenantFilter = getTenantFilter(request)

    const me = await Employee.findOne({ ...tenantFilter, userId: user.userId })
    if (!me) {
      return reply.code(404).send({ error: 'No employee profile linked to your account' })
    }

    const reports = await Employee.find({
      ...tenantFilter,
      managerId: me._id,
      isActive: true
    }).lean()

    const enrichedReports = await Promise.all(
      reports.map(async (emp) => {
        const [hardware, peripherals, assignments] = await Promise.all([
          Hardware.find({ ...tenantFilter, assignedTo: emp._id })
            .select('serialNumber model category status')
            .lean(),
          Peripheral.find({ ...tenantFilter, assignedTo: emp._id })
            .select('serialNumber model type status')
            .lean(),
          Assignment.find({ ...tenantFilter, employeeId: emp._id })
            .select('status assignmentDate acknowledgedAt returnRequestedAt')
            .sort({ assignmentDate: -1 })
            .lean()
        ])

        return {
          employee: {
            _id: emp._id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            department: emp.department,
            jobTitle: emp.jobTitle,
            startDate: emp.startDate
          },
          hardware,
          peripherals,
          assignments,
          summary: {
            totalHardware: hardware.length,
            totalPeripherals: peripherals.length,
            activeAssignments: assignments.filter(a => a.status === 'active').length,
            pendingReturns: assignments.filter(a => a.status === 'pendingReturn').length,
            unacknowledged: assignments.filter(a => a.status === 'active' && !a.acknowledgedAt).length
          }
        }
      })
    )

    return {
      manager: { name: `${me.firstName} ${me.lastName}`, id: me._id },
      directReports: enrichedReports,
      totals: {
        employees: enrichedReports.length,
        totalHardware: enrichedReports.reduce((s, r) => s + r.summary.totalHardware, 0),
        totalPeripherals: enrichedReports.reduce((s, r) => s + r.summary.totalPeripherals, 0),
        pendingReturns: enrichedReports.reduce((s, r) => s + r.summary.pendingReturns, 0),
        unacknowledged: enrichedReports.reduce((s, r) => s + r.summary.unacknowledged, 0)
      }
    }
  })
}

export default directReportsRoutes
