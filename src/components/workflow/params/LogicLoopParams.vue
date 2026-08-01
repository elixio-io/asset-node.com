<template>
  <div class="params-form">
    <span class="node-label">Loop mode</span>
    <select v-model="data.mode" class="node-select">
      <option value="forEachItem">For each input item (stream)</option>
      <option value="forEach">For each record</option>
      <option value="times">A fixed number of times</option>
      <option value="while">While a check holds</option>
    </select>

    <template v-if="data.mode === 'forEach'">
      <span class="node-label">Iterate over</span>
      <select v-model="data.entity" class="node-select">
        <option value="" disabled>Entity type...</option>
        <option value="hardware">🖥️ Hardware</option>
        <option value="employee">👥 Employees</option>
        <option value="license">🔑 Licenses</option>
        <option value="consumable">📦 Consumables</option>
      </select>
      <div class="node-hint">
        Runs the loop body once per active record (up to the max below). Add a
        Filter node inside the body to skip records you don't want.
      </div>
    </template>

    <template v-else-if="data.mode === 'times'">
      <span class="node-label">Repeat count</span>
      <input v-model.number="data.count" type="number" class="node-input" min="1" step="1" placeholder="3" />
    </template>

    <template v-else-if="data.mode === 'while'">
      <span class="node-label">Continue while</span>
      <select v-model="data.entity" class="node-select" @change="data.field = ''">
        <option value="" disabled>Entity type...</option>
        <option value="hardware">🖥️ Hardware</option>
        <option value="employee">👥 Employees</option>
        <option value="license">🔑 Licenses</option>
        <option value="consumable">📦 Consumables</option>
      </select>
      <template v-if="data.entity">
        <select v-model="data.field" class="node-select">
          <option value="" disabled>Select field...</option>
          <option v-for="f in fieldsForEntity" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </template>
      <template v-if="data.field">
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
      <div class="node-hint">Re-checked before every iteration. Stops as soon as it no longer holds.</div>
    </template>

    <span class="node-label">Max iterations (safety cap)</span>
    <input v-model.number="data.maxIterations" type="number" class="node-input" min="1" max="1000" step="1" placeholder="100" />
    <div class="node-hint">Hard ceiling of 1000. The loop always stops here even if the condition never ends.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CONDITION_FIELD_OPTIONS } from '../conditionFields'

const props = defineProps<{ data: Record<string, any> }>()
const fieldsForEntity = computed(() => CONDITION_FIELD_OPTIONS[props.data.entity] || [])
</script>
