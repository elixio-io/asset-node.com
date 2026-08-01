<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd" :style="style" />
  <EdgeLabelRenderer>
    <button
      v-if="isHovered"
      type="button"
      class="edge-splice-btn nodrag nopan"
      :style="{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }"
      title="Insert a node into this connection"
      @mouseenter="hoveredEdgeId && (hoveredEdgeId.value = id)"
      @click.stop="requestSplice"
    >
      <i class="pi pi-plus" />
    </button>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from '@vue-flow/core'

// Replaces Vue Flow's default edge: identical bezier rendering, plus a "+"
// button at the path midpoint while the edge is hovered — clicking it opens
// the node picker in splice mode (insert a node into this connection).
// Hover state lives in WorkflowEditor (Vue Flow only emits edge hover events
// at the <VueFlow> level, not per edge component) and arrives via inject.
const props = defineProps<{
  id: string
  source: string
  target: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: Position
  targetPosition?: Position
  sourceHandleId?: string | null
  markerEnd?: string
  style?: Record<string, any>
}>()

const hoveredEdgeId = inject<Ref<string | null>>('workflowHoveredEdgeId')
const requestSpliceNode = inject<(edgeId: string, source: string, sourceHandle: string | null, target: string) => void>(
  'workflowRequestSpliceNode',
  () => {}
)

const geometry = computed(() => {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition ?? Position.Right,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition ?? Position.Left
  })
  return { path, labelX, labelY }
})

const path = computed(() => geometry.value.path)
const labelX = computed(() => geometry.value.labelX)
const labelY = computed(() => geometry.value.labelY)

const isHovered = computed(() => hoveredEdgeId?.value === props.id)

function requestSplice() {
  requestSpliceNode(props.id, props.source, props.sourceHandleId ?? null, props.target)
}
</script>

<style scoped>
.edge-splice-btn {
  position: absolute;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--an-border-subtle, #3f3f46);
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-muted, #8b8b94);
  cursor: pointer;
  font-size: 10px;
  padding: 0;
  pointer-events: all;
  z-index: 10;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.edge-splice-btn:hover {
  border-color: var(--an-emerald, #10b981);
  color: var(--an-emerald, #10b981);
  background: rgba(16, 185, 129, 0.12);
}
.edge-splice-btn i { font-size: 10px; }
</style>
