<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProcurementStore } from '../stores/procurement'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useProcurementStore()

const requestId = computed(() => route.params.id as string)
const loading = ref(false)


const recommendation = computed(() => store.selectedResult?.recommendation || null)

function scoreColor(score: number | null | undefined): string {
  const numericScore = Number(score)
  if (!Number.isFinite(numericScore)) return 'var(--an-text-muted)'
  if (numericScore >= 0.8) return 'var(--p-green-400)'
  if (numericScore >= 0.6) return 'var(--p-orange-400)'
  return 'var(--p-red-400)'
}

function scorePercent(score: number | null | undefined): string {
  const numericScore = Number(score)
  return Number.isFinite(numericScore) ? `${Math.round(numericScore * 100)}%` : '—'
}

function formatAmount(value: number | null | undefined): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString('de-DE') : '—'
}

function severityForValidation(severity: string): 'warn' | 'danger' | 'info' {
  return { warning: 'warn' as const, error: 'danger' as const }[severity] || 'info'
}


onMounted(async () => {
  if (!store.selectedResult || store.selectedResult.request_id !== requestId.value) {
    loading.value = true
    await store.fetchResult(requestId.value)
    loading.value = false
  }
})
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <div class="view-header">
        <div class="flex align-items-center gap-3">
          <Button icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.push('/procurement')" />
          <div>
            <h1 class="text-xl font-bold">{{ t('procurement.detailTitle') }} — {{ requestId }}</h1>
            <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">
              {{ t('procurement.pipelineResult') }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="loading || store.processLoading" class="proc-empty-state">
        <ProgressSpinner style="width: 48px; height: 48px;" />
        <p>{{ t('procurement.processing') }}</p>
      </div>

      <div v-else-if="store.error" class="proc-empty-state proc-error">
        <i class="pi pi-exclamation-triangle" style="font-size: 2rem;" />
        <p>{{ store.error }}</p>
        <Button :label="t('common.back')" severity="secondary" size="small" @click="router.push('/procurement')" />
      </div>

      <template v-else-if="store.selectedResult">
        <div v-if="recommendation" class="pd-section pd-section--highlight">
          <h2 class="pd-section-title">
            <i class="pi pi-star-fill" style="color: var(--p-yellow-400);" />
            {{ t('procurement.recommendation') }}
          </h2>
          <div class="pd-reco-card">
            <div class="pd-reco-supplier">
              <span class="pd-reco-name">{{ recommendation.recommended_supplier_name || t('common.unknown') }}</span>
              <span class="pd-reco-id">{{ recommendation.recommended_supplier || '—' }}</span>
            </div>
            <div class="pd-reco-metrics">
              <div class="pd-reco-metric">
                <span class="pd-meta-label">Score</span>
                <span class="pd-reco-score" :style="{ color: scoreColor(recommendation.composite_score) }">
                  {{ scorePercent(recommendation.composite_score) }}
                </span>
              </div>
              <div class="pd-reco-metric">
                <span class="pd-meta-label">{{ t('procurement.totalCost') }}</span>
                <span class="pd-meta-value">{{ formatAmount(recommendation.total_cost) }} EUR</span>
              </div>
              <div class="pd-reco-metric">
                <span class="pd-meta-label">{{ t('procurement.budget') }}</span>
                <Tag
                  :value="recommendation.within_budget ? t('procurement.withinBudget') : t('procurement.overBudget')"
                  :severity="recommendation.within_budget ? 'success' : 'danger'"
                  style="font-size: 12px;"
                />
              </div>
            </div>
            <p class="pd-reco-reason">{{ recommendation.reason }}</p>
          </div>
        </div>

        <div class="pd-section" v-if="store.selectedResult.supplier_shortlist?.length">
          <h2 class="pd-section-title">
            {{ t('procurement.rankedSuppliers') }}
            <span class="pd-count-badge">{{ store.selectedResult.supplier_shortlist.length }}</span>
          </h2>

          <div class="pd-supplier-list">
            <div
              v-for="(supplier, idx) in store.selectedResult.supplier_shortlist"
              :key="supplier.supplier_id"
              class="pd-supplier-card"
              :class="{ 'pd-supplier-card--top': idx === 0 }"
            >
              <div class="pd-supplier-rank">
                <span class="pd-rank-number">{{ supplier.rank }}</span>
              </div>

              <div class="pd-supplier-info">
                <div class="pd-supplier-name">
                  {{ supplier.supplier_name }}
                  <Tag v-if="supplier.preferred" value="Preferred" severity="info" style="font-size: 10px; margin-left: 6px;" />
                </div>
                <div class="pd-supplier-total" :style="{ color: scoreColor(supplier.scores.composite) }">
                  {{ scorePercent(supplier.scores.composite) }}
                </div>
                <div class="pd-supplier-cost">
                  {{ formatAmount(supplier.total_cost) }} EUR
                  <span class="pd-muted">({{ formatAmount(supplier.unit_price) }} EUR/unit × {{ supplier.lead_time_days ?? '—' }}d lead)</span>
                </div>
              </div>

              <div class="pd-score-bars">
                <div class="pd-score-bar-item">
                  <span class="pd-score-label">{{ t('procurement.priceScore') }}</span>
                  <div class="pd-bar-track">
                    <div class="pd-bar-fill pd-bar--price" :style="{ width: scorePercent(supplier.scores.price) }" />
                  </div>
                  <span class="pd-score-val">{{ scorePercent(supplier.scores.price) }}</span>
                </div>
                <div class="pd-score-bar-item">
                  <span class="pd-score-label">{{ t('procurement.qualityScore') }}</span>
                  <div class="pd-bar-track">
                    <div class="pd-bar-fill pd-bar--quality" :style="{ width: scorePercent(supplier.scores.quality) }" />
                  </div>
                  <span class="pd-score-val">{{ scorePercent(supplier.scores.quality) }}</span>
                </div>
                <div class="pd-score-bar-item">
                  <span class="pd-score-label">{{ t('procurement.riskScore') }}</span>
                  <div class="pd-bar-track">
                    <div class="pd-bar-fill pd-bar--risk" :style="{ width: scorePercent(supplier.scores.risk) }" />
                  </div>
                  <span class="pd-score-val">{{ scorePercent(supplier.scores.risk) }}</span>
                </div>
                <div class="pd-score-bar-item">
                  <span class="pd-score-label">ESG</span>
                  <div class="pd-bar-track">
                    <div class="pd-bar-fill pd-bar--esg" :style="{ width: scorePercent(supplier.scores.esg) }" />
                  </div>
                  <span class="pd-score-val">{{ scorePercent(supplier.scores.esg) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="pd-section" v-if="store.selectedResult.suppliers_excluded?.length">
          <h2 class="pd-section-title pd-title--muted">
            <i class="pi pi-ban" />
            {{ t('procurement.excludedSuppliers') }}
          </h2>
          <div class="pd-excl-list">
            <div v-for="ex in store.selectedResult.suppliers_excluded" :key="ex.supplier_id" class="pd-excl-item">
              <span class="font-semibold">{{ ex.supplier_name }}</span>
              <span class="pd-muted">{{ ex.exclusion_reason }}</span>
            </div>
          </div>
        </div>

        <div class="pd-section" v-if="store.selectedResult.validation?.has_issues">
          <h2 class="pd-section-title pd-title--warn">
            <i class="pi pi-exclamation-triangle" />
            {{ t('procurement.validationIssues') }}
          </h2>
          <div class="pd-validation-list">
            <div v-for="(issue, i) in store.selectedResult.validation.issues" :key="i" class="pd-validation-item">
              <Tag :value="issue.severity" :severity="severityForValidation(issue.severity)" style="font-size: 11px;" />
              <span>{{ issue.message }}</span>
            </div>
          </div>
        </div>

        <div class="pd-section" v-if="store.selectedResult.escalation?.escalation_required">
          <h2 class="pd-section-title pd-title--danger">
            <i class="pi pi-flag" />
            {{ t('procurement.escalationFlags') }}
          </h2>
          <div class="pd-meta-grid">
            <div class="pd-meta-item">
              <span class="pd-meta-label">{{ t('procurement.urgency') }}</span>
              <Tag :value="store.selectedResult.escalation.urgency" severity="danger" />
            </div>
          </div>
          <div v-if="store.selectedResult.escalation.triggered_rules?.length" class="mt-2">
            <Tag
              v-for="rule in store.selectedResult.escalation.triggered_rules"
              :key="rule"
              :value="rule"
              severity="warn"
              style="font-size: 11px; margin: 2px;"
            />
          </div>
        </div>

        <div v-if="store.selectedResult.ai_enrichment" class="pd-section">
          <h2 class="pd-section-title">
            <i class="pi pi-sparkles" style="color: var(--an-primary);" />
            {{ t('procurement.aiInsights') }}
          </h2>

          <div v-if="store.selectedResult.ai_enrichment.summary" class="pd-insight-card mb-3">
            <span class="pd-insight-label">AI Summary</span>
            <p class="pd-insight-value">{{ store.selectedResult.ai_enrichment.summary }}</p>
          </div>

          <div v-if="store.selectedResult.ai_enrichment.text_sentiment" class="mb-3">
            <span class="pd-insight-label mr-2">Tone</span>
            <Tag :value="store.selectedResult.ai_enrichment.text_sentiment" severity="info" style="font-size: 11px;" />
          </div>

          <div class="pd-insights-grid">
            <div v-if="store.selectedResult.ai_enrichment.intent" class="pd-insight-card">
              <span class="pd-insight-label">{{ t('procurement.intent') }}</span>
              <p class="pd-insight-value">{{ store.selectedResult.ai_enrichment.intent }}</p>
            </div>

            <div v-if="store.selectedResult.ai_enrichment.risk_indicators?.length" class="pd-insight-card">
              <span class="pd-insight-label">{{ t('procurement.riskIndicators') }}</span>
              <div class="flex gap-1 flex-wrap mt-1">
                <Tag v-for="risk in store.selectedResult.ai_enrichment.risk_indicators" :key="risk" :value="risk" severity="danger" style="font-size: 11px;" />
              </div>
            </div>
          </div>

          <div v-if="store.selectedResult.ai_enrichment.suggested_negotiation_points?.length" class="pd-insight-card mt-3">
            <span class="pd-insight-label">💡 Negotiation Leverage Points</span>
            <ul class="pd-negotiation-list mt-2">
              <li v-for="(point, i) in store.selectedResult.ai_enrichment.suggested_negotiation_points" :key="i">
                {{ point }}
              </li>
            </ul>
          </div>
        </div>

        <div class="pd-section" v-if="store.selectedResult.audit_trail?.steps?.length">
          <h2 class="pd-section-title">
            <i class="pi pi-history" />
            {{ t('procurement.auditTrail') }}
          </h2>
          <div class="pd-timeline">
            <div v-for="step in store.selectedResult.audit_trail.steps" :key="step.step" class="pd-timeline-step">
              <div class="pd-timeline-dot" />
              <div class="pd-timeline-content">
                <span class="pd-timeline-action">{{ step.action.replace(/_/g, ' ') }}</span>
                <span class="pd-timeline-detail">{{ step.detail }}</span>
              </div>
            </div>
          </div>
          <div class="pd-meta-item mt-3">
            <span class="pd-meta-label">{{ t('procurement.processingTime') }}</span>
            <span class="pd-meta-value">{{ formatAmount(store.selectedResult.processing_time_ms) }}ms</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pd-section {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 20px;
}

.pd-section--highlight {
  border-color: var(--p-green-400);
  background: linear-gradient(135deg, rgba(72, 199, 142, 0.04), transparent);
}

.pd-section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pd-title--warn { color: var(--p-orange-400); }
.pd-title--danger { color: var(--p-red-400); }
.pd-title--muted { color: var(--an-text-subtle); }

.pd-count-badge {
  font-size: 12px;
  font-weight: 700;
  background: rgba(255,255,255,0.1);
  padding: 2px 8px;
  border-radius: 10px;
  color: var(--an-text-subtle);
}

.pd-muted { color: var(--an-text-muted); font-size: 12px; }

.pd-reco-card {
  background: var(--an-bg-dark);
  border-radius: 12px;
  padding: 20px;
}

.pd-reco-supplier {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}

.pd-reco-name {
  font-size: 1.2rem;
  font-weight: 800;
}

.pd-reco-id {
  font-size: 12px;
  color: var(--an-text-muted);
}

.pd-reco-metrics {
  display: flex;
  gap: 32px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pd-reco-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pd-reco-score {
  font-size: 1.6rem;
  font-weight: 900;
}

.pd-reco-reason {
  font-size: 13px;
  color: var(--an-text-subtle);
  line-height: 1.6;
  margin: 0;
}

.pd-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.pd-meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pd-meta-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--an-text-muted);
}

.pd-meta-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--an-text-primary);
}

.pd-supplier-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pd-supplier-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  background: var(--an-bg-dark);
  border-radius: 12px;
  border: 1px solid var(--an-border-dark);
  transition: border-color 0.2s, transform 0.2s;
}

.pd-supplier-card:hover {
  border-color: var(--an-primary);
  transform: translateX(4px);
}

.pd-supplier-card--top {
  border-color: var(--p-green-400);
  background: linear-gradient(135deg, rgba(72, 199, 142, 0.06), transparent);
}

.pd-supplier-rank { flex-shrink: 0; }

.pd-rank-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  font-weight: 800;
  font-size: 16px;
  color: var(--an-text-subtle);
}

.pd-supplier-card--top .pd-rank-number {
  background: var(--p-green-400);
  color: #000;
}

.pd-supplier-info { min-width: 180px; }

.pd-supplier-name {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
}

.pd-supplier-total {
  font-size: 1.4rem;
  font-weight: 800;
}

.pd-supplier-cost {
  font-size: 12px;
  color: var(--an-text-subtle);
  margin-top: 2px;
}

.pd-score-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pd-score-bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pd-score-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--an-text-muted);
  min-width: 60px;
  text-align: right;
}

.pd-bar-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}

.pd-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}

.pd-bar--price   { background: var(--p-blue-400); }
.pd-bar--quality { background: var(--p-green-400); }
.pd-bar--risk    { background: var(--p-orange-400); }
.pd-bar--esg     { background: var(--p-teal-400); }

.pd-score-val {
  font-size: 11px;
  font-weight: 700;
  min-width: 36px;
  color: var(--an-text-subtle);
}

.pd-excl-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pd-excl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: var(--an-bg-dark);
  border-radius: 8px;
  font-size: 13px;
}

.pd-validation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pd-validation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 165, 0, 0.06);
  border-radius: 8px;
  font-size: 13px;
}

.pd-insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.pd-insight-card {
  background: var(--an-bg-dark);
  border-radius: 10px;
  padding: 16px;
}

.pd-insight-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--an-text-muted);
}

.pd-insight-value {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--an-text-primary);
  line-height: 1.5;
}

.pd-negotiation-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.pd-negotiation-list li {
  padding: 6px 0 6px 20px;
  position: relative;
  font-size: 13px;
  color: var(--an-text-primary);
  line-height: 1.5;
  border-bottom: 1px solid var(--an-border-dark);
}

.pd-negotiation-list li:last-child {
  border-bottom: none;
}

.pd-negotiation-list li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--p-green-400);
  font-weight: 700;
}

.pd-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 16px;
  border-left: 2px solid var(--an-border-dark);
}

.pd-timeline-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
  position: relative;
}

.pd-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--an-primary);
  flex-shrink: 0;
  margin-top: 4px;
  margin-left: -21px;
}

.pd-timeline-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pd-timeline-action {
  font-size: 13px;
  font-weight: 700;
  text-transform: capitalize;
  color: var(--an-text-primary);
}

.pd-timeline-detail {
  font-size: 12px;
  color: var(--an-text-subtle);
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

@media (max-width: 700px) {
  .pd-supplier-card {
    flex-direction: column;
    align-items: flex-start;
  }
  .pd-score-bars {
    width: 100%;
  }
  .pd-reco-metrics {
    gap: 16px;
  }
}
</style>
