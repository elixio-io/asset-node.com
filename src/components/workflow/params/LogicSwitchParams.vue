<template>
  <div class="params-form">
    <span class="node-label">Value to compare</span>
    <select v-model="data.field" class="node-select">
      <option value="">Select field...</option>
      <option value="status">📊 Status (slug or ID)</option>
      <option value="category">📁 Category (slug or ID)</option>
      <option value="location">📍 Location (slug or ID)</option>
      <option value="department">🏢 Department (slug or ID)</option>
      <option value="manufacturer">🏭 Manufacturer (name or ID)</option>
      <option value="assignee">👤 Assignee (email or ID)</option>
      <option value="provider">🔌 MDM Provider</option>
    </select>

    <span class="node-label">Cases (exact match)</span>
    <div v-for="(branch, i) in branches" :key="i" class="switch-case-row">
      <input
        :value="branch"
        type="text"
        class="node-input"
        :placeholder="`Case ${i + 1} value...`"
        @input="updateBranch(i, ($event.target as HTMLInputElement).value)"
      />
      <button v-if="branches.length > 1" type="button" class="case-remove-btn" title="Remove case" @click="removeBranch(i)">
        <i class="pi pi-times" />
      </button>
    </div>
    <button type="button" class="case-add-btn" @click="addBranch">
      <i class="pi pi-plus" /> Add case
    </button>
    <div class="node-hint">Case matching ignores capitalization. Unmatched values use Default.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data: Record<string, any> }>()

const branches = computed(() => Array.isArray(props.data.branches) ? props.data.branches : [])

function ensureBranches(): any[] {
  if (!Array.isArray(props.data.branches)) props.data.branches = ['', '', '']
  return props.data.branches
}
function updateBranch(index: number, value: string) { ensureBranches()[index] = value }
function addBranch() { ensureBranches().push('') }
function removeBranch(index: number) { ensureBranches().splice(index, 1) }
</script>

<style scoped>
.switch-case-row { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
.case-remove-btn {
  flex-shrink: 0; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; border: 1px solid var(--an-border-dark, #27272a);
  background: none; color: var(--an-text-muted, #8b8b94); cursor: pointer; font-size: 10px;
}
.case-remove-btn:hover { color: #ef4444; border-color: #ef4444; }
.case-add-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; margin-top: 2px;
  border-radius: 6px; border: 1px dashed var(--an-border-subtle, #3f3f46);
  background: none; color: var(--an-text-muted, #8b8b94); cursor: pointer; font-size: 12px;
}
.case-add-btn:hover { color: var(--an-text-primary, #fafafa); }
</style>
