<template>
  <div class="params-form">
    <span class="node-label">Test against</span>
    <select v-model="mode" class="node-select">
      <option value="item">Field of each stream item</option>
      <option value="fact">Aggregate fact (counts, dates)</option>
    </select>

    <template v-if="mode === 'item'">
      <span class="node-label">Item field</span>
      <input v-model="data.itemField" type="text" class="node-input" placeholder="e.g. status, assignedTo, customFields.env" />
      <div class="node-hint">
        Tested on <em>each</em> incoming item — matching items route to ✓, the rest to ✗.
        Same as <code v-pre>{{ $json.&lt;field&gt; }}</code>.
      </div>
    </template>

    <template v-else>
      <span class="node-label">Check if</span>
      <select v-model="data.entity" class="node-select" @change="data.field = ''">
        <option value="" disabled>Entity type...</option>
        <option value="hardware">🖥️ Hardware</option>
        <option value="employee">👥 Employees</option>
        <option value="license">🔑 Licenses</option>
        <option value="consumable">📦 Consumables</option>
      </select>

      <template v-if="data.entity">
        <span class="node-label">Field</span>
        <select v-model="data.field" class="node-select">
          <option value="" disabled>Select field...</option>
          <option v-for="f in fieldsForEntity" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </template>
    </template>

    <template v-if="showComparison">
      <span class="node-label">Is</span>
      <div class="condition-row">
        <select v-model="data.operator" class="node-select-small">
          <option value="gt">&gt;</option>
          <option value="gte">≥</option>
          <option value="lt">&lt;</option>
          <option value="lte">≤</option>
          <option value="eq">=</option>
          <option value="neq">≠</option>
        </select>
        <input v-model="data.value" type="text" class="node-input" placeholder="Value..." />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CONDITION_FIELD_OPTIONS } from '../conditionFields'

const props = defineProps<{ data: Record<string, any> }>()
const fieldsForEntity = computed(() => CONDITION_FIELD_OPTIONS[props.data.entity] || [])

// Default to item-field mode (the stream use-case) unless an aggregate fact was
// already configured. The mode is derived from which fields are set, not stored.
const mode = ref<'item' | 'fact'>(
  props.data.itemField ? 'item' : (props.data.entity || props.data.field) ? 'fact' : 'item'
)
watch(mode, m => {
  if (m === 'item') { delete props.data.entity; delete props.data.field }
  else { delete props.data.itemField }
})

const showComparison = computed(() =>
  mode.value === 'item' ? !!props.data.itemField : !!props.data.field
)
</script>
