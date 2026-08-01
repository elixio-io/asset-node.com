<template>
  <div class="workflow-node" :class="`node-type-${type}`">
    <div class="node-header" :class="headerClass">
      <i :class="entry.icon" />
      <span>{{ entry.label }}</span>
    </div>
    <div class="node-body">
      <Handle v-if="entry.category !== 'trigger'" type="target" :position="Position.Left" />

      <div class="node-summary" :class="{ unconfigured: isUnconfigured }">{{ summary }}</div>

      <!-- Switch: one labeled row per case + default, handle anchored per row -->
      <template v-if="entry.outputs === 'switch'">
        <div v-for="(branch, i) in branches" :key="i" class="switch-slim-row">
          <span class="switch-slim-label" :class="{ empty: !String(branch || '').trim() }">
            {{ String(branch || '').trim() || `Case ${i + 1} (empty)` }}
          </span>
          <Handle type="source" :position="Position.Right" :id="`branch-${i}`" class="switch-row-handle" />
          <NodeAddHandleButton :node-id="id" :handle-id="`branch-${i}`" class="switch-row-add" />
        </div>
        <div class="switch-slim-row default">
          <span class="switch-slim-label">Default</span>
          <Handle type="source" :position="Position.Right" id="default" class="switch-row-handle" />
          <NodeAddHandleButton :node-id="id" handle-id="default" class="switch-row-add" />
        </div>
      </template>
    </div>

    <template v-if="entry.outputs === 'single'">
      <Handle type="source" :position="Position.Right" />
      <NodeAddHandleButton :node-id="id" />
    </template>

    <template v-else-if="entry.outputs === 'pass'">
      <Handle id="true" type="source" :position="Position.Right" />
      <NodeAddHandleButton :node-id="id" handle-id="true" />
    </template>

    <template v-else-if="entry.outputs === 'condition'">
      <Handle id="true" type="source" :position="Position.Right" :style="{ top: '35%' }" />
      <Handle id="false" type="source" :position="Position.Right" :style="{ top: '75%' }" />
      <NodeAddHandleButton :node-id="id" handle-id="true" :style="{ top: '35%' }" />
      <NodeAddHandleButton :node-id="id" handle-id="false" :style="{ top: '75%' }" />
      <div class="branch-labels">
        <span class="branch-true">✓</span>
        <span class="branch-false">✗</span>
      </div>
    </template>

    <template v-else-if="entry.outputs === 'loop'">
      <Handle id="loop" type="source" :position="Position.Right" :style="{ top: '35%' }" />
      <Handle id="done" type="source" :position="Position.Right" :style="{ top: '75%' }" />
      <NodeAddHandleButton :node-id="id" handle-id="loop" :style="{ top: '35%' }" />
      <NodeAddHandleButton :node-id="id" handle-id="done" :style="{ top: '75%' }" />
      <div class="branch-labels">
        <span class="branch-loop">↻ loop</span>
        <span class="branch-done">→ done</span>
      </div>
    </template>

    <template v-else-if="entry.outputs === 'approval'">
      <Handle id="approved" type="source" :position="Position.Right" :style="{ top: '35%' }" />
      <Handle id="rejected" type="source" :position="Position.Right" :style="{ top: '75%' }" />
      <NodeAddHandleButton :node-id="id" handle-id="approved" :style="{ top: '35%' }" />
      <NodeAddHandleButton :node-id="id" handle-id="rejected" :style="{ top: '75%' }" />
      <div class="branch-labels">
        <span class="branch-true">✓</span>
        <span class="branch-false">✗</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import NodeAddHandleButton from './NodeAddHandleButton.vue'
import { WORKFLOW_NODE_CATALOG_BY_TYPE } from '../../shared/workflowNodeCatalog'

// One slim canvas card for every node type — icon, label, one-line summary and
// handles per the catalog's output spec. All configuration happens in the
// NodeDetailPanel; click the node to open it.
const props = defineProps<{ id: string; type: string; data: Record<string, any> }>()

const entry = computed(() =>
  WORKFLOW_NODE_CATALOG_BY_TYPE[props.type] ?? {
    type: props.type,
    category: 'action' as const,
    label: props.type,
    description: '',
    icon: 'pi pi-question',
    outputs: 'single' as const,
    createDefaultData: () => ({}),
    summarize: () => 'Unknown node type'
  }
)

const headerClass = computed(() =>
  entry.value.category === 'logic' ? 'condition' : entry.value.category
)

const summary = computed(() => entry.value.summarize(props.data || {}))

const isUnconfigured = computed(() => {
  const s = summary.value.toLowerCase()
  return s.includes('not configured') || s.startsWith('choose') || s.startsWith('enter') || s.includes('save to get')
})

const branches = computed(() =>
  Array.isArray(props.data?.branches) ? props.data.branches : []
)
</script>

<style scoped>
.node-summary {
  font-size: 12px;
  color: var(--an-text-primary, #fafafa);
  line-height: 1.5;
  word-break: break-word;
}
.node-summary.unconfigured {
  color: var(--an-text-muted, #8b8b94);
  font-style: italic;
}

.switch-slim-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 5px 8px;
  margin-top: 6px;
  border: 1px solid var(--an-border-dark, #27272a);
  border-radius: 6px;
  background: var(--an-surface-dark, #09090b);
}
.switch-slim-row.default {
  border-style: dashed;
}
.switch-slim-label {
  font-size: 11px;
  color: var(--an-text-primary, #fafafa);
}
.switch-slim-label.empty {
  color: var(--an-text-muted, #8b8b94);
  font-style: italic;
}
.switch-row-handle {
  position: absolute !important;
  right: -13px !important;
  top: 50% !important;
}
.switch-row-add {
  top: 50%;
}
</style>
