<template>
  <div class="params-form">
    <span class="node-label">Method</span>
    <select v-model="data.method" class="node-select">
      <option value="GET">GET</option>
      <option value="POST">POST</option>
      <option value="PUT">PUT</option>
      <option value="PATCH">PATCH</option>
      <option value="DELETE">DELETE</option>
    </select>

    <span class="node-label">URL</span>
    <input v-model="data.url" type="url" class="node-input" placeholder="https://api.example.com/endpoint" />

    <span class="node-label">Headers</span>
    <div v-for="(header, i) in headers" :key="i" class="header-row">
      <input :value="header.key" type="text" class="node-input" placeholder="Header" @input="updateHeader(i, 'key', ($event.target as HTMLInputElement).value)" />
      <input :value="header.value" type="text" class="node-input" placeholder="Value" @input="updateHeader(i, 'value', ($event.target as HTMLInputElement).value)" />
      <button type="button" class="header-remove-btn" title="Remove header" @click="removeHeader(i)"><i class="pi pi-times" /></button>
    </div>
    <button type="button" class="header-add-btn" @click="addHeader"><i class="pi pi-plus" /> Add header</button>

    <template v-if="sendsBody">
      <span class="node-label">Body</span>
      <textarea v-model="data.body" class="node-textarea" rows="4" placeholder='{"key": "value"} — leave empty to send the workflow event payload' />
    </template>

    <div class="node-hint">
      Sends to a public HTTPS host only. Redirects and private/internal network
      targets are blocked. Values accept <code v-pre>{{variable}}</code> placeholders.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data: Record<string, any> }>()

const sendsBody = computed(() => !['GET', 'HEAD'].includes(String(props.data.method || 'POST').toUpperCase()))

const headers = computed(() => Array.isArray(props.data.headers) ? props.data.headers : [])

function ensureHeaders(): any[] {
  if (!Array.isArray(props.data.headers)) props.data.headers = []
  return props.data.headers
}
function updateHeader(index: number, field: 'key' | 'value', value: string) {
  const list = ensureHeaders()
  list[index] = { ...list[index], [field]: value }
}
function addHeader() { ensureHeaders().push({ key: '', value: '' }) }
function removeHeader(index: number) { ensureHeaders().splice(index, 1) }
</script>

<style scoped>
.header-row { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
.header-remove-btn {
  flex-shrink: 0; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; border: 1px solid var(--an-border-dark, #27272a);
  background: none; color: var(--an-text-muted, #8b8b94); cursor: pointer; font-size: 10px;
}
.header-remove-btn:hover { color: #ef4444; border-color: #ef4444; }
.header-add-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; margin: 2px 0 4px;
  border-radius: 6px; border: 1px dashed var(--an-border-subtle, #3f3f46);
  background: none; color: var(--an-text-muted, #8b8b94); cursor: pointer; font-size: 12px;
}
.header-add-btn:hover { color: var(--an-text-primary, #fafafa); }
</style>
