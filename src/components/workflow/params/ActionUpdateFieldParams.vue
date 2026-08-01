<template>
  <div class="params-form">
    <span class="node-label">Entity</span>
    <select v-model="data.entity" class="node-select" @change="data.field = ''">
      <option value="">Select entity...</option>
      <option value="hardware">💻 Hardware</option>
      <option value="license">📄 License</option>
      <option value="consumable">📦 Consumable</option>
      <option value="employee">👤 Employee</option>
    </select>

    <span class="node-label">Field</span>
    <select v-model="data.field" class="node-select">
      <option value="">Select field...</option>
      <option v-for="field in availableFields" :key="field.value" :value="field.value">{{ field.label }}</option>
    </select>

    <span class="node-label">New Value</span>
    <input v-model="data.value" type="text" class="node-input" placeholder="New value or {{variable}}" />
    <div class="node-hint">Updates only the explicit entity ID supplied by the trigger or Manual / API payload.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data: Record<string, any> }>()

const fieldOptions: Record<string, { value: string; label: string }[]> = {
  hardware: [
    { value: 'assetName', label: 'Asset Name' },
    { value: 'notes', label: 'Notes' },
    { value: 'serialNumber', label: 'Serial Number' },
    { value: 'purchaseDate', label: 'Purchase Date' },
    { value: 'purchasePrice', label: 'Purchase Price' },
    { value: 'warrantyExpiry', label: 'Warranty Expiry' }
  ],
  license: [
    { value: 'name', label: 'License Name' },
    { value: 'notes', label: 'Notes' },
    { value: 'totalSeats', label: 'Total Seats' },
    { value: 'expirationDate', label: 'Expiration Date' },
    { value: 'renewalDate', label: 'Renewal Date' }
  ],
  consumable: [
    { value: 'name', label: 'Name' },
    { value: 'notes', label: 'Notes' },
    { value: 'totalQuantity', label: 'Total Quantity' },
    { value: 'minimumQuantity', label: 'Minimum Quantity' }
  ],
  employee: [
    { value: 'jobTitle', label: 'Job Title' },
    { value: 'notes', label: 'Notes' },
    { value: 'phone', label: 'Phone' }
  ]
}

const availableFields = computed(() => fieldOptions[props.data.entity] || [])
</script>
