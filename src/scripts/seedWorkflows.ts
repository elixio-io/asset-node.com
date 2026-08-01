
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

import { Workflow } from '../models/Workflow'
import { Organization } from '../models/Organization'
import { deriveWorkflowTriggers } from '../shared/workflowValidation'

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hardware-management'

async function seed() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const orgs = await Organization.find().lean()
  if (orgs.length === 0) { console.error('No organizations found!'); process.exit(1) }

  for (const org of orgs) {
    const orgId = org._id
    console.log(`\nSeeding workflows for org: ${org.name} (${orgId})`)

    const deleted = await Workflow.deleteMany({ orgId, name: { $regex: /^\[Demo\]/ } })
    console.log(`  🗑️  Deleted ${deleted.deletedCount} old demo workflows`)

  const workflows = [

    {
      name: '[Demo] Employee Onboarding Pipeline',
      description: 'When an HR sync creates employees, notify IT and write an audit entry for onboarding follow-up',
      isActive: true,
      trigger: { type: 'event', event: 'employee.synced' },
      nodes: [
        { id: 'n1', type: 'trigger-event', data: { event: 'employee.synced' }, position: { x: 50, y: 220 } },
        { id: 'n2', type: 'condition', data: { entity: 'employee', field: 'created', operator: 'gt', value: '0' }, position: { x: 300, y: 220 } },
        { id: 'n5', type: 'action-notify', data: { channel: 'slack', title: '👋 New hires synced', message: '{{created}} new employees were synced from HR. Review onboarding and hardware needs.' }, position: { x: 590, y: 100 } },
        { id: 'n6', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'Onboarding follow-up requested for {{created}} new employees' }, position: { x: 590, y: 280 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n5', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n2', target: 'n6', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] Warranty Expiry Alert',
      description: 'Check warranties daily and notify IT when a warranty expires within 30 days.',
      isActive: true,
      trigger: { type: 'schedule', cron: '*/24h', cronLabel: 'Daily' },
      nodes: [
        { id: 'n1', type: 'trigger-schedule', data: { cron: '*/24h' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'condition', data: { entity: 'hardware', field: 'warrantyExpiringCount', operator: 'gt', value: '0' }, position: { x: 300, y: 200 } },
        { id: 'n3', type: 'action-notify', data: { channel: 'email', title: '⚠️ Warranty Expiring', message: 'Devices have warranties expiring within 30 days. Review and plan replacements.' }, position: { x: 570, y: 100 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] MDM Sync Status Router',
      description: 'When MDM syncs, route by device count: 0 = failure, 1-50 = partial, 50+ = success',
      isActive: true,
      trigger: { type: 'event', event: 'hardware.synced' },
      nodes: [
        { id: 'n1', type: 'trigger-event', data: { event: 'hardware.synced' }, position: { x: 50, y: 220 } },
        { id: 'n2', type: 'logic-switch', data: { field: 'status', branches: ['failure', 'partial', 'success'] }, position: { x: 320, y: 150 } },
        { id: 'n3', type: 'action-notify', data: { channel: 'slack', title: '🔴 MDM Sync Failed', message: 'Sync returned 0 devices. Check provider credentials immediately.' }, position: { x: 650, y: 50 } },
        { id: 'n4', type: 'action-notify', data: { channel: 'email', title: '🟡 Partial MDM Sync', message: 'Sync returned fewer devices than expected. Some may have failed.' }, position: { x: 650, y: 200 } },
        { id: 'n5', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'MDM sync completed successfully: {{total}} devices processed' }, position: { x: 650, y: 350 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'branch-0', animated: true, style: { stroke: '#ef4444' } },
        { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 'branch-1', animated: true, style: { stroke: '#f97316' } },
        { id: 'e4', source: 'n2', target: 'n5', sourceHandle: 'branch-2', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] Employee Offboarding Cleanup',
      description: 'When an assignment is returned, tag the device for IT processing, notify IT, and log an audit entry',
      isActive: true,
      trigger: { type: 'event', event: 'assignment.returned' },
      nodes: [
        { id: 'n1', type: 'trigger-event', data: { event: 'assignment.returned' }, position: { x: 50, y: 220 } },
        { id: 'n3', type: 'action-tag', data: { operation: 'add', tag: 'returned-to-it' }, position: { x: 300, y: 320 } },
        { id: 'n4', type: 'action-notify', data: { channel: 'slack', title: '📦 Device Returned', message: 'A device has been returned and tagged for IT processing. Please schedule re-imaging.' }, position: { x: 580, y: 120 } },
        { id: 'n5', type: 'action-audit-log', data: { severity: 'info', category: 'compliance', message: 'Returned device tagged for IT processing' }, position: { x: 580, y: 320 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n3', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n3', target: 'n4', animated: true, style: { stroke: '#10b981' } },
        { id: 'e4', source: 'n3', target: 'n5', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] New Hardware Inspection',
      description: 'Newly created hardware schedules an inspection, creates an audit entry, and notifies the team',
      isActive: false,
      trigger: { type: 'event', event: 'hardware.created' },
      nodes: [
        { id: 'n1', type: 'trigger-event', data: { event: 'hardware.created' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'action-maintenance', data: { maintenanceType: 'inspection', description: 'New hardware intake inspection' }, position: { x: 320, y: 120 } },
        { id: 'n3', type: 'action-audit-log', data: { severity: 'info', category: 'operations', message: 'New hardware intake inspection scheduled' }, position: { x: 320, y: 320 } },
        { id: 'n4', type: 'action-notify', data: { channel: 'teams', title: '🔍 Hardware inspection scheduled', message: 'A newly created device has been added to the inspection queue.' }, position: { x: 600, y: 200 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n3', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n3', target: 'n4', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] License Renewal Pipeline',
      description: 'Weekly license check: if expiring, notify procurement and call the configured demo HTTPS endpoint',
      isActive: true,
      trigger: { type: 'schedule', cron: 'weekly', cronLabel: 'Weekly' },
      nodes: [
        { id: 'n1', type: 'trigger-schedule', data: { cron: 'weekly' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'condition', data: { entity: 'license', field: 'expiringCount', operator: 'gt', value: '0' }, position: { x: 300, y: 200 } },
        { id: 'n4', type: 'action-notify', data: { channel: 'email', title: '🔑 License Renewal Required', message: 'Licenses are expiring within 30 days. Review renewal options and budget allocation.' }, position: { x: 570, y: 200 } },
        { id: 'n5', type: 'action-webhook', data: { url: 'https://httpbin.org/post' }, position: { x: 840, y: 200 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n4', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n4', target: 'n5', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] Manual Inventory Audit',
      description: 'Triggered manually: write an audit entry, call a demo HTTPS endpoint, and email a completion notice',
      isActive: true,
      trigger: { type: 'manual' },
      nodes: [
        { id: 'n1', type: 'trigger-manual', data: { description: 'Run quarterly inventory audit' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'action-audit-log', data: { severity: 'info', category: 'compliance', message: 'Quarterly inventory audit initiated by IT admin' }, position: { x: 320, y: 100 } },
        { id: 'n3', type: 'action-webhook', data: { url: 'https://httpbin.org/post' }, position: { x: 320, y: 320 } },
        { id: 'n4', type: 'logic-delay', data: { duration: 3, unit: 'seconds' }, position: { x: 580, y: 200 } },
        { id: 'n5', type: 'action-notify', data: { channel: 'email', title: '📊 Inventory Audit Workflow Complete', message: 'The manual audit workflow completed and its demo endpoint accepted the event. Review inventory data in the dashboard.' }, position: { x: 840, y: 200 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n3', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n3', target: 'n4', animated: true, style: { stroke: '#10b981' } },
        { id: 'e4', source: 'n4', target: 'n5', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] Department Assignment Router',
      description: 'New hardware created: demonstrate department-specific branches that assign the linked IT admin with a tailored note',
      isActive: false,
      trigger: { type: 'event', event: 'hardware.created' },
      nodes: [
        { id: 'n1', type: 'trigger-event', data: { event: 'hardware.created' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'logic-switch', data: { field: 'department', branches: ['engineering', 'sales', 'design'] }, position: { x: 320, y: 130 } },
        { id: 'n3', type: 'action-assign', data: { assignTo: 'itAdmin', note: 'Engineering dept. auto-assign' }, position: { x: 620, y: 40 } },
        { id: 'n4', type: 'action-assign', data: { assignTo: 'itAdmin', note: 'Sales dept. auto-assign' }, position: { x: 620, y: 190 } },
        { id: 'n5', type: 'action-assign', data: { assignTo: 'itAdmin', note: 'Design dept. auto-assign' }, position: { x: 620, y: 340 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'branch-0', animated: true, style: { stroke: '#3b82f6' } },
        { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 'branch-1', animated: true, style: { stroke: '#f97316' } },
        { id: 'e4', source: 'n2', target: 'n5', sourceHandle: 'branch-2', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] Security Compliance Check',
      description: 'Every 6 hours: check device compliance, notify the CISO, and log a critical audit entry',
      isActive: true,
      trigger: { type: 'schedule', cron: '*/6h', cronLabel: 'Every 6 hours' },
      nodes: [
        { id: 'n1', type: 'trigger-schedule', data: { cron: '*/6h' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'condition', data: { entity: 'hardware', field: 'nonCompliantCount', operator: 'gt', value: '0' }, position: { x: 300, y: 200 } },
        { id: 'n4', type: 'action-audit-log', data: { severity: 'critical', category: 'security', message: 'Non-compliant devices detected during automated security scan' }, position: { x: 570, y: 240 } },
        { id: 'n5', type: 'action-notify', data: { channel: 'email', title: '🔒 Security Alert: Non-Compliant Devices', message: 'Automated scan detected non-compliant devices. Immediate review required by security team.' }, position: { x: 570, y: 400 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n4', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n2', target: 'n5', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } }
      ]
    },

    {
      name: '[Demo] Low Stock Auto-Reorder',
      description: 'Daily stock check: if low, notify Slack, wait a 30-second buffer, call a demo HTTPS endpoint, then log successful delivery',
      isActive: true,
      trigger: { type: 'schedule', cron: '*/24h', cronLabel: 'Daily' },
      nodes: [
        { id: 'n1', type: 'trigger-schedule', data: { cron: '*/24h' }, position: { x: 50, y: 200 } },
        { id: 'n2', type: 'condition', data: { entity: 'consumable', field: 'lowStockCount', operator: 'gt', value: '0' }, position: { x: 300, y: 200 } },
        { id: 'n4', type: 'action-notify', data: { channel: 'slack', title: '📦 Low Stock Warning', message: 'Consumable stock is below minimum. The demo webhook will run after a 30-second processing buffer.' }, position: { x: 560, y: 200 } },
        { id: 'n5', type: 'logic-delay', data: { duration: 30, unit: 'seconds' }, position: { x: 830, y: 200 } },
        { id: 'n6', type: 'action-webhook', data: { url: 'https://httpbin.org/post' }, position: { x: 1080, y: 120 } },
        { id: 'n7', type: 'action-audit-log', data: { severity: 'info', category: 'finance', message: 'Low-stock demo webhook delivered successfully' }, position: { x: 1080, y: 300 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', animated: true, style: { stroke: '#10b981' } },
        { id: 'e2', source: 'n2', target: 'n4', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } },
        { id: 'e3', source: 'n4', target: 'n5', animated: true, style: { stroke: '#10b981' } },
        { id: 'e5', source: 'n5', target: 'n6', animated: true, style: { stroke: '#10b981' } },
        { id: 'e6', source: 'n6', target: 'n7', animated: true, style: { stroke: '#10b981' } }
      ]
    }
  ]

  for (const wf of workflows) {
    // The legacy singular `trigger` in each definition is ignored by the new
    // schema — derive the canonical triggers[] from each definition's nodes.
    await Workflow.create({ orgId, ...wf, triggers: deriveWorkflowTriggers(wf.nodes as any) })
    console.log(`  ✅ ${wf.name}`)
  }

  console.log(`  → ${workflows.length} workflows seeded for ${org.name}`)
  }

  console.log(`\n⚡ Done! Seeded workflows for ${orgs.length} org(s).`)
  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
