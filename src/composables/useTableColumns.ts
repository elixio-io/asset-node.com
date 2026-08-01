import { ref, computed, reactive, watch } from 'vue'

export interface ColumnDef {
  key: string
  label: string
  default: boolean
  format?: 'date' | 'employee' | 'tag' | 'currency' | 'boolean'
  sortable?: boolean
  icon?: string
  path?: string
  noFilter?: boolean
  fixed?: boolean
}

export const ACTIONS_COLUMN: ColumnDef = {
  key: '_actions',
  label: 'Actions',
  default: true,
  fixed: true,
  noFilter: true,
}

export function useTableColumns(viewId: string, _allColumns: ColumnDef[]) {
  const allColumns = _allColumns.some(c => c.key === '_actions')
    ? _allColumns
    : [..._allColumns, ACTIONS_COLUMN]

  const storageKey = `columns:${viewId}`

  function loadSaved(): string[] {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const keys = JSON.parse(raw) as string[]
        if (!keys.includes('_actions')) keys.push('_actions')
        return keys
      }
    } catch {  }
    return allColumns.filter(c => c.default).map(c => c.key)
  }

  const visibleKeys = ref<string[]>(loadSaved())

  watch(visibleKeys, (keys) => {
    localStorage.setItem(storageKey, JSON.stringify(keys))
  }, { deep: true })

  const visibleColumns = computed(() =>
    visibleKeys.value
      .map(k => allColumns.find(c => c.key === k))
      .filter(Boolean) as ColumnDef[]
  )

  function toggleColumn(key: string) {
    const col = allColumns.find(c => c.key === key)
    if (col?.fixed && visibleKeys.value.includes(key)) return

    const idx = visibleKeys.value.indexOf(key)
    if (idx >= 0) {
      visibleKeys.value.splice(idx, 1)
    } else {
      visibleKeys.value.push(key)
    }
  }

  function reorderColumns(orderedKeys: string[]) {
    const reordered = orderedKeys.filter(k => visibleKeys.value.includes(k))
    const omittedFixed = visibleKeys.value.filter(key => {
      const column = allColumns.find(col => col.key === key)
      return column?.fixed && !reordered.includes(key)
    })
    visibleKeys.value = [...reordered, ...omittedFixed]
  }

  function isVisible(key: string): boolean {
    return visibleKeys.value.includes(key)
  }

  function resetToDefaults() {
    visibleKeys.value = allColumns.filter(c => c.default).map(c => c.key)
    if (!visibleKeys.value.includes('_actions')) visibleKeys.value.push('_actions')
  }

  function resolveValue(row: Record<string, unknown>, col: ColumnDef): unknown {
    const path = col.path || col.key
    return path.split('.').reduce((obj: any, segment) => obj?.[segment], row)
  }

  const columnFilters = reactive<Record<string, string>>({})

  function setColumnFilter(key: string, value: string) {
    columnFilters[key] = value
  }

  function clearColumnFilter(key: string) {
    delete columnFilters[key]
  }

  function clearAllFilters() {
    Object.keys(columnFilters).forEach(k => delete columnFilters[k])
  }

  const hasActiveFilters = computed(() =>
    Object.values(columnFilters).some(v => v && v.trim().length > 0)
  )

  function cellToString(val: any, col: ColumnDef): string {
    if (val == null) return ''
    if (typeof val === 'object' && !Array.isArray(val)) {
      if (val.firstName && val.lastName) return `${val.firstName} ${val.lastName}`.toLowerCase()
      if (val.name) return String(val.name).toLowerCase()
      if (val.slug) return String(val.slug).toLowerCase()
      return ''
    }
    if (Array.isArray(val)) return val.join(', ').toLowerCase()
    if (col.format === 'date') {
      try { return new Date(val).toLocaleDateString('de-DE') } catch { return '' }
    }
    if (col.format === 'currency' && typeof val === 'number') {
      return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
    }
    return String(val).toLowerCase()
  }

  function filterRow(row: Record<string, any>, formatCellValue?: (item: any, col: ColumnDef) => string): boolean {
    for (const col of visibleColumns.value) {
      const filterVal = columnFilters[col.key]
      if (!filterVal || !filterVal.trim()) continue

      const needle = filterVal.trim().toLowerCase()
      let haystack: string

      if (formatCellValue) {
        haystack = formatCellValue(row, col).toLowerCase()
      } else {
        haystack = cellToString(row[col.key], col)
      }

      if (!haystack.includes(needle)) return false
    }
    return true
  }

  return {
    allColumns,
    visibleColumns,
    visibleKeys,
    toggleColumn,
    reorderColumns,
    isVisible,
    resetToDefaults,
    resolveValue,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    filterRow
  }
}
