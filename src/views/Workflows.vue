<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { extractApiError } from '../lib/extractApiError'
import { useFormatters } from '../composables/useFormatters'
import { usePlanLimits } from '../composables/usePlanLimits'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import WorkflowEditor from '../components/workflow/WorkflowEditor.vue'
import NodeResultDisplay from '../components/workflow/NodeResultDisplay.vue'
import {
  deriveWorkflowTriggers,
  normalizeLegacyWorkflowGraph,
  validateWorkflowGraph,
  type WorkflowTriggerConfig
} from '../shared/workflowValidation'
import {
  buildWorkflowStarter,
  WORKFLOW_STARTER_TEMPLATES,
  type WorkflowTemplateId
} from '../shared/workflowTemplates'

const { t } = useI18n()
const { fmtDate } = useFormatters()
const { isAtLimit } = usePlanLimits()


interface WorkflowSummary {
  _id: string
  name: string
  description?: string
  isActive: boolean
  triggers: WorkflowTriggerConfig[]
  lastRunAt?: string
  runCount: number
  lastError?: string
  createdAt: string
}

interface WorkflowFull extends WorkflowSummary {
  nodes: any[]
  edges: any[]
}

interface WorkflowRunItem {
  _id: string
  workflowName: string
  status: string
  triggeredBy: string
  nodeResults: { nodeId: string; nodeType: string; status: string; output?: any; items?: { json: Record<string, any> }[]; itemCount?: number; error?: string; duration?: number }[]
  startedAt: string
  completedAt?: string
  error?: string
}


const workflows = ref<WorkflowSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const executing = ref<string | null>(null)
const successMsg = ref<string | null>(null)

const activeWorkflow = ref<WorkflowFull | null>(null)
const hasUnsavedChanges = ref(false)

const showWorkflowPicker = ref(false)

const workflowValidation = computed(() => {
  if (!activeWorkflow.value) return { valid: true, errors: [], warnings: [], issues: [] }
  const triggers = deriveWorkflowTriggers(activeWorkflow.value.nodes || [])
  return validateWorkflowGraph(activeWorkflow.value.nodes, activeWorkflow.value.edges, triggers)
})

const showRunsPanel = ref(false)
const runs = ref<WorkflowRunItem[]>([])
const loadingRuns = ref(false)

const deleteConfirmDialog = ref(false)


const triggerEvents = [
  { value: 'hardware.synced', label: 'Hardware Synced (MDM)' },
  { value: 'hardware.created', label: 'Hardware Created' },
  { value: 'employee.synced', label: 'Employee Synced (HR)' },
  { value: 'status.changed', label: 'Status Changed' },
  { value: 'assignment.created', label: 'Assignment Created' },
  { value: 'assignment.returned', label: 'Assignment Returned' },
  { value: 'maintenance.completed', label: 'Maintenance Done' }
]

const cronOptions = [
  { value: '*/5m', label: 'Every 5 minutes' },
  { value: '*/15m', label: 'Every 15 minutes' },
  { value: '*/30m', label: 'Every 30 minutes' },
  { value: '*/1h', label: 'Every hour' },
  { value: '*/6h', label: 'Every 6 hours' },
  { value: '*/12h', label: 'Every 12 hours' },
  { value: '*/24h', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }
]

const oneTriggerLabel = (t: WorkflowTriggerConfig) => {
  if (t.type === 'event') return triggerEvents.find(e => e.value === t.event)?.label || t.event || ''
  if (t.type === 'schedule') return cronOptions.find(c => c.value === t.cron)?.label || t.cron || ''
  if (t.type === 'webhook') return 'Webhook'
  return 'Manual / API'
}

const triggerLabel = (wf: WorkflowSummary) => {
  const triggers = wf.triggers || []
  if (triggers.length === 0) return 'No trigger'
  if (triggers.length > 1) return `${triggers.length} triggers`
  return oneTriggerLabel(triggers[0])
}

const triggerIcon = (wf: WorkflowSummary) => {
  const triggers = wf.triggers || []
  if (triggers.length !== 1) return 'pi pi-bolt'
  const type = triggers[0].type
  return type === 'event' ? 'pi pi-bolt'
    : type === 'schedule' ? 'pi pi-clock'
    : type === 'webhook' ? 'pi pi-link'
    : 'pi pi-play'
}

const nodesVersion = ref(0)
function extractWebhookId(nodes: any[] | undefined): string | undefined {
  return nodes?.find((n: any) => n.type === 'trigger-webhook')?.data?.hookId
}

function triggersMatch(left: WorkflowTriggerConfig[], right: WorkflowTriggerConfig[]) {
  if (left.length !== right.length) return false
  const key = (t: WorkflowTriggerConfig) => `${t.nodeId ?? ''}:${t.type}:${t.event ?? ''}:${t.cron ?? ''}`
  const leftKeys = left.map(key).sort()
  const rightKeys = right.map(key).sort()
  return leftKeys.every((k, i) => k === rightKeys[i])
}


async function fetchWorkflows() {
  loading.value = true
  try { workflows.value = (await api.get('/workflows')).data }
  catch { error.value = 'Failed to load workflows' }
  finally { loading.value = false }
}

async function createWorkflow(templateId: WorkflowTemplateId | unknown = 'blank') {
  const targetTemplateId = typeof templateId === 'string' ? (templateId as WorkflowTemplateId) : 'blank'
  saving.value = true
  error.value = null
  try {
    const payload = buildWorkflowStarter(targetTemplateId, workflows.value.length + 1)
    const created = (await api.post('/workflows', payload)).data
    await fetchWorkflows()
    await loadWorkflow(created._id)
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to create workflow')
  } finally { saving.value = false }
}

async function loadWorkflow(id: string) {
  try {
    error.value = null
    successMsg.value = null
    const loaded = (await api.get(`/workflows/${id}`)).data as WorkflowFull
    const normalized = normalizeLegacyWorkflowGraph(loaded.nodes, loaded.edges, loaded.triggers?.[0] ?? { type: 'manual' })
    const derivedTriggers = deriveWorkflowTriggers(normalized.nodes)
    const triggerWasOutOfSync = !triggersMatch(loaded.triggers || [], derivedTriggers)
    loaded.nodes = normalized.nodes
    loaded.edges = normalized.edges
    loaded.triggers = derivedTriggers
    activeWorkflow.value = loaded
    hasUnsavedChanges.value = normalized.migrated || triggerWasOutOfSync
    if (hasUnsavedChanges.value) {
      successMsg.value = 'An older trigger configuration was repaired. Save to keep the repair.'
    }
    showWorkflowPicker.value = false
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to load workflow')
  }
}

async function selectWorkflow(id: string) {
  if (activeWorkflow.value?._id === id) {
    showWorkflowPicker.value = false
    return
  }
  if (hasUnsavedChanges.value && !(await saveWorkflow())) return
  await loadWorkflow(id)
}

function onEditorUpdate(payload: { nodes: any[]; edges: any[] }) {
  if (!activeWorkflow.value) return
  activeWorkflow.value.nodes = payload.nodes
  activeWorkflow.value.edges = payload.edges
  hasUnsavedChanges.value = true
}

async function saveWorkflow(): Promise<boolean> {
  if (!activeWorkflow.value) return false
  saving.value = true
  error.value = null
  try {
    const triggers = deriveWorkflowTriggers(activeWorkflow.value.nodes)
    const previousHookId = extractWebhookId(activeWorkflow.value.nodes)
    const updated = (await api.put(`/workflows/${activeWorkflow.value._id}`, {
      nodes: activeWorkflow.value.nodes,
      edges: activeWorkflow.value.edges,
      name: activeWorkflow.value.name.trim() || 'Untitled automation',
      triggers
    })).data
    activeWorkflow.value.triggers = updated.triggers
    activeWorkflow.value.name = updated.name
    activeWorkflow.value.nodes = updated.nodes
    const newHookId = extractWebhookId(updated.nodes)
    if (newHookId && newHookId !== previousHookId) nodesVersion.value++
    hasUnsavedChanges.value = false
    await fetchWorkflows()
    return true
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to save')
    return false
  } finally {
    saving.value = false
  }
}

async function toggleWorkflow() {
  if (!activeWorkflow.value) return
  error.value = null

  if (!activeWorkflow.value.isActive) {
    if (!workflowValidation.value.valid) {
      error.value = `Not ready to activate: ${workflowValidation.value.errors[0]?.message || 'Complete the workflow graph.'}`
      return
    }
    if (hasUnsavedChanges.value && !(await saveWorkflow())) return
  }

  try {
    const result = (await api.patch(`/workflows/${activeWorkflow.value._id}/toggle`)).data
    activeWorkflow.value.isActive = result.isActive
    const listItem = workflows.value.find(w => w._id === activeWorkflow.value?._id)
    if (listItem) listItem.isActive = result.isActive
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to toggle')
  }
}

// Per-node "Execute step" (NodeDetailPanel): auto-save the current graph,
// then run the trigger + everything up to the node — a REAL execution
// recorded as a test run (excluded from run history and runCount).
const nodeTestRunning = ref(false)
const nodeTestResults = ref<any[] | null>(null)

async function testNode(payload: { nodeId: string; triggerData: Record<string, any> }) {
  if (!activeWorkflow.value) return
  error.value = null
  nodeTestResults.value = null
  if (hasUnsavedChanges.value && !(await saveWorkflow())) return

  nodeTestRunning.value = true
  try {
    const res = (await api.post(
      `/workflows/${activeWorkflow.value._id}/nodes/${payload.nodeId}/test`,
      { triggerData: payload.triggerData }
    )).data
    nodeTestResults.value = res.nodeResults || (res.nodeResult ? [res.nodeResult] : [])
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Node test failed')
  } finally {
    nodeTestRunning.value = false
  }
}

async function executeWorkflow() {
  if (!activeWorkflow.value) return
  error.value = null
  if (!workflowValidation.value.valid) {
    error.value = `Cannot test this workflow: ${workflowValidation.value.errors[0]?.message || 'Complete the workflow graph.'}`
    return
  }
  if (hasUnsavedChanges.value && !(await saveWorkflow())) return

  executing.value = activeWorkflow.value._id
  successMsg.value = null
  try {
    await api.post(`/workflows/${activeWorkflow.value._id}/execute`, {})
    const updated = (await api.get(`/workflows/${activeWorkflow.value._id}`)).data
    activeWorkflow.value.runCount = updated.runCount
    activeWorkflow.value.lastRunAt = updated.lastRunAt
    activeWorkflow.value.lastError = updated.lastError
    await fetchWorkflows()
    successMsg.value = `✅ Workflow executed — ${updated.runCount} total runs`
    await showRuns()
    setTimeout(() => { successMsg.value = null }, 5000)
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Execution failed')
  } finally { executing.value = null }
}

async function showRuns() {
  if (!activeWorkflow.value) return
  loadingRuns.value = true
  showRunsPanel.value = true
  try { runs.value = (await api.get(`/workflows/${activeWorkflow.value._id}/runs`)).data }
  catch { runs.value = [] }
  finally { loadingRuns.value = false }
}

async function deleteWorkflow() {
  if (!activeWorkflow.value) return
  try {
    await api.delete(`/workflows/${activeWorkflow.value._id}`)
    activeWorkflow.value = null
    deleteConfirmDialog.value = false
    await fetchWorkflows()
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to delete')
  }
}

async function newWorkflow(templateId: WorkflowTemplateId | unknown = 'blank') {
  const targetTemplateId = typeof templateId === 'string' ? (templateId as WorkflowTemplateId) : 'blank'
  if (saving.value) return
  if (isAtLimit('workflows')) {
    error.value = t('billing.limitReached', { resource: t('nav.automations') })
    return
  }
  if (hasUnsavedChanges.value && !(await saveWorkflow())) return
  showWorkflowPicker.value = false
  await createWorkflow(targetTemplateId)
}

const statusSeverity = (s: string) => {
  switch (s) { case 'completed': return 'success'; case 'failed': return 'danger'; default: return 'info' }
}

onMounted(() => fetchWorkflows())
</script>

<template>
  <div class="wf-fullscreen">
    <Message v-if="error" severity="error" closable @close="error = null" class="wf-toast">{{ error }}</Message>
    <Message v-if="successMsg" severity="success" closable @close="successMsg = null" class="wf-toast wf-toast-success">{{ successMsg }}</Message>

    <div class="wf-toolbar">
      <div class="wf-toolbar-left">
        <button class="wf-btn wf-btn-picker" @click="showWorkflowPicker = !showWorkflowPicker">
          <i class="pi pi-list" />
          <span>{{ activeWorkflow ? 'Workflows' : 'Select Workflow' }}</span>
          <i class="pi pi-chevron-down" style="font-size:10px;opacity:0.5;" />
        </button>

        <template v-if="activeWorkflow">
          <InputText
            v-model="activeWorkflow.name"
            class="wf-name-input"
            aria-label="Workflow name"
            @input="hasUnsavedChanges = true"
          />
          <button
            class="wf-status-pill"
            :class="{ active: activeWorkflow.isActive }"
            :disabled="saving"
            :title="!activeWorkflow.isActive && !workflowValidation.valid ? workflowValidation.errors[0]?.message : undefined"
            @click="toggleWorkflow"
          >
            <span class="wf-status-dot" />
            {{ activeWorkflow.isActive ? 'Active' : 'Inactive' }}
          </button>

          <span v-if="hasUnsavedChanges" class="wf-unsaved-badge">
            <i class="pi pi-circle-fill" style="font-size:6px;" /> Unsaved
          </span>
        </template>
      </div>

      <div class="wf-toolbar-right">
        <template v-if="activeWorkflow">
          <button class="wf-btn wf-btn-ghost" @click="showRuns" :disabled="activeWorkflow.runCount === 0" title="Execution History">
            <i class="pi pi-history" />
            <span class="wf-btn-label">{{ activeWorkflow.runCount }} runs</span>
          </button>

          <button class="wf-btn wf-btn-ghost" @click="deleteConfirmDialog = true" title="Delete">
            <i class="pi pi-trash" />
          </button>

          <div class="wf-toolbar-divider" />

          <button class="wf-btn wf-btn-save" :disabled="!hasUnsavedChanges" @click="saveWorkflow">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            <i v-else class="pi pi-save" />
            <span class="wf-btn-label">Save</span>
          </button>

          <button class="wf-btn wf-btn-execute" @click="executeWorkflow" :disabled="executing !== null">
            <i v-if="executing" class="pi pi-spin pi-spinner" />
            <i v-else class="pi pi-play-circle" />
            <span class="wf-btn-label">Test</span>
          </button>
        </template>

        <button class="wf-btn wf-btn-new" :disabled="saving" @click="newWorkflow" title="New Workflow">
          <i class="pi pi-plus" />
        </button>
      </div>
    </div>

    <div
      v-if="activeWorkflow && workflowValidation.issues.length"
      class="wf-validation-bar"
      :class="{ blocking: !workflowValidation.valid }"
    >
      <i :class="workflowValidation.valid ? 'pi pi-info-circle' : 'pi pi-exclamation-triangle'" />
      <div>
        <strong>{{ workflowValidation.valid ? 'Ready with suggestions' : 'Not ready to activate' }}</strong>
        <span
          v-for="issue in workflowValidation.issues.slice(0, 3)"
          :key="`${issue.code}-${issue.nodeId || ''}`"
        >
          {{ issue.message }}
        </span>
        <span v-if="workflowValidation.issues.length > 3">
          +{{ workflowValidation.issues.length - 3 }} more
        </span>
      </div>
    </div>

    <Transition name="slide-down">
      <div v-if="showWorkflowPicker" class="wf-picker-overlay" @click.self="showWorkflowPicker = false">
        <div class="wf-picker">
          <div class="wf-picker-header">
            <h3>My Workflows</h3>
            <button class="wf-btn wf-btn-new-sm" :disabled="saving" @click="newWorkflow">
              <i class="pi pi-plus" /> New
            </button>
          </div>

          <div class="wf-template-strip">
            <span class="wf-template-label">Start from a template</span>
            <button
              v-for="template in WORKFLOW_STARTER_TEMPLATES"
              :key="template.id"
              class="wf-template-button"
              :title="template.description"
              :disabled="saving"
              @click="newWorkflow(template.id)"
            >
              <i :class="template.icon" />
              {{ template.name }}
            </button>
          </div>

          <div v-if="loading" class="wf-picker-loading">
            <i class="pi pi-spin pi-spinner" />
          </div>

          <div v-else-if="workflows.length === 0" class="wf-picker-empty">
            <p>No workflows yet. Create your first one!</p>
          </div>

          <div v-else class="wf-picker-list">
            <div
              v-for="wf in workflows"
              :key="wf._id"
              class="wf-picker-item"
              :class="{ selected: activeWorkflow?._id === wf._id }"
              @click="selectWorkflow(wf._id)"
            >
              <div class="wf-picker-item-left">
                <span class="wf-picker-dot" :class="{ active: wf.isActive }" />
                <div>
                  <div class="wf-picker-name">{{ wf.name }}</div>
                  <div class="wf-picker-meta">
                    <i :class="triggerIcon(wf)" />
                    {{ triggerLabel(wf) }}
                    <template v-if="wf.runCount > 0"> · {{ wf.runCount }} runs</template>
                  </div>
                </div>
              </div>
              <i class="pi pi-chevron-right" style="font-size:11px;opacity:0.3;" />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <div class="wf-canvas-area">
      <template v-if="activeWorkflow">
        <WorkflowEditor
          :key="`${activeWorkflow._id}-${nodesVersion}`"
          :initial-nodes="activeWorkflow.nodes || []"
          :initial-edges="activeWorkflow.edges || []"
          :node-test-running="nodeTestRunning"
          :node-test-results="nodeTestResults"
          @update="onEditorUpdate"
          @test-node="testNode"
        />
      </template>

      <template v-else>
        <div class="wf-empty-canvas">
          <div class="wf-dot-grid" />

          <div class="wf-empty-center">
            <div class="wf-empty-icon-ring" @click="newWorkflow('blank')">
              <i class="pi pi-plus" />
            </div>
            <h2>Create your first automation</h2>
            <p>Build visual workflows to automate IT asset management tasks.<br/>Connect triggers, conditions, and actions.</p>

            <div class="wf-empty-examples">
              <div class="wf-example-card" @click="newWorkflow('warranty-alert')">
                <i class="pi pi-bell" />
                <span>Warranty Alert</span>
              </div>
              <div class="wf-example-card" @click="newWorkflow('auto-status')">
                <i class="pi pi-sync" />
                <span>Auto-Status Update</span>
              </div>
              <div class="wf-example-card" @click="newWorkflow('inventory-audit')">
                <i class="pi pi-file-edit" />
                <span>Inventory Audit</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <Transition name="slide-right">
      <div v-if="showRunsPanel" class="wf-runs-panel">
        <div class="wf-runs-header">
          <h3>Execution History</h3>
          <button class="wf-btn wf-btn-ghost" @click="showRunsPanel = false">
            <i class="pi pi-times" />
          </button>
        </div>
        <div v-if="loadingRuns" class="wf-runs-loading"><i class="pi pi-spin pi-spinner" /></div>
        <div v-else-if="runs.length === 0" class="wf-runs-empty">No runs yet</div>
        <div v-else class="wf-runs-list">
          <div v-for="run in runs" :key="run._id" class="wf-run-item">
            <div class="wf-run-top">
              <Tag :value="run.status" :severity="statusSeverity(run.status) as any" />
              <span class="wf-run-trigger">{{ run.triggeredBy }}</span>
              <span class="wf-run-date">{{ fmtDate(run.startedAt) }}</span>
            </div>

            <div v-if="run.nodeResults?.length" class="wf-run-details">
              <NodeResultDisplay
                v-for="nr in run.nodeResults"
                :key="nr.nodeId"
                :result="nr"
              />
            </div>

            <div v-if="run.error" class="wf-run-error">{{ run.error }}</div>
          </div>
        </div>
      </div>
    </Transition>

    <Dialog v-model:visible="deleteConfirmDialog" header="Delete Workflow" :style="{width:'420px'}" modal>
      <p>Delete <strong>"{{ activeWorkflow?.name }}"</strong>? This removes all execution history too.</p>
      <template #footer>
        <Button label="Cancel" text @click="deleteConfirmDialog = false" />
        <Button label="Delete" severity="danger" @click="deleteWorkflow" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>

.wf-fullscreen {
  position: fixed;
  inset: 0;
  left: var(--sidebar-width, 260px);
  display: flex;
  flex-direction: column;
  background: var(--an-bg-dark, #000000);
  z-index: 10;
  overflow: hidden;
}


.wf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: var(--an-surface-dark, #09090b);
  border-bottom: 1px solid var(--an-border-dark, #27272a);
  z-index: 20;
  flex-shrink: 0;
}

.wf-toolbar-left,
.wf-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wf-toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--an-border-dark, #27272a);
  margin: 0 4px;
}

.wf-name-input {
  width: min(260px, 24vw);
  height: 32px;
  font-weight: 600;
  background: transparent;
  border-color: transparent;
}
.wf-name-input:hover,
.wf-name-input:focus { border-color: var(--an-border-subtle, #3f3f46); }


.wf-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.wf-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wf-btn-picker {
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-primary, #fafafa);
  border: 1px solid var(--an-border-dark, #27272a);
  padding: 6px 14px;
}
.wf-btn-picker:hover {
  border-color: var(--an-border-subtle, #3f3f46);
}

.wf-btn-ghost {
  background: transparent;
  color: var(--an-text-muted, #8b8b94);
}
.wf-btn-ghost:hover {
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-primary, #fafafa);
}

.wf-btn-save {
  background: rgba(59, 130, 246, 0.1);
  color: var(--an-cobalt, #3b82f6);
  border: 1px solid rgba(59, 130, 246, 0.2);
}
.wf-btn-save:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.18);
}

.wf-btn-execute {
  background: rgba(16, 185, 129, 0.1);
  color: var(--an-emerald, #10b981);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.wf-btn-execute:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.18);
}

.wf-btn-new {
  background: var(--an-cobalt, #3b82f6);
  color: white;
  width: 34px;
  height: 34px;
  padding: 0;
  justify-content: center;
  border-radius: 8px;
}
.wf-btn-new:hover {
  filter: brightness(1.15);
  transform: scale(1.05);
}

.wf-btn-new-sm {
  background: rgba(59, 130, 246, 0.1);
  color: var(--an-cobalt, #3b82f6);
  font-size: 12px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.wf-btn-label {
  display: none;
}
@media (min-width: 768px) {
  .wf-btn-label { display: inline; }
}


.wf-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  background: var(--an-surface-elevated, #18181b);
  color: var(--an-text-muted, #8b8b94);
  border: 1px solid var(--an-border-dark, #27272a);
  transition: all 0.2s;
  font-family: inherit;
}
.wf-status-pill:disabled,
.wf-template-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.wf-status-pill.active {
  background: rgba(16, 185, 129, 0.08);
  color: var(--an-emerald, #10b981);
  border-color: rgba(16, 185, 129, 0.2);
}
.wf-status-pill:hover { filter: brightness(1.2); }

.wf-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--an-text-muted, #8b8b94);
}
.wf-status-pill.active .wf-status-dot {
  background: var(--an-emerald, #10b981);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.wf-unsaved-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--an-orange, #f97316);
  opacity: 0.8;
}

.wf-validation-bar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-shrink: 0;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.22);
  background: rgba(59, 130, 246, 0.08);
  color: #93c5fd;
  font-size: 11px;
  line-height: 1.4;
}

.wf-validation-bar.blocking {
  border-bottom-color: rgba(249, 115, 22, 0.28);
  background: rgba(249, 115, 22, 0.08);
  color: #fdba74;
}

.wf-validation-bar > div {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 3px 12px;
}

.wf-validation-bar strong {
  color: inherit;
  white-space: nowrap;
}

.wf-validation-bar span:not(:last-child)::after {
  content: ' ·';
  opacity: 0.45;
}


.wf-picker-overlay {
  position: absolute;
  top: 52px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 30;
}

.wf-picker {
  position: absolute;
  top: 0;
  left: 16px;
  width: 340px;
  max-height: calc(100dvh - 120px);
  background: var(--an-surface-elevated, #18181b);
  border: 1px solid var(--an-border-dark, #27272a);
  border-radius: 0 0 10px 10px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.wf-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--an-border-dark, #27272a);
}
.wf-picker-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--an-text-primary, #fafafa);
}

.wf-template-strip {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  padding: 10px;
  border-bottom: 1px solid var(--an-border-dark, #27272a);
}

.wf-template-label {
  padding: 0 4px 4px;
  color: var(--an-text-muted, #8b8b94);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wf-template-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--an-text-secondary, #a1a1aa);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.wf-template-button:hover {
  background: var(--an-surface-dark, #09090b);
  color: var(--an-text-primary, #fafafa);
}

.wf-template-button i {
  width: 16px;
  color: var(--an-cobalt, #3b82f6);
  text-align: center;
}

.wf-picker-loading,
.wf-picker-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--an-text-muted, #8b8b94);
  font-size: 13px;
}

.wf-picker-list {
  overflow-y: auto;
  max-height: 400px;
  padding: 6px;
}

.wf-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.wf-picker-item:hover {
  background: var(--an-surface-dark, #09090b);
}
.wf-picker-item.selected {
  background: rgba(59, 130, 246, 0.08);
}

.wf-picker-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wf-picker-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--an-border-subtle, #3f3f46);
  flex-shrink: 0;
}
.wf-picker-dot.active {
  background: var(--an-emerald, #10b981);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.wf-picker-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--an-text-primary, #fafafa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wf-picker-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--an-text-muted, #8b8b94);
  margin-top: 2px;
}


.wf-canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}


.wf-empty-canvas {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wf-dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, var(--an-border-dark, #27272a) 1px, transparent 1px);
  background-size: 24px 24px;
}

.wf-empty-center {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 480px;
}

.wf-empty-icon-ring {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  border-radius: 50%;
  border: 2px dashed var(--an-border-subtle, #3f3f46);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
  color: var(--an-cobalt, #3b82f6);
  font-size: 24px;
}
.wf-empty-icon-ring:hover {
  border-color: var(--an-cobalt, #3b82f6);
  background: rgba(59, 130, 246, 0.06);
  transform: scale(1.08);
}

.wf-empty-center h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--an-text-primary, #fafafa);
  margin: 0 0 8px;
}
.wf-empty-center p {
  font-size: 14px;
  color: var(--an-text-muted, #8b8b94);
  line-height: 1.5;
  margin: 0 0 28px;
}

.wf-empty-examples {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.wf-example-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--an-surface-elevated, #18181b);
  border: 1px solid var(--an-border-dark, #27272a);
  color: var(--an-text-subtle, #a1a1aa);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.wf-example-card:hover {
  border-color: var(--an-border-subtle, #3f3f46);
  color: var(--an-text-primary, #fafafa);
  transform: translateY(-2px);
}


.wf-runs-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 380px;
  height: 100%;
  background: var(--an-surface-dark, #09090b);
  border-left: 1px solid var(--an-border-dark, #27272a);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.3);
  z-index: 25;
  display: flex;
  flex-direction: column;
}

.wf-runs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--an-border-dark, #27272a);
}
.wf-runs-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--an-text-primary, #fafafa);
}

.wf-runs-loading,
.wf-runs-empty {
  padding: 32px;
  text-align: center;
  color: var(--an-text-muted, #8b8b94);
  font-size: 13px;
}

.wf-runs-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.wf-run-item {
  padding: 12px;
  border-radius: 6px;
  background: var(--an-surface-elevated, #18181b);
  border: 1px solid var(--an-border-dark, #27272a);
  margin-bottom: 6px;
}

.wf-run-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.wf-run-trigger { font-size: 12px; color: var(--an-text-muted, #8b8b94); text-transform: capitalize; }
.wf-run-date { font-size: 11px; color: var(--an-text-muted, #8b8b94); margin-left: auto; }

.wf-run-details { display: flex; flex-direction: column; gap: 4px; }

.slide-down-enter-active,
.slide-down-leave-active { transition: opacity 0.2s, transform 0.2s; }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; }
.slide-down-enter-from .wf-picker,
.slide-down-leave-to .wf-picker { transform: translateY(-8px); }

.slide-right-enter-active,
.slide-right-leave-active { transition: transform 0.25s ease; }
.slide-right-enter-from,
.slide-right-leave-to { transform: translateX(100%); }


.wf-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  min-width: 300px;
}
</style>
