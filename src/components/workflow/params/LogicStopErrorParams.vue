<template>
  <div class="params-form">
    <span class="node-label">Error message</span>
    <textarea v-model="data.message" class="node-textarea" rows="3" placeholder="Why this run must stop..."></textarea>
    <div class="node-hint">Fails the run with this message. Everything downstream is skipped.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
