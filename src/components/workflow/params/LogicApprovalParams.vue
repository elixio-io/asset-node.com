<template>
  <div class="params-form">
    <span class="node-label">Send request via</span>
    <select v-model="data.channel" class="node-select">
      <option value="email">📧 Email (to the approver)</option>
      <option value="slack">💬 Slack channel</option>
      <option value="teams">🟣 MS Teams channel</option>
    </select>

    <span class="node-label">Approver email</span>
    <input v-model="data.approverEmail" type="text" class="node-input" placeholder="approver@company.com or {{managerEmail}}" />

    <span class="node-label">Title</span>
    <input v-model="data.title" type="text" class="node-input" placeholder="Approve device wipe?" />

    <span class="node-label">Message</span>
    <textarea v-model="data.message" class="node-textarea" rows="4" placeholder="Give the approver the context they need. Use {{variable}} for dynamic data..." />

    <div class="node-hint">
      The run pauses here until the approver clicks Approve or Reject in the
      request. It then continues along the matching output. Approval links are
      single-use and expire after 30 days.
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
