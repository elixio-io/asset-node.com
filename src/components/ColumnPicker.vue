<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ColumnDef } from '../composables/useTableColumns'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import Checkbox from 'primevue/checkbox'

const props = defineProps<{
  allColumns: ColumnDef[]
  visibleKeys: string[]
  isVisible: (key: string) => boolean
}>()

const emit = defineEmits<{
  toggle: [key: string]
  reset: []
  reorder: [keys: string[]]
}>()

const popover = ref()
const { t } = useI18n()

function toggle(event: Event) {
  popover.value.toggle(event)
}

const dragIdx = ref<number | null>(null)
const dropIdx = ref<number | null>(null)

const activeColumns = computed(() =>
  props.visibleKeys
    .map(k => props.allColumns.find(c => c.key === k))
    .filter(Boolean) as ColumnDef[]
)

const availableColumns = computed(() =>
  props.allColumns.filter(c => !props.isVisible(c.key))
)

function onDragStart(idx: number, e: DragEvent) {
  dragIdx.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
}

function onDragOver(idx: number, e: DragEvent) {
  e.preventDefault()
  dropIdx.value = idx
}

function onDragLeave() {
  dropIdx.value = null
}

function onDrop(targetIdx: number, e: DragEvent) {
  e.preventDefault()
  if (dragIdx.value === null || dragIdx.value === targetIdx) {
    dragIdx.value = null
    dropIdx.value = null
    return
  }
  const keys = [...props.visibleKeys]
  const [moved] = keys.splice(dragIdx.value, 1)
  keys.splice(targetIdx, 0, moved)
  emit('reorder', keys)
  dragIdx.value = null
  dropIdx.value = null
}

function onDragEnd() {
  dragIdx.value = null
  dropIdx.value = null
}
</script>

<template>
  <Button
    icon="pi pi-cog"
    :label="t('common.columns')"
    outlined
    size="small"
    severity="secondary"
    v-tooltip.top="t('common.customizeColumns')"
    @click="toggle"
    class="column-picker-btn"
  />
  <Popover ref="popover" class="column-picker-popover">
    <div class="column-picker-content">
      <div class="column-picker-header">
        <span class="column-picker-title">{{ t('common.columns') }}</span>
        <Button
          :label="t('common.reset')"
          text
          size="small"
          severity="secondary"
          @click="emit('reset')"
          class="column-picker-reset"
        />
      </div>

      <div class="column-picker-section" v-if="activeColumns.length">
        <div class="column-picker-section-label">{{ t('common.active') || 'Active' }}</div>
        <div class="column-picker-list">
          <div
            v-for="(col, idx) in activeColumns"
            :key="col.key"
            class="column-picker-item column-picker-item--active"
            :class="{
              'column-picker-item--dragging': dragIdx === idx,
              'column-picker-item--drop-target': dropIdx === idx && dragIdx !== idx
            }"
            draggable="true"
            @dragstart="onDragStart(idx, $event)"
            @dragover="onDragOver(idx, $event)"
            @dragleave="onDragLeave"
            @drop="onDrop(idx, $event)"
            @dragend="onDragEnd"
          >
            <span class="column-picker-grip" title="Drag to reorder">⠿</span>
            <i v-if="col.fixed" class="pi pi-lock column-picker-lock" />
            <Checkbox
              v-else
              :modelValue="true"
              @update:modelValue="emit('toggle', col.key)"
              :binary="true"
            />
            <span class="column-picker-label">{{ col.key === '_actions' ? t('common.actions') : col.label }}</span>
          </div>
        </div>
      </div>

      <div class="column-picker-section" v-if="availableColumns.length">
        <div class="column-picker-section-label">{{ t('common.available') || 'Available' }}</div>
        <div class="column-picker-list">
          <label
            v-for="col in availableColumns"
            :key="col.key"
            class="column-picker-item"
          >
            <Checkbox
              :modelValue="false"
              @update:modelValue="emit('toggle', col.key)"
              :binary="true"
            />
            <span class="column-picker-label">{{ col.label }}</span>
          </label>
        </div>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.column-picker-btn {
  transition: opacity 0.2s;
}

.column-picker-btn:hover {
  opacity: 0.85;
}

.column-picker-content {
  width: 240px;
}

.column-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--an-border-dark, #333);
  margin-bottom: 8px;
}

.column-picker-title {
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--an-text-subtle, #999);
}

.column-picker-reset {
  font-size: 12px !important;
  padding: 2px 6px !important;
}

.column-picker-section {
  margin-bottom: 8px;
}

.column-picker-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--an-text-muted, #666);
  margin-bottom: 4px;
  padding: 0 2px;
}

.column-picker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.column-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  border: 1px solid transparent;
}

.column-picker-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.column-picker-item--active {
  cursor: grab;
}

.column-picker-item--active:active {
  cursor: grabbing;
}

.column-picker-item--dragging {
  opacity: 0.4;
}

.column-picker-item--drop-target {
  border-top: 2px solid var(--an-primary, #6c5ce7);
  padding-top: 3px;
}

.column-picker-grip {
  color: var(--an-text-muted, #555);
  font-size: 14px;
  cursor: grab;
  user-select: none;
  line-height: 1;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.column-picker-grip:active {
  cursor: grabbing;
}

.column-picker-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-picker-lock {
  font-size: 12px;
  color: var(--an-text-subtle, #888);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}
</style>
