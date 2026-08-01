<template>
  <div class="params-form">
    <span class="node-label">Set asset status to</span>
    <select v-model="data.statusSlug" class="node-select">
      <option value="" disabled>Choose status...</option>
      <option value="available">✅ Available</option>
      <option value="assigned">🚀 Assigned</option>
      <option value="defective">⚠️ Defective</option>
      <option value="in-repair">🔧 In Repair</option>
      <option value="for-sale">🏷️ For Sale</option>
      <option value="retired">📦 Retired</option>
      <option value="lost">❓ Lost</option>
      <option value="disposed">🗑️ Disposed</option>
      <option value="on-order">🕘 On Order</option>
    </select>
    <div class="node-hint">Updates matching assets from the trigger context</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
