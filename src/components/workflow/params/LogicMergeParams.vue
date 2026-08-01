<template>
  <div class="params-form">
    <span class="node-label">Continue when</span>
    <select v-model="data.mode" class="node-select">
      <option value="any">Any input arrives</option>
      <option value="all">All inputs arrive</option>
    </select>
    <div class="node-hint">Connect multiple branches to the Merge node to converge them into one path.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
