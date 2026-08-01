// Starting triggerData suggestion for per-node testing — a static lookup
// matching the alias resolution in workflowRouting.ts, not "smart" inference.
// Placeholder IDs will genuinely fail (executors verify org ownership); the
// panel tells the user to substitute real IDs.

const HARDWARE_TARGET = { hardwareId: '' }
const EMPLOYEE_TARGET = { employeeId: '' }

const DEFAULTS_BY_TYPE: Record<string, Record<string, any>> = {
  'action-status': { ...HARDWARE_TARGET },
  'action-tag': { ...HARDWARE_TARGET },
  'action-maintenance': { ...HARDWARE_TARGET },
  'action-assign': { ...HARDWARE_TARGET, ...EMPLOYEE_TARGET },
  'logic-switch': { status: '' },
  'condition': {},
  'filter': {}
}

const DEFAULTS_BY_ENTITY: Record<string, Record<string, any>> = {
  hardware: { hardwareId: '' },
  employee: { employeeId: '' },
  license: { licenseId: '' },
  consumable: { consumableId: '' }
}

export function guessDefaultTriggerData(node: { type?: string; data?: Record<string, any> }): Record<string, any> {
  const type = String(node.type || '')

  if (type === 'action-update-field') {
    return { ...(DEFAULTS_BY_ENTITY[String(node.data?.entity || '')] || {}) }
  }
  if ((type === 'condition' || type === 'filter') && node.data?.field) {
    // Non-aggregate condition fields read straight from triggerData.
    const aggregateFields = new Set([
      'warrantyExpiringCount', 'warrantyDaysRemaining', 'totalCount',
      'deviceAge', 'nonCompliantCount', 'expiringCount', 'lowStockCount'
    ])
    if (!aggregateFields.has(String(node.data.field))) {
      return { [String(node.data.field)]: '' }
    }
    return {}
  }
  return { ...(DEFAULTS_BY_TYPE[type] || {}) }
}

// Suggested input for testing UP TO a node: union of what every node in the
// prefix would want. The caller passes the nodes that will run.
export function guessDefaultTriggerDataForPrefix(nodes: Array<{ type?: string; data?: Record<string, any> }>): Record<string, any> {
  const merged: Record<string, any> = {}
  for (const node of nodes) {
    Object.assign(merged, guessDefaultTriggerData(node))
  }
  return merged
}
