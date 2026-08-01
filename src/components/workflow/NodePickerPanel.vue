<template>
  <Transition name="picker-slide">
    <div v-if="visible" class="node-picker-panel">
      <div class="picker-header">
        <span class="picker-title">{{ mode === 'connect' ? 'What happens next?' : 'Add a node' }}</span>
        <button type="button" class="picker-close" @click="emit('close')" title="Close">
          <i class="pi pi-times" />
        </button>
      </div>

      <div class="picker-search">
        <i class="pi pi-search" />
        <input
          ref="searchInput"
          v-model="search"
          type="text"
          placeholder="Search nodes…"
          @keydown.escape="emit('close')"
          @keydown.enter="pickFirstMatch"
        />
      </div>

      <div class="picker-sections">
        <div v-for="section in sections" :key="section.category" class="picker-section">
          <button type="button" class="picker-section-header" @click="toggleCollapsed(section.category)">
            <span class="picker-section-label">{{ section.label }}</span>
            <i :class="collapsed.has(section.category) ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" />
          </button>
          <template v-if="!collapsed.has(section.category)">
            <button
              v-for="entry in section.entries"
              :key="entry.type"
              type="button"
              class="picker-item"
              :class="entry.category"
              @click="emit('pick', entry.type)"
            >
              <span class="picker-item-icon"><i :class="entry.icon" /></span>
              <span class="picker-item-text">
                <span class="picker-item-label">{{ entry.label }}</span>
                <small>{{ entry.description }}</small>
              </span>
              <i class="pi pi-chevron-right picker-item-chevron" />
            </button>
          </template>
        </div>
        <div v-if="sections.length === 0" class="picker-empty">
          No nodes match "{{ search }}"
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { WORKFLOW_NODE_CATALOG, type WorkflowNodeCatalogEntry } from '../../shared/workflowNodeCatalog'

const props = defineProps<{
  visible: boolean
  /**
   * 'add'     — opened from the toolbar "+": all categories shown.
   * 'connect' — opened from a node's output "+": triggers hidden (a trigger
   *             cannot receive an incoming connection).
   */
  mode?: 'add' | 'connect'
  /** When true, the Triggers section is labeled "Add another trigger". */
  hasTrigger?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'pick', type: string): void
}>()

const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const collapsed = ref(new Set<string>())

watch(() => props.visible, (visible) => {
  if (visible) {
    search.value = ''
    nextTick(() => searchInput.value?.focus())
  }
})

const CATEGORY_LABELS: Record<string, string> = {
  trigger: 'Triggers',
  logic: 'Logic',
  action: 'Actions'
}

const sections = computed(() => {
  const term = search.value.trim().toLowerCase()
  const matches = (entry: WorkflowNodeCatalogEntry) =>
    !term || entry.label.toLowerCase().includes(term) || entry.description.toLowerCase().includes(term)

  const categories: Array<'trigger' | 'logic' | 'action'> = props.mode === 'connect'
    ? ['logic', 'action']
    : ['logic', 'action', 'trigger']

  return categories
    .map(category => ({
      category,
      label: category === 'trigger' && props.hasTrigger
        ? 'Add another trigger'
        : CATEGORY_LABELS[category],
      entries: WORKFLOW_NODE_CATALOG.filter(e => !e.hidden && e.category === category && matches(e))
    }))
    .filter(section => section.entries.length > 0)
})

function toggleCollapsed(category: string) {
  const next = new Set(collapsed.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  collapsed.value = next
}

function pickFirstMatch() {
  const first = sections.value[0]?.entries[0]
  if (first) emit('pick', first.type)
}
</script>

<style scoped>
.node-picker-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--an-surface-dark, #09090b);
  border-left: 1px solid var(--an-border-dark, #27272a);
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35);
  z-index: 20;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  flex: 0 0 auto;
}

.picker-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--an-text-primary, #fafafa);
}

.picker-close {
  background: none;
  border: none;
  color: var(--an-text-muted, #8b8b94);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  line-height: 1;
}
.picker-close:hover {
  color: var(--an-text-primary, #fafafa);
  background: var(--an-surface-elevated, #18181b);
}

/* Self-contained search field — the global .an-search-wrapper has flex:1 and
   is built for horizontal filter bars; inside this column layout it would
   stretch over the full panel height. */
.picker-search {
  position: relative;
  flex: 0 0 auto;
  margin: 0 18px 14px;
}
.picker-search i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: var(--an-text-muted, #8b8b94);
  pointer-events: none;
}
.picker-search input {
  width: 100%;
  padding: 9px 12px 9px 34px;
  border-radius: 8px;
  border: 1px solid var(--an-border-dark, #27272a);
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-primary, #fafafa);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.picker-search input::placeholder { color: var(--an-text-muted, #8b8b94); }
.picker-search input:focus { border-color: var(--an-cobalt, #3b82f6); }

.picker-sections {
  flex: 1;
  overflow-y: auto;
  padding: 0 18px 18px;
}

.picker-section { margin-bottom: 14px; }

.picker-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 6px 2px;
  margin-bottom: 4px;
  cursor: pointer;
  color: var(--an-text-muted, #8b8b94);
}
.picker-section-header:hover { color: var(--an-text-primary, #fafafa); }
.picker-section-header i { font-size: 10px; }

.picker-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 10px;
  border: 1px solid var(--an-border-dark, #27272a);
  background: var(--an-surface-elevated, #18181b);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.picker-item:hover {
  border-color: var(--an-border-subtle, #3f3f46);
  transform: translateX(2px);
}
.picker-item:hover .picker-item-chevron { opacity: 0.7; }

.picker-item-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  font-size: 14px;
}
.picker-item.trigger .picker-item-icon { background: rgba(59, 130, 246, 0.12); color: var(--an-cobalt, #3b82f6); }
.picker-item.logic .picker-item-icon { background: rgba(249, 115, 22, 0.12); color: var(--an-orange, #f97316); }
.picker-item.action .picker-item-icon { background: rgba(16, 185, 129, 0.12); color: var(--an-emerald, #10b981); }

.picker-item.trigger:hover { background: rgba(59, 130, 246, 0.06); }
.picker-item.logic:hover { background: rgba(249, 115, 22, 0.06); }
.picker-item.action:hover { background: rgba(16, 185, 129, 0.06); }

.picker-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.picker-item-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--an-text-primary, #fafafa);
}
.picker-item-text small {
  font-size: 11px;
  color: var(--an-text-muted, #8b8b94);
  font-weight: 400;
}

.picker-item-chevron {
  font-size: 10px;
  opacity: 0.3;
  color: var(--an-text-muted, #8b8b94);
  transition: opacity 0.15s ease;
}

.picker-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: var(--an-text-muted, #8b8b94);
}

.picker-slide-enter-active,
.picker-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.picker-slide-enter-from,
.picker-slide-leave-to { transform: translateX(100%); opacity: 0; }
</style>
