<template>
  <div class="params-form">
    <span class="node-label">Wait for</span>
    <div class="condition-row">
      <input v-model="data.duration" type="number" class="node-input" placeholder="5" min="1" max="30" step="1" style="width:80px;flex:0 0 80px;" />
      <select v-model="data.unit" class="node-select" style="flex:1;">
        <option value="seconds">seconds</option>
      </select>
    </div>
    <div class="node-hint">Maximum 30 seconds. Longer waits require durable background jobs and are intentionally unavailable.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
