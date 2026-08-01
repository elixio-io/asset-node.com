<template>
  <Transition name="detail-slide">
    <div v-if="node" class="node-detail-panel">
      <div class="detail-header">
        <span class="detail-icon" :class="`cat-${entry?.category || 'action'}`">
          <i :class="entry?.icon || 'pi pi-question'" />
        </span>
        <div class="detail-title-wrap">
          <span class="detail-title">{{ entry?.label || node.type }}</span>
          <small class="detail-subtitle">{{ entry?.description }}</small>
        </div>
        <button type="button" class="detail-close" @click="emit('close')" title="Close">
          <i class="pi pi-times" />
        </button>
      </div>

      <div class="detail-sections">
        <!-- INPUT -->
        <section class="detail-section">
          <header class="detail-section-header">
            <span>Input</span>
            <button
              type="button"
              class="detail-run-btn"
              :disabled="testRunning"
              @click="runTest"
              title="Run the trigger and every node up to this one — a REAL execution"
            >
              <i :class="testRunning ? 'pi pi-spin pi-spinner' : 'pi pi-play-circle'" />
              Execute step
            </button>
          </header>

          <!-- Real input from the last run: the items this node received. -->
          <template v-if="ranThisNode && inputItems.length">
            <div class="detail-subhead">{{ inputItems.length }} item{{ inputItems.length === 1 ? '' : 's' }} from the previous node</div>
            <NodeResultDisplay
              :result="{ nodeId: 'input', nodeType: 'input', status: 'success', items: inputItems.slice(0, 10), itemCount: inputItems.length }"
              class="detail-result"
            />
          </template>

          <!-- Trigger / node with no upstream: you supply the starting payload. -->
          <template v-else-if="!hasUpstream">
            <textarea
              v-model="inputJson"
              class="detail-input-json"
              :class="{ invalid: inputError }"
              rows="4"
              spellcheck="false"
            ></textarea>
            <div v-if="inputError" class="detail-input-error">{{ inputError }}</div>
            <div class="node-hint">
              The payload this run starts from (JSON). "Execute step" performs a
              <strong>real</strong> run, not a simulation.
            </div>
          </template>

          <!-- Downstream node, not run yet: input comes from upstream on run. -->
          <template v-else>
            <div class="detail-output-empty">
              <i class="pi pi-arrow-left" />
              <span>{{ ranThisNode ? 'The previous node produced no items.' : 'No input data yet — "Execute step" runs the flow up to here and fetches this node\'s input from the previous node.' }}</span>
            </div>
            <button type="button" class="detail-linkbtn" @click="payloadOpen = !payloadOpen">
              <i :class="payloadOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
              Set trigger payload for the run
            </button>
            <template v-if="payloadOpen">
              <textarea
                v-model="inputJson"
                class="detail-input-json"
                :class="{ invalid: inputError }"
                rows="3"
                spellcheck="false"
              ></textarea>
              <div v-if="inputError" class="detail-input-error">{{ inputError }}</div>
            </template>
          </template>
        </section>

        <!-- PARAMETERS -->
        <section class="detail-section">
          <header class="detail-section-header"><span>Parameters</span></header>
          <component v-if="paramsComponent" :is="paramsComponent" :data="node.data" />
          <div v-else class="node-hint">This node has no parameters.</div>
        </section>

        <!-- OUTPUT -->
        <section class="detail-section">
          <header class="detail-section-header"><span>Output</span></header>
          <NodeResultDisplay v-if="selfResult" :result="selfResult" class="detail-result" />
          <div v-else class="detail-output-empty">
            <i class="pi pi-arrow-right" />
            <span>No output data yet — run "Execute step" to see this node's items.</span>
          </div>
        </section>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Node } from '@vue-flow/core'
import { WORKFLOW_NODE_CATALOG_BY_TYPE } from '../../shared/workflowNodeCatalog'
import { NODE_PARAMS_REGISTRY } from './nodeParamsRegistry'
import NodeResultDisplay, { type NodeResultLike } from './NodeResultDisplay.vue'

// Three-pane node detail panel: Input (test triggerData) / Parameters (the
// node's config form, mutating the LIVE node.data object so the editor's deep
// watch picks changes up) / Output (results of the last "Execute step").
// Makes no API calls itself — emits request-test; the parent owns save + POST.
const props = defineProps<{
  node: Node | null
  edges?: { source: string; target: string; sourceHandle?: string | null }[]
  testRunning?: boolean
  testResults?: NodeResultLike[] | null
}>()

// The selected node's own result (its output items) from the last Execute step.
const selfResult = computed<NodeResultLike | null>(() =>
  props.node && props.testResults
    ? props.testResults.find(r => r.nodeId === props.node!.id) ?? null
    : null
)

// The items the node received: the output items of its upstream node(s).
const inputItems = computed<{ json: Record<string, any> }[]>(() => {
  if (!props.node || !props.testResults || !props.edges) return []
  const items: { json: Record<string, any> }[] = []
  for (const edge of props.edges) {
    if (edge.target !== props.node.id) continue
    const src = props.testResults.find(r => r.nodeId === edge.source)
    if (src?.items) items.push(...src.items)
  }
  return items
})

// Whether this node has an incoming edge (so its input comes from upstream,
// not a payload you type). Triggers / orphans supply their own starting payload.
const hasUpstream = computed(() =>
  !!props.node && !!props.edges?.some(edge => edge.target === props.node!.id)
)

// Whether the last test run actually included this node (so empty input means
// "upstream produced nothing", not "not run yet").
const ranThisNode = computed(() =>
  !!props.node && !!props.testResults?.some(r => r.nodeId === props.node!.id)
)

// Collapsible trigger-payload editor for downstream nodes (closed by default).
const payloadOpen = ref(false)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'request-test', payload: { nodeId: string; triggerData: Record<string, any> }): void
}>()

const entry = computed(() => props.node ? WORKFLOW_NODE_CATALOG_BY_TYPE[String(props.node.type)] : null)
const paramsComponent = computed(() => props.node ? NODE_PARAMS_REGISTRY[String(props.node.type)] ?? null : null)

const inputJson = ref('{}')
const inputError = ref('')

watch(() => props.node?.id, () => {
  if (!props.node) return
  inputError.value = ''
  payloadOpen.value = false
  // The payload is the run's STARTING data — default empty, never guessed from
  // this node's own fields (that read as "output shown as input").
  inputJson.value = '{}'
}, { immediate: true })

function runTest() {
  if (!props.node) return
  inputError.value = ''
  let parsed: Record<string, any>
  try {
    parsed = JSON.parse(inputJson.value || '{}')
  } catch {
    inputError.value = 'Invalid JSON'
    return
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    inputError.value = 'Trigger data must be a JSON object'
    return
  }
  emit('request-test', { nodeId: props.node.id, triggerData: parsed })
}
</script>

<style scoped>
.node-detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: var(--an-surface-dark, #09090b);
  border-left: 1px solid var(--an-border-dark, #27272a);
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35);
  z-index: 21;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--an-border-dark, #27272a);
  flex: 0 0 auto;
}

.detail-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  font-size: 15px;
}
.detail-icon.cat-trigger { background: rgba(59, 130, 246, 0.12); color: var(--an-cobalt, #3b82f6); }
.detail-icon.cat-logic { background: rgba(249, 115, 22, 0.12); color: var(--an-orange, #f97316); }
.detail-icon.cat-action { background: rgba(16, 185, 129, 0.12); color: var(--an-emerald, #10b981); }

.detail-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.detail-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--an-text-primary, #fafafa);
}
.detail-subtitle {
  font-size: 11px;
  color: var(--an-text-muted, #8b8b94);
}

.detail-close {
  background: none;
  border: none;
  color: var(--an-text-muted, #8b8b94);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  line-height: 1;
}
.detail-close:hover {
  color: var(--an-text-primary, #fafafa);
  background: var(--an-surface-elevated, #18181b);
}

.detail-sections {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--an-text-muted, #8b8b94);
}

.detail-run-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid var(--an-emerald, #10b981);
  background: rgba(16, 185, 129, 0.1);
  color: var(--an-emerald, #10b981);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
  transition: background 0.15s ease;
}
.detail-run-btn:hover:not(:disabled) { background: rgba(16, 185, 129, 0.18); }
.detail-run-btn:disabled { opacity: 0.6; cursor: default; }

.detail-input-json {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--an-border-dark, #27272a);
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-primary, #fafafa);
  font-size: 12px;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  line-height: 1.6;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.15s;
  margin-bottom: 6px;
}
.detail-input-json:focus { border-color: var(--an-cobalt, #3b82f6); }
.detail-input-json.invalid { border-color: var(--an-red, #ef4444); }

.detail-input-error {
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--an-red, #ef4444);
}

.detail-result { margin-bottom: 6px; }

.detail-linkbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 0;
  background: none;
  border: none;
  color: var(--an-cobalt, #3b82f6);
  cursor: pointer;
  font-size: 11px;
}
.detail-linkbtn:hover { text-decoration: underline; }
.detail-linkbtn i { font-size: 9px; }

.detail-subhead {
  margin: 10px 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--an-text-muted, #8b8b94);
}

.detail-output-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 1px dashed var(--an-border-dark, #27272a);
  border-radius: 8px;
  color: var(--an-text-muted, #8b8b94);
  font-size: 12px;
}

.detail-slide-enter-active,
.detail-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.detail-slide-enter-from,
.detail-slide-leave-to { transform: translateX(100%); opacity: 0; }
</style>
