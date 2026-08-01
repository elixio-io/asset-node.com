import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { useTableColumns } from '../useTableColumns'
import type { ColumnDef } from '../useTableColumns'

describe('useTableColumns', () => {
  const testColumns: ColumnDef[] = [
    { key: 'name', label: 'Name', default: true },
    { key: 'email', label: 'Email', default: true },
    { key: 'phone', label: 'Phone', default: false },
    { key: 'notes', label: 'Notes', default: false },
  ]

  it('should return only default columns initially', () => {
    const { visibleColumns } = useTableColumns('test-default', testColumns)
    const keys = visibleColumns.value.map(c => c.key)
    expect(keys).toContain('name')
    expect(keys).toContain('email')
    expect(keys).not.toContain('phone')
    expect(keys).not.toContain('notes')
  })

  it('should toggle a column on and off', () => {
    const { visibleColumns, toggleColumn, isVisible } = useTableColumns('test-toggle', testColumns)

    expect(isVisible('phone')).toBe(false)

    toggleColumn('phone')
    expect(isVisible('phone')).toBe(true)
    expect(visibleColumns.value.map(c => c.key)).toContain('phone')

    toggleColumn('phone')
    expect(isVisible('phone')).toBe(false)
    expect(visibleColumns.value.map(c => c.key)).not.toContain('phone')
  })

  it('should reset to defaults', () => {
    const { visibleColumns, toggleColumn, resetToDefaults } = useTableColumns('test-reset', testColumns)

    toggleColumn('phone')
    toggleColumn('notes')
    expect(visibleColumns.value.length).toBe(5)

    resetToDefaults()
    const keys = visibleColumns.value.map(c => c.key)
    expect(keys).toEqual(['name', 'email', '_actions'])
  })


  it('should respect visibleKeys order in visibleColumns', () => {
    const { visibleColumns, toggleColumn } = useTableColumns('test-order', testColumns)

    expect(visibleColumns.value.map(c => c.key)).toEqual(['name', 'email', '_actions'])

    toggleColumn('phone')
    expect(visibleColumns.value.map(c => c.key)).toEqual(['name', 'email', '_actions', 'phone'])
  })

  it('should append newly toggled columns at the end', () => {
    const { visibleColumns, toggleColumn } = useTableColumns('test-append', testColumns)

    toggleColumn('notes')
    toggleColumn('phone')

    const keys = visibleColumns.value.map(c => c.key)
    expect(keys).toEqual(['name', 'email', '_actions', 'notes', 'phone'])
  })

  it('should reorder columns via reorderColumns', () => {
    const { visibleColumns, reorderColumns } = useTableColumns('test-reorder', testColumns)

    expect(visibleColumns.value.map(c => c.key)).toEqual(['name', 'email', '_actions'])

    reorderColumns(['email', 'name'])
    expect(visibleColumns.value.map(c => c.key)).toEqual(['email', 'name', '_actions'])
  })

  it('should ignore non-visible keys in reorderColumns', () => {
    const { visibleColumns, reorderColumns } = useTableColumns('test-reorder-filter', testColumns)

    reorderColumns(['email', 'phone', 'name'])
    expect(visibleColumns.value.map(c => c.key)).toEqual(['email', 'name', '_actions'])
  })

  it('should persist reorder to localStorage', async () => {
    const storageKey = 'test-reorder-persist'
    const { reorderColumns } = useTableColumns(storageKey, testColumns)

    reorderColumns(['email', 'name'])
    await nextTick()

    const saved = JSON.parse(localStorage.getItem(`columns:${storageKey}`) || '[]')
    expect(saved).toEqual(['email', 'name', '_actions'])
  })

  it('should restore original order on reset after reorder', () => {
    const { visibleColumns, reorderColumns, resetToDefaults } = useTableColumns('test-reorder-reset', testColumns)

    reorderColumns(['email', 'name'])
    expect(visibleColumns.value.map(c => c.key)).toEqual(['email', 'name', '_actions'])

    resetToDefaults()
    expect(visibleColumns.value.map(c => c.key)).toEqual(['name', 'email', '_actions'])
  })
})
