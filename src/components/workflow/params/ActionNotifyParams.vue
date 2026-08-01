<template>
  <div class="params-form">
    <span class="node-label">Channel</span>
    <select v-model="data.channel" class="node-select">
      <option value="email">📧 Email</option>
      <option value="slack">💬 Slack</option>
      <option value="teams">🟣 MS Teams</option>
    </select>

    <span class="node-label">Subject</span>
    <input v-model="data.title" type="text" class="node-input" placeholder="Notification title..." />

    <span class="node-label">Message</span>
    <textarea v-model="data.message" class="node-textarea" rows="4" placeholder="Use {{variable}} for dynamic data..." />
    <div class="node-hint">
      Variables: {{provider}}, {{created}}, {{updated}}, {{total}}. The selected channel must be enabled in Settings → Notifications.
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
