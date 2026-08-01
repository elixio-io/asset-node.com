<template>
  <div class="workflow-editor">
    <div class="node-palette">
      <h4>
        <i class="pi pi-th-large" />
        Node Palette
      </h4>
      <p class="palette-hint">Drag nodes onto the canvas or use the + buttons to add and connect them. A workflow can have multiple triggers.</p>

      <div v-if="editorNotice" class="editor-notice" role="status">
        <i class="pi pi-info-circle" />
        {{ editorNotice }}
      </div>

      <div v-for="section in paletteSections" :key="section.category" class="palette-section">
        <span class="palette-label">{{ section.label }}</span>
        <div
          v-for="entry in section.entries"
          :key="entry.type"
          class="palette-item"
          :class="entry.category === 'logic' ? 'condition' : entry.category"
          draggable="true"
          @dragstart="onDragStart($event, entry.type)"
        >
          <i :class="entry.icon" />
          <div class="palette-item-text"><span>{{ entry.label }}</span><small>{{ entry.description }}</small></div>
        </div>
      </div>
    </div>

    <div
      class="flow-canvas"
      @drop="onDrop"
      @dragover.prevent
    >
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-viewport="{ zoom: 1, x: 50, y: 50 }"
        :snap-to-grid="true"
        :snap-grid="[20, 20]"
        :delete-key-code="['Backspace', 'Delete']"
        :edges-updatable="true"
        fit-view-on-init
        @connect="onConnect"
        @edge-update="onEdgeUpdate"
        @edge-update-end="onEdgeUpdateEnd"
      >
        <Background :gap="20" />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
          <button type="button" class="canvas-add-btn" title="Add a node" @click="openPicker(null)">
            <i class="pi pi-plus" />
          </button>
        </Panel>
      </VueFlow>

      <NodePickerPanel
        :visible="pickerVisible"
        :mode="pendingConnection ? 'connect' : 'add'"
        :has-trigger="hasTriggerNode"
        @close="closePicker"
        @pick="onPickerPick"
      />

      <NodeDetailPanel
        :node="selectedNode"
        :edges="edges"
        :test-running="props.nodeTestRunning"
        :test-results="props.nodeTestResults"
        @close="closeDetailPanel"
        @request-test="payload => emit('test-node', payload)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, markRaw, watch } from 'vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { Node, Edge, Connection } from '@vue-flow/core'
import { WORKFLOW_NODE_CATALOG, createDefaultNodeData } from '../../shared/workflowNodeCatalog'
import NodePickerPanel from './NodePickerPanel.vue'
import WorkflowEdge from './WorkflowEdge.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './workflow-nodes.css'

import WorkflowNodeCard from './WorkflowNodeCard.vue'
import NodeDetailPanel from './NodeDetailPanel.vue'
import type { NodeResultLike } from './NodeResultDisplay.vue'


const props = defineProps<{
  initialNodes?: Node[]
  initialEdges?: Edge[]
  nodeTestRunning?: boolean
  nodeTestResults?: NodeResultLike[] | null
}>()

const emit = defineEmits<{
  (e: 'update', payload: { nodes: Node[]; edges: Edge[] }): void
  (e: 'test-node', payload: { nodeId: string; triggerData: Record<string, any> }): void
}>()


// Every node type renders through the same slim catalog-driven card;
// configuration happens in the NodeDetailPanel (click a node to open it).
const nodeTypes = Object.fromEntries(
  WORKFLOW_NODE_CATALOG.map(entry => [entry.type, markRaw(WorkflowNodeCard)])
)

// Edges are created without an explicit `type`, so they all resolve to
// 'default' — overriding that key swaps in our hover-"+" edge everywhere,
// including edges on previously saved workflows. No data migration needed.
const edgeTypes = {
  default: markRaw(WorkflowEdge)
}


const nodes = ref<Node[]>(props.initialNodes || [])
const edges = ref<Edge[]>(props.initialEdges || [])
const editorNotice = ref('')
let nodeIdCounter = nodes.value.length + 1
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const { project } = useVueFlow()

const paletteSections = computed(() => (['trigger', 'logic', 'action'] as const).map(category => ({
  category,
  label: category === 'trigger' ? 'Triggers' : category === 'logic' ? 'Logic' : 'Actions',
  entries: WORKFLOW_NODE_CATALOG.filter(e => !e.hidden && e.category === category)
})))

const hasTriggerNode = computed(() =>
  nodes.value.some(node => String(node.type || '').startsWith('trigger-'))
)

// ─── Node picker (toolbar "+" and per-handle "+") ───
interface PendingConnection {
  sourceNodeId: string
  sourceHandleId: string | null
  mode: 'append' | 'splice'
  edgeId?: string
}

const pickerVisible = ref(false)
const pendingConnection = ref<PendingConnection | null>(null)

// `${nodeId}::${handleId}` for every source handle that already has an edge.
// Injected by NodeAddHandleButton instances to decide whether to render a "+".
const connectedSourceHandles = computed(() =>
  new Set(edges.value.map(e => `${e.source}::${e.sourceHandle ?? ''}`))
)
provide('workflowConnectedHandles', connectedSourceHandles)
provide('workflowRequestAddNode', (nodeId: string, handleId: string | null) => {
  openPicker({ sourceNodeId: nodeId, sourceHandleId: handleId, mode: 'append' })
})

// Edge hover state for the splice "+" — Vue Flow emits edge hover at the
// <VueFlow> level, so the editor owns the state and edges inject it.
const hoveredEdgeId = ref<string | null>(null)
const { onEdgeMouseEnter, onEdgeMouseLeave, onNodeClick } = useVueFlow()
onEdgeMouseEnter(({ edge }) => { hoveredEdgeId.value = edge.id })
onEdgeMouseLeave(() => { hoveredEdgeId.value = null })

// Node detail panel (Input / Parameters / Output) — opens on node click.
const selectedNodeId = ref<string | null>(null)
const selectedNode = computed(() =>
  nodes.value.find(node => node.id === selectedNodeId.value) ?? null
)
onNodeClick(({ node }) => {
  selectedNodeId.value = node.id
  pickerVisible.value = false
})
function closeDetailPanel() {
  selectedNodeId.value = null
}
provide('workflowHoveredEdgeId', hoveredEdgeId)
provide('workflowRequestSpliceNode', (edgeId: string, source: string, sourceHandle: string | null, _target: string) => {
  openPicker({ sourceNodeId: source, sourceHandleId: sourceHandle, mode: 'splice', edgeId })
})

function openPicker(pending: PendingConnection | null) {
  pendingConnection.value = pending
  pickerVisible.value = true
  selectedNodeId.value = null
}

function closePicker() {
  pickerVisible.value = false
  pendingConnection.value = null
}

function onPickerPick(type: string) {
  const pending = pendingConnection.value

  if (pending?.mode === 'splice' && pending.edgeId) {
    spliceNodeIntoEdge(type, pending.edgeId)
    closePicker()
    return
  }

  let position: { x: number; y: number }
  if (pending) {
    const source = nodes.value.find(node => node.id === pending.sourceNodeId)
    position = {
      x: (source?.position?.x ?? 100) + 320,
      y: source?.position?.y ?? 200
    }
  } else if (nodes.value.length > 0) {
    const maxX = Math.max(...nodes.value.map(node => Number(node.position?.x ?? 100)))
    const minY = Math.min(...nodes.value.map(node => Number(node.position?.y ?? 200)))
    position = { x: maxX + 320, y: minY }
  } else {
    position = { x: 100, y: 200 }
  }

  const newNode: Node = {
    id: nextNodeId(),
    type,
    position,
    data: createDefaultNodeData(type)
  }
  nodes.value = [...nodes.value, newNode]

  if (pending?.mode === 'append') {
    edges.value = [...edges.value, buildEdge({
      source: pending.sourceNodeId,
      sourceHandle: pending.sourceHandleId,
      target: newNode.id,
      targetHandle: null
    })]
  }

  closePicker()
}

// Replace an edge with source → newNode → target, preserving the original
// sourceHandle (e.g. a condition's "true" output) on the first hop.
function spliceNodeIntoEdge(type: string, edgeId: string) {
  const edge = edges.value.find(e => e.id === edgeId)
  if (!edge) return

  const sourceNode = nodes.value.find(n => n.id === edge.source)
  const targetNode = nodes.value.find(n => n.id === edge.target)
  const position = {
    x: ((sourceNode?.position?.x ?? 100) + (targetNode?.position?.x ?? 420)) / 2,
    y: ((sourceNode?.position?.y ?? 200) + (targetNode?.position?.y ?? 200)) / 2
  }

  const newNode: Node = {
    id: nextNodeId(),
    type,
    position,
    data: createDefaultNodeData(type)
  }

  const firstHop = { source: edge.source, sourceHandle: edge.sourceHandle ?? null, target: newNode.id, targetHandle: null }
  const secondHop = { source: newNode.id, sourceHandle: null, target: edge.target, targetHandle: null }
  // Same validation as manual drag-connects — a splice must not create an
  // edge the canvas would otherwise refuse.
  if (!connectionIsValid(firstHop as Connection) || !connectionIsValid(secondHop as Connection)) return

  nodes.value = [...nodes.value, newNode]
  edges.value = [
    ...edges.value.filter(e => e.id !== edgeId),
    buildEdge(firstHop),
    buildEdge(secondHop)
  ]
}

watch([nodes, edges], () => {
  emit('update', {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    edges: JSON.parse(JSON.stringify(edges.value))
  })
}, { deep: true })


function onDragStart(event: DragEvent, type: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/vueflow', type)
  event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event: DragEvent) {
  if (!event.dataTransfer) return
  const type = event.dataTransfer.getData('application/vueflow')
  if (!type) return

  const position = project({
    x: event.clientX - 280,
    y: event.clientY - 80
  })

  const newNode: Node = {
    id: nextNodeId(),
    type,
    position,
    data: createDefaultNodeData(type)
  }

  nodes.value = [...nodes.value, newNode]
}

function nextNodeId(): string {
  let id = `node-${nodeIdCounter++}`
  const existingIds = new Set(nodes.value.map(node => node.id))
  while (existingIds.has(id)) id = `node-${nodeIdCounter++}`
  return id
}

function showEditorNotice(message: string) {
  editorNotice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { editorNotice.value = '' }, 5000)
}

// One construction path for edges whether they come from a manual drag-connect
// or the picker's auto-wire, so styling/ids stay identical.
function buildEdge(connection: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }): Edge {
  return {
    id: `edge-${connection.source}-${connection.sourceHandle || 'source'}-${connection.target}-${Date.now()}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    animated: true,
    style: {
      stroke: connection.sourceHandle === 'false' || connection.sourceHandle === 'rejected'
        ? '#ef4444'
        : connection.sourceHandle === 'default' || connection.sourceHandle === 'done'
          ? '#a1a1aa'
          : connection.sourceHandle === 'loop'
            ? '#f97316'
            : '#10b981'
    }
  }
}

function onConnect(connection: Connection) {
  if (!connectionIsValid(connection)) return
  edges.value = [...edges.value, buildEdge(connection)]
}

function connectionIsValid(connection: Connection): boolean {
  if (!connection.source || !connection.target || connection.source === connection.target) return false

  const targetNode = nodes.value.find(node => node.id === connection.target)
  if (String(targetNode?.type || '').startsWith('trigger-')) {
    showEditorNotice('A trigger must be the first node and cannot receive a connection.')
    return false
  }

  const duplicate = edges.value.some(edge =>
    edge.source === connection.source &&
    edge.target === connection.target &&
    (edge.sourceHandle || null) === (connection.sourceHandle || null) &&
    (edge.targetHandle || null) === (connection.targetHandle || null)
  )
  if (duplicate) {
    showEditorNotice('That connection already exists.')
    return false
  }

  return true
}


const { removeEdges, onEdgeUpdateStart } = useVueFlow()
let edgeBeingUpdated: string | null = null

onEdgeUpdateStart(({ edge }) => {
  edgeBeingUpdated = edge.id
})

function onEdgeUpdate(oldEdge: Edge, newConnection: Connection) {
  edgeBeingUpdated = null
  edges.value = edges.value.map(e => {
    if (e.id !== oldEdge.id) return e
    return {
      ...e,
      source: newConnection.source,
      target: newConnection.target,
      sourceHandle: newConnection.sourceHandle || undefined,
      targetHandle: newConnection.targetHandle || undefined
    }
  })
}

function onEdgeUpdateEnd() {
  if (edgeBeingUpdated) {
    removeEdges([edgeBeingUpdated])
    edgeBeingUpdated = null
  }
}
</script>

<style scoped>
.workflow-editor {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--an-bg-dark, #000000);
}


.node-palette {
  width: 220px;
  padding: 16px;
  border-right: 1px solid var(--an-border-dark, #27272a);
  background: var(--an-surface-dark, #09090b);
  overflow-y: auto;
  flex-shrink: 0;
}

.node-palette h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--an-text-primary, #fafafa);
  display: flex;
  align-items: center;
  gap: 8px;
}

.palette-section {
  margin-bottom: 16px;
}

.palette-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--an-text-muted, #8b8b94);
  margin-bottom: 8px;
}

.palette-hint {
  font-size: 12px;
  color: var(--an-text-muted, #8b8b94);
  line-height: 1.4;
  margin: 0 0 16px;
}

.editor-notice {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  margin: -6px 0 14px;
  padding: 8px 10px;
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 7px;
  background: rgba(59, 130, 246, 0.08);
  color: #93c5fd;
  font-size: 11px;
  line-height: 1.35;
}

.palette-item-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.palette-item-text span {
  font-size: 13px;
  font-weight: 600;
}

.palette-item-text small {
  font-size: 11px;
  opacity: 0.6;
  font-weight: 400;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: grab;
  transition: all 0.15s ease;
  border: 1px solid var(--an-border-dark, #27272a);
  background: var(--an-surface-elevated, #18181b);
}

.palette-item:hover {
  border-color: var(--an-border-subtle, #3f3f46);
}

.palette-item:active {
  cursor: grabbing;
}

.palette-item.trigger {
  color: var(--an-cobalt, #3b82f6);
}
.palette-item.trigger:hover {
  background: rgba(59, 130, 246, 0.08);
}

.palette-item.condition {
  color: var(--an-orange, #f97316);
}
.palette-item.condition:hover {
  background: rgba(249, 115, 22, 0.08);
}

.palette-item.action {
  color: var(--an-emerald, #10b981);
}
.palette-item.action:hover {
  background: rgba(16, 185, 129, 0.08);
}


.flow-canvas {
  flex: 1;
  position: relative;
}

.canvas-add-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--an-border-dark, #27272a);
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-primary, #fafafa);
  cursor: pointer;
  transition: all 0.15s ease;
}
.canvas-add-btn:hover {
  border-color: var(--an-emerald, #10b981);
  color: var(--an-emerald, #10b981);
  background: rgba(16, 185, 129, 0.1);
}
</style>
