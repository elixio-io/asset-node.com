<template>
  <div class="params-form">
    <span class="node-label">Operation</span>
    <select v-model="data.operation" class="node-select">
      <option value="add">➕ Add Tag</option>
      <option value="remove">➖ Remove Tag</option>
    </select>

    <span class="node-label">Tag Value</span>
    <input v-model="data.tag" class="node-input" type="text" placeholder="e.g. needs-review, priority, retired…" />
    <div class="node-hint">Adds or removes the tag on all assets from the trigger context.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
