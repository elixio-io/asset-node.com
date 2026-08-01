<template>
  <div class="params-form">
    <span class="node-label">Severity</span>
    <select v-model="data.severity" class="node-select">
      <option value="info">ℹ️ Info</option>
      <option value="warning">⚠️ Warning</option>
      <option value="error">🔴 Error</option>
      <option value="critical">🚨 Critical</option>
    </select>

    <span class="node-label">Category</span>
    <select v-model="data.category" class="node-select">
      <option value="compliance">📋 Compliance</option>
      <option value="security">🔒 Security</option>
      <option value="operations">⚙️ Operations</option>
      <option value="finance">💰 Finance</option>
      <option value="custom">✏️ Custom</option>
    </select>

    <span class="node-label">Message</span>
    <textarea v-model="data.message" class="node-textarea" rows="3" placeholder="Audit log entry..." />
    <div class="node-hint">Recorded in Settings → Audits with full context.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
