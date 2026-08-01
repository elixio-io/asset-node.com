<template>
  <div class="params-form">
    <span class="node-label">When this happens</span>
    <select v-model="data.event" class="node-select">
      <option value="" disabled>Select event...</option>
      <optgroup label="Hardware (MDM)">
        <option value="hardware.synced">🔄 Hardware Synced</option>
        <option value="hardware.created">➕ Hardware Created</option>
        <option value="hardware.updated">✏️ Hardware Updated</option>
        <option value="hardware.deleted">🗑️ Hardware Deleted</option>
      </optgroup>
      <optgroup label="Employees (HR)">
        <option value="employee.synced">🔄 Employee Synced</option>
        <option value="employee.created">➕ Employee Created</option>
        <option value="employee.updated">✏️ Employee Updated</option>
      </optgroup>
      <optgroup label="Operations">
        <option value="status.changed">🔀 Status Changed</option>
        <option value="assignment.created">📎 Assignment Created</option>
        <option value="assignment.returned">📦 Assignment Returned</option>
        <option value="maintenance.completed">🔧 Maintenance Done</option>
      </optgroup>
    </select>
    <div v-if="data.event" class="node-hint">{{ eventDescriptions[data.event] || '' }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()

const eventDescriptions: Record<string, string> = {
  'hardware.synced': 'Fires after each MDM sync completes',
  'hardware.created': 'Fires when a new asset is added',
  'employee.synced': 'Fires after each HR sync completes',
  'status.changed': 'Fires when any asset status changes',
  'assignment.created': 'Fires when hardware is assigned',
  'assignment.returned': 'Fires when hardware is returned',
  'maintenance.completed': 'Fires when maintenance finishes'
}
</script>
