<template>
  <button
    v-if="isDangling"
    type="button"
    class="node-add-handle-btn"
    :style="style"
    title="Add a connected node"
    @click.stop="requestAddNode(nodeId, handleId ?? null)"
  >
    <i class="pi pi-plus" />
  </button>
</template>

<script setup lang="ts">
import { computed, inject, type Ref, type CSSProperties } from 'vue'

// Renders a small "+" next to a node's output handle when that handle has no
// outgoing connection yet. Clicking it opens the node picker pre-wired to this
// (node, handle). State comes via provide/inject from WorkflowEditor because
// Vue Flow's NodeProps is a closed prop set — extra per-node UI state can't
// ride through the nodeTypes map, and stuffing it into `data` would persist
// transient UI flags to the database.
const props = defineProps<{
  nodeId: string
  handleId?: string | null
  style?: CSSProperties
}>()

const connectedHandles = inject<Ref<Set<string>>>('workflowConnectedHandles')
const requestAddNode = inject<(nodeId: string, handleId: string | null) => void>(
  'workflowRequestAddNode',
  () => {}
)

const isDangling = computed(() => {
  if (!connectedHandles?.value) return false
  return !connectedHandles.value.has(`${props.nodeId}::${props.handleId ?? ''}`)
})
</script>

<style scoped>
.node-add-handle-btn {
  position: absolute;
  right: -46px;
  top: 50%;
  transform: translateY(-50%);
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
  z-index: 5;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

/* Connector stub between the node edge and the button, so the gap reads as a
   deliberate "continue the flow here" affordance. */
.node-add-handle-btn::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  width: 18px;
  height: 1px;
  background: var(--an-border-subtle, #3f3f46);
}

.node-add-handle-btn:hover {
  border-color: var(--an-emerald, #10b981);
  color: var(--an-emerald, #10b981);
  background: rgba(16, 185, 129, 0.1);
}
.node-add-handle-btn i { font-size: 10px; }
</style>
