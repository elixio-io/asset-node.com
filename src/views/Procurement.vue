<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProcurementStore } from '../stores/procurement'
import type { ParseResult } from '../stores/procurement'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'

const router = useRouter()
const { t } = useI18n()
const store = useProcurementStore()


const parseInput = ref('')
const localParse = ref<ParseResult | null>(null)
const showParsePanel = ref(false)
const processRequestId = ref<string | null>(null)
const adhocProcessing = ref(false)

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 25


const urgencySeverity = (urgency: string): "success" | "warn" | "danger" | "secondary" | undefined => {
  const map: Record<string, "success" | "warn" | "danger"> = {
    standard: 'success',
    urgent: 'warn',
    critical: 'danger'
  }
  return map[urgency] || 'success'
}

const scenarioTagSeverity = (tag: string): "success" | "info" | "warn" | "danger" | "secondary" => {
  const map: Record<string, "success" | "info" | "warn" | "danger" | "secondary"> = {
    standard: 'success',
    restricted: 'danger',
    contradictory: 'warn',
    threshold: 'warn',
    missing_info: 'secondary',
    capacity: 'info',
    lead_time: 'info',
    multilingual: 'info',
    multi_country: 'info'
  }
  return map[tag] || 'secondary'
}

const stats = computed(() => {
  const reqs = store.requests
  const totalBudget = reqs.reduce((sum, r) => sum + (r.budget || 0), 0)
  return {
    total: reqs.length,
    pending: reqs.filter(r => !r.status || r.status === 'pending' || r.status === 'new').length,
    processed: reqs.filter(r => r.status === 'processed' || r.status === 'approved').length,
    totalBudget
  }
})

const filteredRequests = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.requests
  return store.requests.filter(r => {
    return (
      r.request_id?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.scenario_tags?.some((tag: string) => tag.toLowerCase().includes(q))
    )
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRequests.value.length / pageSize)))

const paginatedRequests = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredRequests.value.slice(start, start + pageSize)
})

watch(searchQuery, () => {
  currentPage.value = 1
})


async function handleParse() {
  if (!parseInput.value.trim() || parseInput.value.trim().length < 5) return
  const result = await store.parseText(parseInput.value)
  if (result) localParse.value = result
}

async function handleProcess(id: string) {
  processRequestId.value = id
  await store.processRequest(id)
  if (store.selectedResult) {
    router.push(`/procurement/${id}`)
  }
  processRequestId.value = null
}

async function handleAdhocProcess() {
  if (!localParse.value) return
  adhocProcessing.value = true
  const requestData: Record<string, unknown> = {
    title: localParse.value.title,
    category_l1: localParse.value.category_l1,
    category_l2: localParse.value.category_l2,
    quantity: localParse.value.quantity,
    unit_of_measure: localParse.value.unit_of_measure,
    budget_amount: localParse.value.budget_amount,
    currency: localParse.value.currency,
    country: localParse.value.country,
    urgency: localParse.value.urgency,
    esg_requirement: localParse.value.esg_requirement,
    request_text: parseInput.value,
    key_requirements: localParse.value.key_requirements,
    preferred_supplier: localParse.value.preferred_supplier_mentioned
  }
  const result = await store.processAdhoc(requestData)
  if (result) {
    const adhocId = result.request_id || 'adhoc'
    router.push(`/procurement/${adhocId}`)
  }
  adhocProcessing.value = false
}

function runDemoScenario(id: string) {
  handleProcess(id)
}

function viewDetail(id: string) {
  router.push(`/procurement/${id}`)
}

function clearParse() {
  store.clearParse()
  localParse.value = null
  parseInput.value = ''
}

function formatBudget(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return val.toLocaleString('de-DE')
}


onMounted(async () => {
  await store.checkHealth()
  await store.fetchRequests()
})
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <div class="view-header">
        <div>
          <h1 class="text-xl font-bold">{{ t('procurement.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">
            {{ t('procurement.subtitle') }}
          </p>
        </div>
        <div class="flex align-items-center gap-2">
          <Tag
            v-if="store.apiOnline !== null"
            :value="store.apiOnline ? t('procurement.apiOnline') : t('procurement.apiOffline')"
            :severity="store.apiOnline ? 'success' : 'danger'"
            :icon="store.apiOnline ? 'pi pi-check-circle' : 'pi pi-times-circle'"
          />
          <Button
            :label="t('procurement.parseRequest')"
            icon="pi pi-sparkles"
            severity="info"
            size="small"
            @click="showParsePanel = !showParsePanel"
          />
        </div>
      </div>

      <div class="proc-stats">
        <div class="proc-stat-card">
          <div class="proc-stat-value">{{ stats.total }}</div>
          <div class="proc-stat-label">{{ t('procurement.totalRequests') }}</div>
        </div>
        <div class="proc-stat-card">
          <div class="proc-stat-value proc-stat--warn">{{ stats.pending }}</div>
          <div class="proc-stat-label">{{ t('procurement.pendingRequests') }}</div>
        </div>
        <div class="proc-stat-card">
          <div class="proc-stat-value proc-stat--success">{{ stats.processed }}</div>
          <div class="proc-stat-label">{{ t('procurement.processedRequests') }}</div>
        </div>
        <div class="proc-stat-card">
          <div class="proc-stat-value" style="font-size: 1.5rem;">{{ formatBudget(stats.totalBudget) }} EUR</div>
          <div class="proc-stat-label">{{ t('procurement.totalBudgetVolume') }}</div>
        </div>
      </div>

      <div class="proc-demo-bar">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-bookmark" style="color: var(--p-yellow-400);" />
          <span class="font-semibold" style="font-size: 13px;">{{ t('procurement.demoScenarios') }}</span>
        </div>
        <div class="flex gap-2">
          <Button
            :label="t('procurement.demoStandard')"
            severity="success"
            size="small"
            icon="pi pi-play"
            :loading="processRequestId === 'REQ-000001'"
            @click="runDemoScenario('REQ-000001')"
            data-testid="demo-standard"
          />
          <Button
            :label="t('procurement.demoEdgeCase')"
            severity="warn"
            size="small"
            icon="pi pi-exclamation-triangle"
            :loading="processRequestId === 'REQ-000006'"
            @click="runDemoScenario('REQ-000006')"
            data-testid="demo-edge"
          />
          <Button
            :label="t('procurement.demoThreshold')"
            severity="danger"
            size="small"
            icon="pi pi-dollar"
            :loading="processRequestId === 'REQ-000003'"
            @click="runDemoScenario('REQ-000003')"
            data-testid="demo-threshold"
          />
        </div>
      </div>

      <div v-if="showParsePanel" class="proc-parse-panel">
        <div class="proc-parse-header">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-sparkles" style="color: var(--an-primary);" />
            <span class="font-bold">{{ t('procurement.aiParser') }}</span>
          </div>
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="secondary"
            size="small"
            @click="showParsePanel = false; clearParse()"
          />
        </div>

        <div class="proc-parse-body">
          <div class="proc-parse-input-area">
            <Textarea
              v-model="parseInput"
              :placeholder="t('procurement.parsePlaceholder')"
              rows="4"
              class="proc-parse-textarea"
              data-testid="parse-input"
            />
            <div class="flex gap-2 mt-2">
              <Button
                :label="t('procurement.parseBtn')"
                icon="pi pi-bolt"
                :loading="store.parseLoading"
                :disabled="parseInput.trim().length < 5"
                size="small"
                @click="handleParse"
                data-testid="parse-submit"
              />
              <Button
                v-if="localParse"
                :label="t('common.reset')"
                severity="secondary"
                size="small"
                @click="clearParse"
              />
            </div>
          </div>

          <div v-if="localParse" class="proc-parse-result" data-testid="parse-result">
            <div class="proc-parse-result-header">
              <span class="font-bold">{{ t('procurement.parsedResult') }}</span>
              <Tag
                v-if="localParse.confidence"
                :value="`${Math.round(localParse.confidence * 100)}% ${t('procurement.confidence')}`"
                :severity="localParse.confidence > 0.7 ? 'success' : 'warn'"
              />
            </div>
            <div class="proc-parse-grid">
              <div v-if="localParse.title" class="proc-parse-field">
                <span class="proc-field-label">{{ t('procurement.fieldTitle') }}</span>
                <span class="proc-field-value">{{ localParse.title }}</span>
              </div>
              <div v-if="localParse.category_l1" class="proc-parse-field">
                <span class="proc-field-label">{{ t('common.category') }}</span>
                <span class="proc-field-value">{{ localParse.category_l1 }} {{ localParse.category_l2 ? `/ ${localParse.category_l2}` : '' }}</span>
              </div>
              <div v-if="localParse.quantity" class="proc-parse-field">
                <span class="proc-field-label">{{ t('common.quantity') }}</span>
                <span class="proc-field-value">{{ localParse.quantity }}</span>
              </div>
              <div v-if="localParse.budget_amount" class="proc-parse-field">
                <span class="proc-field-label">{{ t('procurement.budget') }}</span>
                <span class="proc-field-value">{{ localParse.budget_amount?.toLocaleString('de-DE') }} {{ localParse.currency || 'EUR' }}</span>
              </div>
              <div v-if="localParse.urgency" class="proc-parse-field">
                <span class="proc-field-label">{{ t('procurement.urgency') }}</span>
                <Tag :value="localParse.urgency" :severity="urgencySeverity(localParse.urgency)" />
              </div>
              <div v-if="localParse.detected_language" class="proc-parse-field">
                <span class="proc-field-label">{{ t('procurement.language') }}</span>
                <span class="proc-field-value">{{ localParse.detected_language }}</span>
              </div>
              <div v-if="localParse.esg_requirement" class="proc-parse-field">
                <span class="proc-field-label">ESG</span>
                <Tag :value="t('procurement.esgRequired')" severity="success" icon="pi pi-leaf" />
              </div>
            </div>
            <div v-if="localParse.key_requirements?.length" class="mt-3">
              <span class="proc-field-label">{{ t('procurement.requirements') }}</span>
              <div class="flex gap-1 flex-wrap mt-1">
                <Tag
                  v-for="req in localParse.key_requirements"
                  :key="req"
                  :value="req"
                  severity="secondary"
                  style="font-size: 11px;"
                />
              </div>
            </div>
            <div class="mt-3 pt-3" style="border-top: 1px solid var(--an-border-dark);">
              <Button
                :label="t('procurement.runFullPipeline')"
                icon="pi pi-play"
                severity="success"
                :loading="adhocProcessing"
                @click="handleAdhocProcess"
                data-testid="run-adhoc-pipeline"
              />
              <span class="ml-2" style="font-size: 12px; color: var(--an-text-muted);">
                {{ t('procurement.runFullPipelineHint') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.loading" class="proc-empty-state">
        <ProgressSpinner style="width: 48px; height: 48px;" />
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="store.error && !store.loading" class="proc-empty-state proc-error">
        <i class="pi pi-exclamation-triangle" style="font-size: 2rem;" />
        <p>{{ store.error }}</p>
        <Button :label="t('common.refresh')" severity="secondary" size="small" @click="store.fetchRequests()" />
      </div>

      <div v-else-if="store.requests.length === 0 && !store.loading" class="proc-empty-state">
        <div class="proc-empty-icon">
          <i class="pi pi-shopping-cart" />
        </div>
        <h2>{{ t('procurement.noRequests') }}</h2>
        <p>{{ t('procurement.noRequestsHint') }}</p>
      </div>

      <div v-else class="proc-table-wrap">
        <div class="proc-table-toolbar">
          <div class="proc-search-box">
            <i class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              :placeholder="t('procurement.searchPlaceholder')"
              class="proc-search-input"
              data-testid="search-input"
            />
          </div>
          <span class="proc-result-count">
            {{ t('procurement.resultCount', { filtered: filteredRequests.length, total: store.requests.length }) }}
          </span>
        </div>

        <table class="proc-table" data-testid="procurement-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ t('procurement.fieldTitle') }}</th>
              <th>{{ t('common.category') }}</th>
              <th>{{ t('procurement.budget') }}</th>
              <th>{{ t('procurement.urgency') }}</th>
              <th>{{ t('procurement.tags') }}</th>
              <th>{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in paginatedRequests" :key="req.request_id" class="proc-table-row" @click="viewDetail(req.request_id)">
              <td class="proc-id">{{ req.request_id }}</td>
              <td class="font-semibold">{{ req.title || '—' }}</td>
              <td>
                <span class="proc-cat-badge">{{ req.category }}</span>
              </td>
              <td>
                <span v-if="req.budget">{{ formatBudget(req.budget) }} {{ req.currency || 'EUR' }}</span>
                <span v-else class="proc-muted">—</span>
              </td>
              <td>
                <Tag :value="req.urgency || 'standard'" :severity="urgencySeverity(req.urgency || 'standard')" style="font-size: 11px;" />
              </td>
              <td>
                <div class="flex gap-1 flex-wrap">
                  <Tag
                    v-for="tag in (req.scenario_tags || [])"
                    :key="tag"
                    :value="tag"
                    :severity="scenarioTagSeverity(tag)"
                    style="font-size: 10px;"
                  />
                </div>
              </td>
              <td @click.stop>
                <div class="flex gap-1">
                  <Button
                    icon="pi pi-play"
                    severity="info"
                    text
                    rounded
                    size="small"
                    v-tooltip.top="t('procurement.runPipeline')"
                    :loading="processRequestId === req.request_id"
                    @click="handleProcess(req.request_id)"
                    :data-testid="`process-${req.request_id}`"
                  />
                  <Button
                    icon="pi pi-eye"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    v-tooltip.top="t('common.details')"
                    @click="viewDetail(req.request_id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalPages > 1" class="proc-pagination">
          <Button
            icon="pi pi-chevron-left"
            text
            rounded
            size="small"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          />
          <span class="proc-page-info">
            {{ t('procurement.pageInfo', { current: currentPage, total: totalPages }) }}
          </span>
          <Button
            icon="pi pi-chevron-right"
            text
            rounded
            size="small"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proc-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.proc-stat-card {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  padding: 20px;
  text-align: center;
}

.proc-stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--an-text-primary);
  line-height: 1;
  margin-bottom: 6px;
}

.proc-stat--warn { color: var(--p-orange-400); }
.proc-stat--success { color: var(--p-green-400); }
.proc-stat--danger { color: var(--p-red-400); }

.proc-stat-label {
  font-size: 12px;
  color: var(--an-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.proc-demo-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: linear-gradient(135deg, rgba(250, 200, 50, 0.08), rgba(250, 150, 50, 0.05));
  border: 1px solid rgba(250, 200, 50, 0.2);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 20px;
}

.proc-parse-panel {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  margin-bottom: 24px;
  overflow: hidden;
}

.proc-parse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--an-border-dark);
}

.proc-parse-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
}

.proc-parse-textarea {
  width: 100%;
  resize: vertical;
  font-size: 14px;
}

.proc-parse-result {
  background: var(--an-bg-dark);
  border-radius: 10px;
  padding: 16px;
}

.proc-parse-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.proc-parse-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.proc-parse-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.proc-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--an-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.proc-field-value {
  font-size: 14px;
  color: var(--an-text-primary);
  font-weight: 500;
}

.proc-table-wrap {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  overflow: hidden;
}

.proc-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--an-border-dark);
  gap: 12px;
}

.proc-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 400px;
}

.proc-search-box i {
  color: var(--an-text-muted);
  font-size: 14px;
}

.proc-search-input {
  flex: 1;
  font-size: 13px;
}

.proc-result-count {
  font-size: 12px;
  color: var(--an-text-muted);
  white-space: nowrap;
}

.proc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.proc-table th {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 1px solid var(--an-border-dark);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--an-text-muted);
  background: var(--an-bg-dark);
}

.proc-table-row {
  cursor: pointer;
  transition: background 0.15s;
}

.proc-table-row:hover {
  background: var(--an-surface-elevated);
}

.proc-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--an-border-dark);
  color: var(--an-text-primary);
}

.proc-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--an-text-subtle);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proc-cat-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255,255,255,0.08);
  color: var(--an-text-subtle);
}

.proc-muted {
  color: var(--an-text-muted);
}

.proc-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--an-border-dark);
}

.proc-page-info {
  font-size: 13px;
  color: var(--an-text-subtle);
  font-weight: 500;
}

.proc-empty-state {
  text-align: center;
  padding: 60px 20px;
}

.proc-empty-state p {
  margin-top: 12px;
  color: var(--an-text-subtle);
  font-size: 14px;
}

.proc-error {
  color: var(--p-red-400);
}

.proc-empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  font-size: 2rem;
  color: var(--an-primary);
}

.proc-empty-state h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 8px;
}

@media (max-width: 700px) {
  .proc-parse-body {
    grid-template-columns: 1fr;
  }
  .proc-stats {
    grid-template-columns: 1fr 1fr;
  }
  .proc-table {
    font-size: 12px;
  }
  .proc-demo-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
