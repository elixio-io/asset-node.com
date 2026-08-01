export type WorkflowNodeCategory = 'trigger' | 'logic' | 'action'

/**
 * How a node's output handles are laid out on the canvas card:
 * - 'single'    one unnamed source handle
 * - 'condition' true/false handles
 * - 'pass'      one source handle with id "true" (Filter: continue-on-pass)
 * - 'switch'    dynamic branch-N handles + default, driven by data.branches
 * - 'none'      terminal node, no output (Stop and Error)
 * - 'loop'      two handles: "loop" (body, runs each iteration) + "done" (after)
 * - 'approval'  two handles: "approved" + "rejected" (human decision)
 */
export type WorkflowNodeOutputs = 'single' | 'condition' | 'pass' | 'switch' | 'none' | 'loop' | 'approval'

export interface WorkflowNodeCatalogEntry {
  type: string
  category: WorkflowNodeCategory
  label: string
  description: string
  icon: string
  /** Legal (validates/executes) but not offered in any picker/palette. */
  hidden?: boolean
  outputs: WorkflowNodeOutputs
  createDefaultData: () => Record<string, any>
  /** One-line config summary shown on the slim canvas card. */
  summarize: (data: Record<string, any>) => string
}

const OPERATOR_SYMBOLS: Record<string, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠'
}

// Sync targets for the Sync Integrations action. Keys match the individual sync
// services; 'all' runs a full sync of every enabled integration.
export const SYNC_PROVIDER_LABELS: Record<string, string> = {
  all: 'All integrations',
  intune: 'Intune',
  autopilot: 'Autopilot',
  jamf: 'Jamf',
  kandji: 'Kandji',
  mosyle: 'Mosyle',
  googleWorkspace: 'Google Workspace',
  personio: 'Personio',
  bamboohr: 'BambooHR',
  hibob: 'HiBob'
}

export const SYNC_PROVIDERS = Object.keys(SYNC_PROVIDER_LABELS)

// Entities the "Get Records" source node can load into the item stream.
export const GET_RECORDS_ENTITY_LABELS: Record<string, string> = {
  hardware: 'Hardware',
  employee: 'Employees',
  license: 'Licenses',
  consumable: 'Consumables'
}
export const GET_RECORDS_ENTITIES = Object.keys(GET_RECORDS_ENTITY_LABELS)
export const GET_RECORDS_MAX_LIMIT = 500

function summarizeCheck(data: Record<string, any>): string {
  if (!data.entity || !data.field) return 'Not configured'
  return `${data.entity}.${data.field} ${OPERATOR_SYMBOLS[data.operator] || data.operator || '?'} ${data.value ?? ''}`.trim()
}

// Single source of truth for node-type metadata: drives the sidebar palette,
// the node picker panel, and WORKFLOW_NODE_TYPES in workflowValidation.
export const WORKFLOW_NODE_CATALOG: WorkflowNodeCatalogEntry[] = [
  {
    type: 'trigger-event',
    category: 'trigger',
    label: 'Event',
    description: 'React to system events',
    icon: 'pi pi-bolt',
    outputs: 'single',
    createDefaultData: () => ({ event: '' }),
    summarize: data => data.event ? String(data.event) : 'Choose an event'
  },
  {
    type: 'trigger-schedule',
    category: 'trigger',
    label: 'Schedule',
    description: 'Run on a timer',
    icon: 'pi pi-clock',
    outputs: 'single',
    createDefaultData: () => ({ cron: '' }),
    summarize: data => data.cronLabel || data.cron || 'Choose an interval'
  },
  {
    type: 'trigger-webhook',
    category: 'trigger',
    label: 'Webhook',
    description: 'Incoming HTTP trigger',
    icon: 'pi pi-link',
    outputs: 'single',
    createDefaultData: () => ({ method: 'POST', path: '' }),
    summarize: data => `${data.method || 'POST'} · ${data.hookId ? 'URL issued' : 'save to get a URL'}`
  },
  {
    type: 'trigger-manual',
    category: 'trigger',
    label: 'Manual / API',
    description: 'Test button or authenticated API',
    icon: 'pi pi-play',
    outputs: 'single',
    createDefaultData: () => ({ description: '' }),
    summarize: () => 'Run manually or via API'
  },
  {
    type: 'condition',
    category: 'logic',
    label: 'Condition',
    description: 'Branch with if/else',
    icon: 'pi pi-question-circle',
    outputs: 'condition',
    createDefaultData: () => ({ entity: '', field: '', operator: 'gt', value: '' }),
    summarize: summarizeCheck
  },
  {
    type: 'filter',
    category: 'logic',
    label: 'Filter',
    description: 'Continue only when a check passes',
    icon: 'pi pi-filter',
    outputs: 'pass',
    createDefaultData: () => ({ entity: '', field: '', operator: 'gt', value: '' }),
    summarize: summarizeCheck
  },
  {
    type: 'logic-merge',
    category: 'logic',
    label: 'Merge',
    description: 'Converge branches into one path',
    icon: 'pi pi-sitemap',
    outputs: 'single',
    createDefaultData: () => ({ mode: 'any' }),
    summarize: data => data.mode === 'all' ? 'When all inputs arrive' : 'When any input arrives'
  },
  {
    type: 'logic-stop-error',
    category: 'logic',
    label: 'Stop and Error',
    description: 'Fail the run with a message',
    icon: 'pi pi-ban',
    outputs: 'none',
    createDefaultData: () => ({ message: '' }),
    summarize: data => data.message ? `"${data.message}"` : 'Enter an error message'
  },
  {
    type: 'logic-noop',
    category: 'logic',
    label: 'No Operation',
    description: 'Pass through without doing anything',
    icon: 'pi pi-minus-circle',
    outputs: 'single',
    createDefaultData: () => ({}),
    summarize: () => 'Pass through'
  },
  {
    type: 'logic-approval',
    category: 'logic',
    label: 'Human Review',
    description: 'Pause for an approve/reject decision',
    icon: 'pi pi-check-square',
    outputs: 'approval',
    createDefaultData: () => ({ channel: 'email', approverEmail: '', title: '', message: '' }),
    summarize: data => data.approverEmail ? `Ask ${data.approverEmail}` : 'Enter an approver'
  },
  {
    type: 'logic-loop',
    category: 'logic',
    label: 'Loop',
    description: 'Repeat a branch for each item, N times, or while a check holds',
    icon: 'pi pi-replay',
    outputs: 'loop',
    createDefaultData: () => ({ mode: 'forEach', entity: '', field: '', operator: 'gt', value: '', count: 3, maxIterations: 100 }),
    summarize: data => {
      const cap = ` (max ${data.maxIterations ?? 100})`
      if (data.mode === 'times') return `Repeat ${data.count ?? 0}×${cap}`
      if (data.mode === 'while') return `While ${summarizeCheck(data)}${cap}`
      if (data.mode === 'forEachItem') return `For each input item${cap}`
      return `For each ${data.entity || '…'}${data.field ? ` where ${summarizeCheck(data)}` : ''}${cap}`
    }
  },
  {
    type: 'logic-switch',
    category: 'logic',
    label: 'Switch / Cases',
    description: 'Route exact field values',
    icon: 'pi pi-directions',
    outputs: 'switch',
    createDefaultData: () => ({ field: '', branches: ['', '', ''] }),
    summarize: data => {
      const configured = (Array.isArray(data.branches) ? data.branches : []).filter((b: unknown) => String(b || '').trim()).length
      return data.field ? `by ${data.field} · ${configured} case${configured === 1 ? '' : 's'}` : 'Choose a field'
    }
  },
  {
    type: 'logic-delay',
    category: 'logic',
    label: 'Delay',
    description: 'Wait before continuing',
    icon: 'pi pi-stopwatch',
    outputs: 'single',
    createDefaultData: () => ({ duration: 5, unit: 'seconds' }),
    summarize: data => `Wait ${data.duration ?? 5}s`
  },
  {
    type: 'action-get-records',
    category: 'action',
    label: 'Get Records',
    description: 'Load records into the stream',
    icon: 'pi pi-database',
    outputs: 'single',
    createDefaultData: () => ({ entity: 'hardware', limit: 50 }),
    summarize: data => `Get ${data.limit ?? 50} ${GET_RECORDS_ENTITY_LABELS[String(data.entity)] || data.entity || 'records'}`
  },
  {
    type: 'action-notify',
    category: 'action',
    label: 'Notify',
    description: 'Email, Slack, Teams',
    icon: 'pi pi-bell',
    outputs: 'single',
    createDefaultData: () => ({ channel: 'email', title: '', message: '' }),
    summarize: data => data.title ? `${data.channel || 'email'}: ${data.title}` : 'Enter subject and message'
  },
  {
    type: 'action-status',
    category: 'action',
    label: 'Status',
    description: 'Change asset status',
    icon: 'pi pi-flag',
    outputs: 'single',
    createDefaultData: () => ({ statusSlug: '' }),
    summarize: data => data.statusSlug ? `Set to "${data.statusSlug}"` : 'Choose a status'
  },
  {
    type: 'action-assign',
    category: 'action',
    label: 'Assign',
    description: 'Assign to employee',
    icon: 'pi pi-user-plus',
    outputs: 'single',
    createDefaultData: () => ({ assignTo: '', employeeEmail: '', note: '' }),
    summarize: data => data.assignTo === 'specific'
      ? `To ${data.employeeEmail || '…'}`
      : data.assignTo ? `To ${data.assignTo}` : 'Choose a target'
  },
  {
    type: 'action-update-field',
    category: 'action',
    label: 'Update Field',
    description: 'Change entity data',
    icon: 'pi pi-pencil',
    outputs: 'single',
    createDefaultData: () => ({ entity: '', field: '', value: '' }),
    summarize: data => data.entity && data.field ? `${data.entity}.${data.field} = ${data.value ?? ''}` : 'Not configured'
  },
  {
    type: 'action-tag',
    category: 'action',
    label: 'Tag',
    description: 'Add or remove asset tags',
    icon: 'pi pi-tag',
    outputs: 'single',
    createDefaultData: () => ({ tag: '', operation: 'add' }),
    summarize: data => data.tag ? `${data.operation === 'remove' ? 'Remove' : 'Add'} "${data.tag}"` : 'Enter a tag'
  },
  {
    type: 'action-maintenance',
    category: 'action',
    label: 'Maintenance',
    description: 'Create maintenance record',
    icon: 'pi pi-wrench',
    outputs: 'single',
    createDefaultData: () => ({ maintenanceType: 'preventive', description: 'Auto-created by workflow' }),
    summarize: data => data.maintenanceType ? `Create ${data.maintenanceType} record` : 'Choose a type'
  },
  {
    type: 'action-webhook',
    category: 'action',
    label: 'HTTP Request',
    description: 'Call an external HTTP API',
    icon: 'pi pi-send',
    outputs: 'single',
    createDefaultData: () => ({ url: '', method: 'POST', headers: [], body: '' }),
    summarize: data => data.url ? `${data.method || 'POST'} ${data.url}` : 'Enter a URL'
  },
  {
    type: 'action-audit-log',
    category: 'action',
    label: 'Audit Log',
    description: 'Create compliance entry',
    icon: 'pi pi-file-edit',
    outputs: 'single',
    createDefaultData: () => ({ severity: 'info', category: 'operations', message: '' }),
    summarize: data => data.message ? `${data.severity || 'info'}: ${data.message}` : 'Enter a message'
  },
  {
    type: 'action-respond',
    category: 'action',
    label: 'Respond to Webhook',
    description: 'Return a custom HTTP response to the caller',
    icon: 'pi pi-reply',
    outputs: 'single',
    createDefaultData: () => ({ status: 200, contentType: 'application/json', body: '' }),
    summarize: data => `Respond ${data.status || 200} ${data.contentType || 'application/json'}`
  },
  {
    type: 'action-sync',
    category: 'action',
    label: 'Sync Integrations',
    description: 'Trigger an MDM/HR sync',
    icon: 'pi pi-sync',
    outputs: 'single',
    createDefaultData: () => ({ provider: 'all' }),
    summarize: data => (!data.provider || data.provider === 'all')
      ? 'Run a full integration sync'
      : `Sync ${SYNC_PROVIDER_LABELS[String(data.provider)] || data.provider}`
  },
  {
    type: 'action-helpdesk',
    category: 'action',
    label: 'Helpdesk Ticket',
    description: 'Open a Zendesk/Freshdesk ticket',
    icon: 'pi pi-ticket',
    outputs: 'single',
    createDefaultData: () => ({ subject: '', description: '', priority: 'medium', category: 'operations', requesterEmail: '', requesterName: '' }),
    summarize: data => data.subject ? `${data.priority || 'medium'}: ${data.subject}` : 'Enter subject and requester'
  }
]

export const WORKFLOW_NODE_CATALOG_BY_TYPE: Record<string, WorkflowNodeCatalogEntry> =
  Object.fromEntries(WORKFLOW_NODE_CATALOG.map(entry => [entry.type, entry]))

export function createDefaultNodeData(type: string): Record<string, any> {
  return WORKFLOW_NODE_CATALOG_BY_TYPE[type]?.createDefaultData() ?? {}
}
