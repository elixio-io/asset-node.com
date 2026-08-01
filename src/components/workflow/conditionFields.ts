// Labeled field options for condition-style nodes (Condition, Filter).
// Value lists must stay in sync with WORKFLOW_CONDITION_FIELDS in
// src/shared/workflowValidation.ts, which is what validation enforces.
export const CONDITION_FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  hardware: [
    { value: 'warrantyExpiringCount', label: '⏰ Warranties expiring (30d)' },
    { value: 'warrantyDaysRemaining', label: '⏰ Warranty days remaining' },
    { value: 'totalCount', label: '📊 Total device count' },
    { value: 'deviceAge', label: '📅 Average device age (years)' },
    { value: 'nonCompliantCount', label: '🔒 Non-compliant devices' }
  ],
  employee: [
    { value: 'totalCount', label: '📊 Total employee count' },
    { value: 'created', label: '➕ Created by event' },
    { value: 'updated', label: '✏️ Updated by event' }
  ],
  license: [
    { value: 'expiringCount', label: '⏰ Expiring licenses (30d)' }
  ],
  consumable: [
    { value: 'lowStockCount', label: '⚠️ Low stock items' }
  ]
}
