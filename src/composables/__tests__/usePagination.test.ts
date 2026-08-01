import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePagination } from '../usePagination'

describe('usePagination', () => {
  const createItems = (count: number) => ref(Array.from({ length: count }, (_, i) => ({ id: i + 1 })))

  it('should return first page of items', () => {
    const items = createItems(50)
    const { paginatedItems, page, totalPages } = usePagination(items, 10)

    expect(page.value).toBe(1)
    expect(totalPages.value).toBe(5)
    expect(paginatedItems.value.length).toBe(10)
    expect(paginatedItems.value[0].id).toBe(1)
    expect(paginatedItems.value[9].id).toBe(10)
  })

  it('should navigate to next page', () => {
    const items = createItems(30)
    const { paginatedItems, nextPage } = usePagination(items, 10)

    nextPage()
    expect(paginatedItems.value[0].id).toBe(11)
    expect(paginatedItems.value.length).toBe(10)
  })

  it('should handle last page with fewer items', () => {
    const items = createItems(25)
    const { paginatedItems, goToPage, totalPages } = usePagination(items, 10)

    expect(totalPages.value).toBe(3)
    goToPage(3)
    expect(paginatedItems.value.length).toBe(5)
    expect(paginatedItems.value[0].id).toBe(21)
  })

  it('should not go below page 1', () => {
    const items = createItems(20)
    const { page, prevPage } = usePagination(items, 10)

    prevPage()
    expect(page.value).toBe(1)
  })

  it('should not go above total pages', () => {
    const items = createItems(20)
    const { page, nextPage, totalPages } = usePagination(items, 10)

    nextPage()
    nextPage()
    expect(page.value).toBe(totalPages.value)
  })

  it('should reset to page 1', () => {
    const items = createItems(50)
    const { page, goToPage, resetPage } = usePagination(items, 10)

    goToPage(5)
    expect(page.value).toBe(5)

    resetPage()
    expect(page.value).toBe(1)
  })

  it('should handle empty items', () => {
    const items = ref<{ id: number }[]>([])
    const { paginatedItems, totalPages, totalItems } = usePagination(items, 10)

    expect(totalItems.value).toBe(0)
    expect(totalPages.value).toBe(1)
    expect(paginatedItems.value.length).toBe(0)
  })
})
