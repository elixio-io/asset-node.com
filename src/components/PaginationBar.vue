<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

const { t } = useI18n()
const pageSizeOptions = [10, 25, 50, 100]
</script>

<template>
  <div class="an-pagination" v-if="totalPages > 1 || totalItems > 10">
    <div class="an-pagination__info">
      {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, totalItems) }}
      {{ t('pagination.of') }} {{ totalItems }}
    </div>

    <div class="an-pagination__controls">
      <button
        class="an-pagination__btn"
        :disabled="page <= 1"
        @click="emit('update:page', 1)"
        :title="t('pagination.firstPage')"
      >
        <i class="pi pi-angle-double-left" />
      </button>
      <button
        class="an-pagination__btn"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
        :title="t('pagination.previous')"
      >
        <i class="pi pi-angle-left" />
      </button>

      <span class="an-pagination__label">
        {{ page }} / {{ totalPages }}
      </span>

      <button
        class="an-pagination__btn"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
        :title="t('pagination.next')"
      >
        <i class="pi pi-angle-right" />
      </button>
      <button
        class="an-pagination__btn"
        :disabled="page >= totalPages"
        @click="emit('update:page', totalPages)"
        :title="t('pagination.lastPage')"
      >
        <i class="pi pi-angle-double-right" />
      </button>
    </div>

    <div class="an-pagination__size">
      <select
        :value="pageSize"
        @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value)); emit('update:page', 1)"
      >
        <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }} / {{ t('pagination.page') }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.an-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--an-border-dark);
  font-size: 13px;
  color: var(--an-text-subtle);
}

.an-pagination__info {
  min-width: 120px;
}

.an-pagination__controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.an-pagination__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--an-border-dark);
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: var(--an-text-subtle);
  cursor: pointer;
  transition: all 0.15s ease;
}

.an-pagination__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--an-text, #fff);
  border-color: var(--an-blue, #3b82f6);
}

.an-pagination__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.an-pagination__label {
  padding: 0 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.an-pagination__size select {
  background: var(--an-bg-dark, #0a0a0a);
  color: var(--an-text-subtle);
  border: 1px solid var(--an-border-dark);
  border-radius: var(--radius-sm, 6px);
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.an-pagination__size select:hover {
  border-color: var(--an-blue, #3b82f6);
}
</style>
