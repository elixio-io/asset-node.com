<template>
  <div class="params-form">
    <span class="node-label">Status code</span>
    <input v-model.number="data.status" type="number" class="node-input" min="100" max="599" step="1" placeholder="200" />

    <span class="node-label">Content type</span>
    <select v-model="data.contentType" class="node-select">
      <option value="application/json">application/json</option>
      <option value="text/plain">text/plain</option>
      <option value="text/html">text/html</option>
    </select>

    <span class="node-label">Response body</span>
    <textarea v-model="data.body" class="node-textarea" rows="4" placeholder='{"ok": true} — accepts {{variable}} placeholders' />

    <div class="node-hint">
      Only used when this workflow is started by a <strong>Webhook</strong> trigger
      whose response mode is set to <em>"Respond with a Respond node"</em>. The
      caller receives exactly this response.
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: Record<string, any> }>()
</script>
