<template>
  <div class="params-form">
    <span class="node-label">Subject</span>
    <input v-model="data.subject" type="text" class="node-input" placeholder="Ticket subject..." />

    <span class="node-label">Description</span>
    <textarea v-model="data.description" class="node-textarea" rows="4" placeholder="Use {{variable}} for dynamic data..." />

    <span class="node-label">Priority</span>
    <select v-model="data.priority" class="node-select">
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="critical">Critical</option>
    </select>

    <span class="node-label">Category</span>
    <select v-model="data.category" class="node-select">
      <option value="operations">Operations</option>
      <option value="security">Security</option>
      <option value="compliance">Compliance</option>
      <option value="hardware">Hardware</option>
      <option value="other">Other</option>
    </select>

    <span class="node-label">Requester email</span>
    <input v-model="data.requesterEmail" type="text" class="node-input" placeholder="name@company.com or {{userEmail}}" />

    <span class="node-label">Requester name (optional)</span>
    <input v-model="data.requesterName" type="text" class="node-input" placeholder="Automation" />

    <div class="node-hint">
      Opens a ticket in the Zendesk/Freshdesk integration configured under
      <em>Settings → Integrations</em>. Text fields accept
      <code v-pre>{{variable}}</code> placeholders from the trigger payload.
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
