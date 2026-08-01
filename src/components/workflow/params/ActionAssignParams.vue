<template>
  <div class="params-form">
    <span class="node-label">Assign to</span>
    <select v-model="data.assignTo" class="node-select">
      <option value="">Select target...</option>
      <option value="triggeredUser">👤 Triggered User</option>
      <option value="manager">👔 Department Manager</option>
      <option value="itAdmin">🔧 IT Admin</option>
      <option value="specific">📋 Specific Employee</option>
    </select>

    <template v-if="data.assignTo === 'specific'">
      <span class="node-label">Employee Email</span>
      <input v-model="data.employeeEmail" type="email" class="node-input" placeholder="name@company.com" />
    </template>

    <span class="node-label">Note</span>
    <input v-model="data.note" type="text" class="node-input" placeholder="Assignment note (optional)" />
    <div class="node-hint">
      Triggered User and Department Manager require Manual / API context with both hardwareId and employeeId.
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
