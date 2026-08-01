<template>
  <div class="params-form">
    <span class="node-label">Run automatically</span>
    <select v-model="data.cron" class="node-select">
      <option value="" disabled>Select interval...</option>
      <optgroup label="Minutes">
        <option value="*/5m">Every 5 minutes</option>
        <option value="*/15m">Every 15 minutes</option>
        <option value="*/30m">Every 30 minutes</option>
      </optgroup>
      <optgroup label="Hours">
        <option value="*/1h">Every hour</option>
        <option value="*/6h">Every 6 hours</option>
        <option value="*/12h">Every 12 hours</option>
      </optgroup>
      <optgroup label="Days">
        <option value="*/24h">Daily</option>
        <option value="weekly">Weekly</option>
      </optgroup>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
