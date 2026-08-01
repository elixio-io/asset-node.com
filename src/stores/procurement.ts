
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api'


export interface ProcurementRequest {
  request_id: string
  id?: string
  title: string
  category: string
  category_l1?: string
  category_l2?: string
  quantity?: number
  budget: number | null
  budget_amount?: number | null
  currency: string
  urgency?: 'standard' | 'urgent' | 'critical'
  country?: string
  required_by_date?: string
  status?: string
  scenario_tags?: string[]
}

export interface SupplierShortlistEntry {
  supplier_id: string
  supplier_name: string
  rank: number
  preferred: boolean
  unit_price: number
  lead_time_days: number
  total_cost: number
  scores: {
    composite: number
    price: number
    quality: number
    risk: number
    esg: number
    historical_bonus: number
    preferred_bonus: number
  }
}

export interface PipelineResult {
  request_id: string
  processing_time_ms: number
  request?: ProcurementRequest
  recommendation: {
    recommended_supplier: string
    recommended_supplier_name: string
    composite_score: number
    total_cost: number
    within_budget: boolean
    reason: string
  }
  supplier_shortlist: SupplierShortlistEntry[]
  suppliers_excluded?: { supplier_id: string; supplier_name: string; exclusion_reason: string }[]
  validation: {
    has_issues: boolean
    issues: { message: string; type: string; field: string; severity: string }[]
  }
  escalation: {
    escalation_required: boolean
    urgency: string
    triggered_rules: string[]
    escalation_targets: string[]
  }
  policy_evaluation?: {
    approval_level: string | null
    violations: { rule_id: string; description: string }[]
  }
  ai_enrichment?: {
    intent?: string
    summary?: string
    text_sentiment?: string
    risk_indicators?: string[]
    negotiation_leverage?: string[]
    suggested_negotiation_points?: string[]
  } | null
  audit_trail?: {
    timestamp: string
    steps: { step: number; action: string; detail: string; data_sources: string[] }[]
    data_sources_used: string[]
  }
}

export interface ParseResult {
  title?: string
  category_l1?: string
  category_l2?: string
  quantity?: number
  unit_of_measure?: string
  budget_amount?: number
  currency?: string
  urgency?: string
  country?: string
  required_by_date?: string
  preferred_supplier_mentioned?: string
  confidence?: number
  detected_language?: string
  key_requirements?: string[]
  esg_requirement?: boolean
}


export const useProcurementStore = defineStore('procurement', () => {
  const requests = ref<ProcurementRequest[]>([])
  const selectedResult = ref<PipelineResult | null>(null)
  const parseResult = ref<ParseResult | null>(null)
  const categories = ref<Record<string, string[]>>({})
  const loading = ref(false)
  const parseLoading = ref(false)
  const processLoading = ref(false)
  const error = ref<string | null>(null)
  const apiOnline = ref<boolean | null>(null)

  const requestCount = computed(() => requests.value.length)


  async function checkHealth(): Promise<boolean> {
    try {
      await api.get('/procurement/health')
      apiOnline.value = true
      return true
    } catch {
      apiOnline.value = false
      return false
    }
  }

  async function fetchRequests(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/procurement/requests')
      requests.value = res.data?.data || res.data || []
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to load requests'
      requests.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories(): Promise<void> {
    try {
      const res = await api.get('/procurement/categories')
      categories.value = res.data?.data || res.data || {}
    } catch {
    }
  }

  async function parseText(text: string): Promise<ParseResult | null> {
    parseLoading.value = true
    error.value = null
    parseResult.value = null
    try {
      const res = await api.post('/procurement/parse', { text })
      parseResult.value = res.data?.data || res.data
      return parseResult.value
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Parse failed'
      return null
    } finally {
      parseLoading.value = false
    }
  }

  async function processRequest(id: string): Promise<PipelineResult | null> {
    processLoading.value = true
    error.value = null
    selectedResult.value = null
    try {
      const res = await api.get(`/procurement/process/${encodeURIComponent(id)}`, { timeoutMs: 120_000 })
      selectedResult.value = res.data?.data || res.data
      return selectedResult.value
    } catch (err: any) {
      error.value = err.response?.data?.message || err.response?.data?.error || err.message || 'Process failed'
      return null
    } finally {
      processLoading.value = false
    }
  }

  async function fetchResult(id: string): Promise<PipelineResult | null> {
    processLoading.value = true
    error.value = null
    selectedResult.value = null
    try {
      const res = await api.get(`/procurement/results/${encodeURIComponent(id)}`)
      selectedResult.value = res.data?.data || res.data
      return selectedResult.value
    } catch (err: any) {
      if (err.response?.status === 404 && !id.startsWith('ADHOC-')) {
        return await processRequest(id)
      }
      error.value = err.response?.data?.message || err.response?.data?.error || err.message || 'Result not found'
      return null
    } finally {
      processLoading.value = false
    }
  }

  function clearParse(): void {
    parseResult.value = null
  }

  async function processAdhoc(parsedData: Record<string, unknown>): Promise<PipelineResult | null> {
    processLoading.value = true
    error.value = null
    selectedResult.value = null
    try {
      const res = await api.post('/procurement/process-adhoc', parsedData, { timeoutMs: 120_000 })
      selectedResult.value = res.data?.data || res.data
      return selectedResult.value
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Adhoc process failed'
      return null
    } finally {
      processLoading.value = false
    }
  }

  function clearResult(): void {
    selectedResult.value = null
  }

  return {
    requests,
    selectedResult,
    parseResult,
    categories,
    loading,
    parseLoading,
    processLoading,
    error,
    apiOnline,
    requestCount,
    checkHealth,
    fetchRequests,
    fetchCategories,
    parseText,
    processRequest,
    fetchResult,
    processAdhoc,
    clearParse,
    clearResult
  }
})
