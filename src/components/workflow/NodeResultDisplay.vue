<template>
  <div class="wf-node-result" :class="result.status">
    <div class="wf-node-result-header">
      <span class="wf-node-result-icon">{{ result.status === 'success' ? '✓' : result.status === 'failed' ? '✗' : result.status === 'waiting' ? '⏳' : '○' }}</span>
      <span class="wf-node-result-type">{{ result.nodeType }}</span>
      <span v-if="result.itemCount != null" class="wf-node-result-items-badge">{{ result.itemCount }} item{{ result.itemCount === 1 ? '' : 's' }}</span>
      <span v-if="result.duration" class="wf-node-result-duration">{{ result.duration }}ms</span>
    </div>

    <div v-if="result.output && Object.keys(result.output).length" class="wf-node-result-output">
      <div v-for="(val, key) in result.output" :key="key" class="wf-output-row">
        <span class="wf-output-key">{{ key }}:</span>
        <span class="wf-output-val">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
      </div>
    </div>

    <div v-if="result.items && result.items.length" class="wf-node-result-items">
      <div v-for="(item, idx) in result.items" :key="idx" class="wf-item">
        <span class="wf-item-idx">{{ idx }}</span>
        <span class="wf-item-json">{{ compact(item.json) }}</span>
      </div>
      <div v-if="result.itemCount != null && result.itemCount > result.items.length" class="wf-item-more">
        + {{ result.itemCount - result.items.length }} more…
      </div>
    </div>

    <div v-if="result.error" class="wf-node-result-error">{{ result.error }}</div>
  </div>
</template>

<script setup lang="ts">
// Shared rendering for one node's execution result — used by the Execution
// History panel and the NodeDetailPanel's Output region.
export interface NodeResultLike {
  nodeId: string
  nodeType: string
  status: string
  output?: any
  items?: { json: Record<string, any> }[]
  itemCount?: number
  error?: string
  duration?: number
}

defineProps<{ result: NodeResultLike }>()

// One-line preview of an item's json (truncated).
function compact(json: Record<string, any>): string {
  const str = JSON.stringify(json)
  return str.length > 160 ? str.slice(0, 157) + '…' : str
}
</script>

<style scoped>
.wf-node-result {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid var(--an-text-muted, #8b8b94);
}
.wf-node-result.success { border-left-color: var(--an-emerald, #10b981); }
.wf-node-result.failed { border-left-color: var(--an-red, #ef4444); }
.wf-node-result.skipped { border-left-color: var(--an-text-muted, #52525b); }
.wf-node-result.waiting { border-left-color: var(--an-orange, #f97316); }

.wf-node-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}
.wf-node-result-icon { font-size: 11px; }
.wf-node-result.success .wf-node-result-icon { color: var(--an-emerald, #10b981); }
.wf-node-result.failed .wf-node-result-icon { color: var(--an-red, #ef4444); }
.wf-node-result.skipped .wf-node-result-icon { color: var(--an-text-muted, #52525b); }

.wf-node-result-type {
  color: var(--an-text-secondary, #a1a1aa);
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 11px;
}
.wf-node-result-duration {
  margin-left: auto;
  font-size: 10px;
  color: var(--an-text-muted, #71717a);
}

.wf-node-result-output {
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  font-size: 11px;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
}
.wf-output-row {
  display: flex;
  gap: 6px;
  padding: 1px 0;
  line-height: 1.5;
}
.wf-output-key {
  color: var(--an-emerald, #10b981);
  white-space: nowrap;
  flex-shrink: 0;
}
.wf-output-val {
  color: var(--an-text-secondary, #a1a1aa);
  word-break: break-all;
}

.wf-node-result-items-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  color: var(--an-cobalt, #3b82f6);
  font-weight: 600;
}

.wf-node-result-items {
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  font-size: 11px;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow: auto;
}
.wf-item { display: flex; gap: 8px; line-height: 1.5; }
.wf-item-idx {
  flex-shrink: 0;
  color: var(--an-cobalt, #3b82f6);
  opacity: 0.7;
}
.wf-item-json { color: var(--an-text-secondary, #a1a1aa); word-break: break-all; }
.wf-item-more { color: var(--an-text-muted, #71717a); padding-top: 2px; }

.wf-node-result-error {
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--an-red, #ef4444);
  font-size: 11px;
  font-family: 'Fira Code', monospace;
}
</style>
