<template>
  <div class="params-form">
    <span class="node-label">Method</span>
    <select v-model="data.method" class="node-select">
      <option value="POST">POST</option>
      <option value="GET">GET</option>
      <option value="PUT">PUT</option>
    </select>

    <span class="node-label">Label (not part of the URL)</span>
    <input v-model="data.path" type="text" class="node-input" placeholder="my-automation" />

    <span class="node-label">Response</span>
    <select v-model="data.responseMode" class="node-select">
      <option value="immediate">Immediately (202 Accepted)</option>
      <option value="respond">Respond with a Respond node</option>
    </select>
    <div v-if="data.responseMode === 'respond'" class="node-hint">
      The caller waits (up to 25s) while the workflow runs and receives the output
      of a "Respond to Webhook" action.
    </div>

    <template v-if="hookUrl">
      <span class="node-label">Webhook URL</span>
      <div class="node-copy-row">
        <input :value="hookUrl" type="text" class="node-input" readonly @click="($event.target as HTMLInputElement).select()" />
        <button type="button" class="node-copy-btn" @click="copyHookUrl" :title="copied ? 'Copied!' : 'Copy URL'">
          <i :class="copied ? 'pi pi-check' : 'pi pi-copy'" />
        </button>
      </div>
      <div class="node-hint">Send a {{ data.method || 'POST' }} request here to trigger this workflow.</div>
    </template>
    <div v-else class="node-hint">Save the workflow to generate your webhook URL.</div>

    <label class="node-check-row">
      <input type="checkbox" v-model="data.requireSignature" />
      <span>Require signed requests (HMAC&nbsp;SHA-256)</span>
    </label>
    <div v-if="data.requireSignature && !data.webhookSecret" class="node-hint">
      Save the workflow to generate the signing secret.
    </div>
    <template v-if="data.requireSignature && data.webhookSecret">
      <span class="node-label">Signing secret</span>
      <div class="node-copy-row">
        <input :value="data.webhookSecret" type="text" class="node-input" readonly @click="($event.target as HTMLInputElement).select()" />
        <button type="button" class="node-copy-btn" @click="copySecret" :title="secretCopied ? 'Copied!' : 'Copy secret'">
          <i :class="secretCopied ? 'pi pi-check' : 'pi pi-copy'" />
        </button>
      </div>
      <div class="node-hint">
        The caller must send header <code>X-Signature-256: sha256=&lt;hex&gt;</code>, where
        <code>&lt;hex&gt;</code> is the HMAC-SHA256 of the raw request body using this secret.
        Unsigned or mismatched requests get <code>401</code>.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { API_BASE_URL } from '../../../lib/api'

const props = defineProps<{ data: Record<string, any> }>()

const hookUrl = computed(() => props.data.hookId ? `${API_BASE_URL}/hooks/${props.data.hookId}` : null)

const copied = ref(false)
function copyHookUrl() {
  if (!hookUrl.value) return
  navigator.clipboard.writeText(hookUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

const secretCopied = ref(false)
function copySecret() {
  if (!props.data.webhookSecret) return
  navigator.clipboard.writeText(String(props.data.webhookSecret))
  secretCopied.value = true
  setTimeout(() => { secretCopied.value = false }, 1500)
}
</script>
