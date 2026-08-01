<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import api from '../lib/api'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

const props = defineProps<{
  entityType: string
  entityId: string
}>()

interface AuditEntry {
  _id: string
  action: string
  entityType: string
  entityId: string
  userEmail: string
  userId: string
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

const entries = ref<AuditEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)

const idNameMap = ref<Record<string, string>>({})

const actionLabels: Record<string, string> = {
  create: 'Erstellt',
  update: 'Geändert',
  delete: 'Gelöscht',
  assign: 'Zugewiesen',
  unassign: 'Zurückgenommen',
  status_change: 'Status geändert',
  login: 'Anmeldung',
  logout: 'Abmeldung'
}

const actionSeverity: Record<string, string> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  assign: 'primary',
  unassign: 'warn',
  status_change: 'warn'
}

const IS_OBJECT_ID = /^[a-f0-9]{24}$/i

async function loadLookups() {
  try {
    const [cats, stats, mfrs, sups, locs, depts, emps, hw, lic, per, comp, kits] = await Promise.all([
      api.get('/categories').then(r => r.data).catch(() => []),
      api.get('/statuses').then(r => r.data).catch(() => []),
      api.get('/manufacturers').then(r => r.data).catch(() => []),
      api.get('/suppliers').then(r => r.data).catch(() => []),
      api.get('/locations').then(r => r.data).catch(() => []),
      api.get('/departments').then(r => r.data).catch(() => []),
      api.get('/employees').then(r => r.data).catch(() => []),
      api.get('/hardware').then(r => r.data).catch(() => []),
      api.get('/licenses').then(r => r.data).catch(() => []),
      api.get('/peripherals').then(r => r.data).catch(() => []),
      api.get('/components').then(r => r.data).catch(() => []),
      api.get('/kits').then(r => r.data).catch(() => [])
    ])
    const map: Record<string, string> = {}
    for (const item of [...cats, ...stats, ...mfrs, ...sups, ...locs, ...depts, ...hw, ...lic, ...per, ...comp, ...kits]) {
      if (item._id) {
        if (item.name) {
          map[item._id] = item.name
        } else if (item.assetName || item.model) {
          map[item._id] = item.assetName || item.model
        } else if (item.assetTag) {
          map[item._id] = item.assetTag
        }
      }
    }
    for (const emp of emps) {
      if (emp._id) {
        map[emp._id] = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email || emp._id
      }
    }
    idNameMap.value = map
  } catch {
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Ja' : 'Nein'
  if (Array.isArray(val)) {
    return val.map(v => formatValue(v)).join(', ') || '—'
  }
  if (typeof val === 'object') {
    if (val instanceof Date) return new Date(val as any).toLocaleDateString('de-DE')

    const obj = val as any
    if (obj.name) return obj.name
    if (obj.firstName || obj.lastName) return [obj.firstName, obj.lastName].filter(Boolean).join(' ')
    if (obj.assetName) return obj.assetName
    if (obj.assetTag && obj.model) return `${obj.assetTag} (${obj.model})`
    if (obj.assetTag) return obj.assetTag
    if (obj.model) return obj.model
    if (obj.serialNumber) return obj.serialNumber

    if (obj._id && typeof obj._id === 'string' && idNameMap.value[obj._id]) {
      return idNameMap.value[obj._id]
    }

    const formattedProps: string[] = []
    const ignoredKeys = new Set(['_id', '__v', 'id', 'createdBy', 'updatedBy', 'organizationId', 'orgId', 'userId', 'entityId', 'password'])
    for (const [k, v] of Object.entries(obj)) {
       if (ignoredKeys.has(k)) continue
       const formattedV = formatValue(v)
       if (formattedV !== '—' && formattedV !== 'Unbekannt / Gelöscht') {
         formattedProps.push(`${formatFieldName(k)}: ${formattedV}`)
       }
    }
    if (formattedProps.length > 0) return `{ ${formattedProps.join(', ')} }`

    return 'Unbekannt'
  }

  if (typeof val === 'string' && IS_OBJECT_ID.test(val)) {
    return idNameMap.value[val] || 'Unbekannt / Gelöscht'
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    try {
      return new Date(val).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {  }
  }
  return String(val)
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/Id$/, '')
    .trim()
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getChangedFields(entry: AuditEntry): { key: string; before: string; after: string }[] {
  if (!entry.changes) return []
  const fields: { key: string; before: string; after: string }[] = []
  const allKeys = new Set([
    ...Object.keys(entry.changes.before || {}),
    ...Object.keys(entry.changes.after || {})
  ])
  for (const key of allKeys) {
    fields.push({
      key,
      before: formatValue(entry.changes.before?.[key]),
      after: formatValue(entry.changes.after?.[key])
    })
  }
  return fields
}

async function fetchHistory() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get(`/audit-log/entity/${props.entityType}/${props.entityId}`, {
      params: { page: page.value, limit: 20 }
    })
    entries.value = res.data.data
    totalPages.value = res.data.pagination.pages
    total.value = res.data.pagination.total
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Änderungsverlauf konnte nicht geladen werden'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadLookups()
  await fetchHistory()
})
watch(() => [props.entityType, props.entityId], fetchHistory)
</script>

<template>
  <div class="change-history">
    <div class="ch-header">
      <h3 class="ch-title">
        <i class="pi pi-history"></i>
        Änderungsverlauf
      </h3>
      <span v-if="total > 0" class="ch-count">{{ total }} Einträge</span>
    </div>

    <div v-if="loading" class="ch-loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Lade Verlauf…</span>
    </div>

    <div v-else-if="error" class="ch-error">
      <i class="pi pi-exclamation-triangle"></i>
      {{ error }}
    </div>

    <div v-else-if="entries.length === 0" class="ch-empty">
      <i class="pi pi-info-circle"></i>
      <span>Noch keine Änderungen erfasst.</span>
    </div>

    <div v-else class="ch-timeline">
      <div v-for="entry in entries" :key="entry._id" class="ch-entry">
        <div class="ch-dot" :class="'ch-dot--' + entry.action"></div>

        <div class="ch-content">
          <div class="ch-meta">
            <Tag
              :value="actionLabels[entry.action] || entry.action"
              :severity="(actionSeverity[entry.action] || 'secondary') as any"
              class="ch-action-tag"
            />
            <span class="ch-user" :title="entry.userId">
              <i class="pi pi-user"></i>
              {{ entry.userEmail }}
            </span>
            <span class="ch-time" :title="new Date(entry.timestamp).toLocaleString('de-DE')">
              {{ timeAgo(entry.timestamp) }}
            </span>
          </div>

          <div v-if="entry.changes && (entry.action === 'update' || entry.action === 'status_change')" class="ch-diffs">
            <div v-for="field in getChangedFields(entry)" :key="field.key" class="ch-diff-row">
              <span class="ch-field-name">{{ formatFieldName(field.key) }}</span>
              <span class="ch-old-value" :title="field.before">{{ field.before }}</span>
              <i class="pi pi-arrow-right ch-arrow"></i>
              <span class="ch-new-value" :title="field.after">{{ field.after }}</span>
            </div>
          </div>

          <div v-else-if="entry.changes?.after && entry.action === 'create'" class="ch-diffs ch-diffs--create">
            <div v-for="field in getChangedFields(entry)" :key="field.key" class="ch-diff-row">
              <span class="ch-field-name">{{ formatFieldName(field.key) }}</span>
              <span class="ch-new-value">{{ field.after }}</span>
            </div>
          </div>

          <div v-if="entry.ipAddress" class="ch-ip">
            IP: {{ entry.ipAddress }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="totalPages > 1" class="ch-pagination">
      <Button
        icon="pi pi-chevron-left"
        text
        rounded
        size="small"
        :disabled="page <= 1"
        @click="page--; fetchHistory()"
      />
      <span class="ch-page-info">{{ page }} / {{ totalPages }}</span>
      <Button
        icon="pi pi-chevron-right"
        text
        rounded
        size="small"
        :disabled="page >= totalPages"
        @click="page++; fetchHistory()"
      />
    </div>
  </div>
</template>

<style scoped>
.change-history {
  padding: 16px 0;
}

.ch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ch-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--an-text-primary, #e0e0e0);
}

.ch-count {
  font-size: 12px;
  color: var(--an-text-muted, #888);
  background: var(--an-surface-subtle, rgba(255,255,255,0.06));
  padding: 2px 10px;
  border-radius: 12px;
}

.ch-loading,
.ch-empty,
.ch-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: var(--an-text-muted, #888);
  font-size: 14px;
  justify-content: center;
}

.ch-error {
  color: var(--an-danger, #ef4444);
}


.ch-timeline {
  position: relative;
  padding-left: 24px;
}

.ch-timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--an-border-dark, rgba(255,255,255,0.08));
  border-radius: 1px;
}

.ch-entry {
  position: relative;
  margin-bottom: 20px;
}

.ch-entry:last-child {
  margin-bottom: 0;
}

.ch-dot {
  position: absolute;
  left: -21px;
  top: 6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--an-text-muted, #555);
  border: 2px solid var(--an-bg, #1a1a2e);
  z-index: 1;
}

.ch-dot--create { background: #22c55e; }
.ch-dot--update { background: #3b82f6; }
.ch-dot--delete { background: #ef4444; }
.ch-dot--assign { background: #8b5cf6; }
.ch-dot--unassign { background: #f59e0b; }
.ch-dot--status_change { background: #f59e0b; }

.ch-content {
  background: var(--an-surface-subtle, rgba(255,255,255,0.03));
  border: 1px solid var(--an-border-dark, rgba(255,255,255,0.06));
  border-radius: 8px;
  padding: 12px 14px;
}

.ch-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
}

.ch-action-tag {
  font-size: 11px !important;
}

.ch-user {
  color: var(--an-text-primary, #e0e0e0);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ch-time {
  color: var(--an-text-muted, #888);
  font-size: 12px;
  margin-left: auto;
}


.ch-diffs {
  margin-top: 10px;
  border-top: 1px solid var(--an-border-dark, rgba(255,255,255,0.06));
  padding-top: 8px;
}

.ch-diff-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  flex-wrap: wrap;
}

.ch-field-name {
  font-weight: 600;
  color: var(--an-text-subtle, #aaa);
  min-width: 100px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ch-old-value {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ch-arrow {
  color: var(--an-text-muted, #666);
  font-size: 10px;
}

.ch-new-value {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ch-diffs--create .ch-new-value {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.1);
}

.ch-ip {
  margin-top: 6px;
  font-size: 11px;
  color: var(--an-text-muted, #666);
  font-family: monospace;
}


.ch-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--an-border-dark, rgba(255,255,255,0.06));
}

.ch-page-info {
  font-size: 13px;
  color: var(--an-text-muted, #888);
}
</style>
