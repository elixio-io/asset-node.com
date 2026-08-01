<template>
  <div class="params-form">
    <span class="node-label">Maintenance Type</span>
    <select v-model="data.maintenanceType" class="node-select">
      <option value="preventive">🛡️ Preventive</option>
      <option value="repair">🔧 Repair</option>
      <option value="upgrade">⬆️ Upgrade</option>
      <option value="inspection">🔍 Inspection</option>
      <option value="cleaning">🧹 Cleaning</option>
    </select>

    <span class="node-label">Description</span>
    <textarea v-model="data.description" class="node-textarea" rows="3" placeholder="Auto-created by workflow…" />
    <div class="node-hint">Creates a scheduled maintenance record for each asset from the trigger context.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
