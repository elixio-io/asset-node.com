import { deriveWorkflowTriggers } from './workflowValidation'
import type { WorkflowGraphEdge, WorkflowGraphNode, WorkflowTriggerConfig } from './workflowValidation'

export type WorkflowTemplateId = 'blank' | 'warranty-alert' | 'auto-status' | 'inventory-audit'

export interface WorkflowStarterTemplate {
  id: WorkflowTemplateId
  name: string
  description: string
  icon: string
  trigger: WorkflowTriggerConfig
  nodes: WorkflowGraphNode[]
  edges: WorkflowGraphEdge[]
}

export const WORKFLOW_STARTER_TEMPLATES: WorkflowStarterTemplate[] = [
  {
    id: 'warranty-alert',
    name: 'Warranty Alert',
    description: 'Check warranties daily and notify IT when replacements need attention.',
    icon: 'pi pi-bell',
    trigger: { type: 'schedule', cron: '*/24h', cronLabel: 'Daily' },
    nodes: [
      { id: 'trigger', type: 'trigger-schedule', data: { cron: '*/24h' }, position: { x: 80, y: 220 } },
      { id: 'condition', type: 'condition', data: { entity: 'hardware', field: 'warrantyExpiringCount', operator: 'gt', value: '0' }, position: { x: 380, y: 180 } },
      { id: 'notify', type: 'action-notify', data: { channel: 'email', title: 'Warranty expires soon', message: 'One or more device warranties expire within 30 days.' }, position: { x: 700, y: 120 } }
    ],
    edges: [
      { id: 'trigger-condition', source: 'trigger', target: 'condition' },
      { id: 'condition-notify', source: 'condition', target: 'notify', sourceHandle: 'true' }
    ]
  },
  {
    id: 'auto-status',
    name: 'New Hardware Status',
    description: 'Mark newly created hardware as available automatically.',
    icon: 'pi pi-sync',
    trigger: { type: 'event', event: 'hardware.created' },
    nodes: [
      { id: 'trigger', type: 'trigger-event', data: { event: 'hardware.created' }, position: { x: 100, y: 200 } },
      { id: 'status', type: 'action-status', data: { statusSlug: 'available' }, position: { x: 460, y: 200 } }
    ],
    edges: [
      { id: 'trigger-status', source: 'trigger', target: 'status' }
    ]
  },
  {
    id: 'inventory-audit',
    name: 'Inventory Audit',
    description: 'Create a traceable audit entry whenever an admin starts the workflow.',
    icon: 'pi pi-file-edit',
    trigger: { type: 'manual' },
    nodes: [
      { id: 'trigger', type: 'trigger-manual', data: { description: 'Run an inventory audit manually or via API' }, position: { x: 100, y: 200 } },
      { id: 'audit', type: 'action-audit-log', data: { severity: 'info', category: 'compliance', message: 'Inventory audit initiated by an administrator.' }, position: { x: 460, y: 200 } }
    ],
    edges: [
      { id: 'trigger-audit', source: 'trigger', target: 'audit' }
    ]
  }
]

export function buildWorkflowStarter(templateId: WorkflowTemplateId, sequence: number) {
  if (templateId === 'blank') {
    const nodes: WorkflowGraphNode[] = [
      {
        id: 'trigger',
        type: 'trigger-manual',
        data: { description: 'Run manually or via API' },
        position: { x: 100, y: 200 }
      }
    ]
    return {
      name: `Untitled automation ${sequence}`,
      description: '',
      trigger: { type: 'manual' } as WorkflowTriggerConfig,
      triggers: deriveWorkflowTriggers(nodes),
      nodes,
      edges: [] as WorkflowGraphEdge[]
    }
  }

  const template = WORKFLOW_STARTER_TEMPLATES.find(item => item.id === templateId)
  if (!template) throw new Error(`Unknown workflow template: ${templateId}`)

  const cloned = JSON.parse(JSON.stringify({
    name: template.name,
    description: template.description,
    trigger: template.trigger,
    nodes: template.nodes,
    edges: template.edges
  })) as {
    name: string
    description: string
    trigger: WorkflowTriggerConfig
    nodes: WorkflowGraphNode[]
    edges: WorkflowGraphEdge[]
  }

  return { ...cloned, triggers: deriveWorkflowTriggers(cloned.nodes) }
}
