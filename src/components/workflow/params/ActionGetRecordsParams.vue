<template>
  <div class="params-form">
    <span class="node-label">Records to load</span>
    <select v-model="data.entity" class="node-select">
      <option v-for="e in entities" :key="e.value" :value="e.value">{{ e.label }}</option>
    </select>

    <span class="node-label">Limit</span>
    <input v-model.number="data.limit" type="number" min="1" :max="maxLimit" class="node-input" placeholder="50" />

    <div class="node-hint">
      Loads up to {{ data.limit || 50 }} of this organization's {{ entityLabel }} into the stream
      — one item per record. Downstream nodes (Filter, Switch, actions) then run per item.
      Reference a field with <code v-pre>{{ $json.field }}</code>.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GET_RECORDS_ENTITY_LABELS, GET_RECORDS_MAX_LIMIT } from '../../../shared/workflowNodeCatalog'

const props = defineProps<{ data: Record<string, any> }>()

const entities = Object.entries(GET_RECORDS_ENTITY_LABELS).map(([value, label]) => ({ value, label }))
const maxLimit = GET_RECORDS_MAX_LIMIT
const entityLabel = computed(() => (GET_RECORDS_ENTITY_LABELS[String(props.data.entity)] || 'records').toLowerCase())
</script>
