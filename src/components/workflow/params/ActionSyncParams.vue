<template>
  <div class="params-form">
    <span class="node-label">Integration to sync</span>
    <select v-model="data.provider" class="node-select">
      <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
    </select>

    <div class="node-hint">
      <template v-if="!data.provider || data.provider === 'all'">
        Runs a full sync of every enabled MDM/HR integration for this organization.
      </template>
      <template v-else>
        Syncs only {{ providerLabel }}. Fails if that integration isn't enabled under
        <em>Settings → Integrations</em>.
      </template>
    </div>
    <div class="node-hint">
      Synced records emit <code>hardware.synced</code> / <code>employee.synced</code> events,
      which can start other event-triggered workflows.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SYNC_PROVIDER_LABELS } from '../../../shared/workflowNodeCatalog'

const props = defineProps<{ data: Record<string, any> }>()

const providers = Object.entries(SYNC_PROVIDER_LABELS).map(([value, label]) => ({ value, label }))
const providerLabel = computed(() => SYNC_PROVIDER_LABELS[String(props.data.provider)] || props.data.provider)
</script>
