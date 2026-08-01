import { ref, computed, type Ref } from 'vue'
import type { ColumnDef } from './useTableColumns'

export function useTableSort<T>(
  data: Ref<T[]>,
  columns: ColumnDef[],
  getCellValue: (item: T, key: string) => string
) {
  const sortKey = ref<string>('')
  const sortDir = ref<'asc' | 'desc' | ''>('')

  function toggleSort(key: string) {
    if (sortKey.value === key) {
      if (sortDir.value === 'asc') sortDir.value = 'desc'
      else if (sortDir.value === 'desc') { sortKey.value = ''; sortDir.value = '' }
      else sortDir.value = 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
  }

  const sorted = computed(() => {
    if (!sortKey.value || !sortDir.value) return data.value
    const key = sortKey.value
    const dir = sortDir.value === 'asc' ? 1 : -1
    const col = columns.find(c => c.key === key)
    return [...data.value].sort((a, b) => {
      const va = getCellValue(a, key)
      const vb = getCellValue(b, key)
      if (va === '—' && vb !== '—') return 1
      if (vb === '—' && va !== '—') return -1
      const na = parseFloat(va.replace(/[^\d.-]/g, ''))
      const nb = parseFloat(vb.replace(/[^\d.-]/g, ''))
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir
      if (col?.format === 'date') {
        const da = new Date((a as any)[key]).getTime() || 0
        const db = new Date((b as any)[key]).getTime() || 0
        return (da - db) * dir
      }
      return va.localeCompare(vb, 'de') * dir
    })
  })

  return { sortKey, sortDir, toggleSort, sorted }
}
