<template>
  <div class="params-form">
    <span class="node-label">Description</span>
    <input v-model="data.description" type="text" class="node-input" placeholder="What does this trigger do?" />
    <div class="node-hint">Runs when you press "Test" or via the API.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
