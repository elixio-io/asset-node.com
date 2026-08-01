<template>
  <th
    class="sortable-th"
    @click="$emit('sort', col.key)"
    v-tooltip.top="col.icon ? col.label : null"
  >
    <span class="th-content">
      <i v-if="col.icon" :class="[col.icon, 'text-lg']" />
      <template v-else>{{ col.label }}</template>
      <span class="sort-indicator">
        <i v-if="sortKey === col.key && sortDir === 'asc'" class="pi pi-sort-amount-up-alt" />
        <i v-else-if="sortKey === col.key && sortDir === 'desc'" class="pi pi-sort-amount-down" />
        <i v-else class="pi pi-sort-alt sort-idle" />
      </span>
    </span>
  </th>
</template>

<script setup lang="ts">
import type { ColumnDef } from '../composables/useTableColumns'

defineProps<{
  col: ColumnDef
  sortKey: string
  sortDir: 'asc' | 'desc' | ''
}>()

defineEmits<{
  sort: [key: string]
}>()
</script>
