import { ref, computed, type Ref } from 'vue'

export function usePagination<T>(items: Ref<T[]>, defaultPageSize = 25) {
  const page = ref(1)
  const pageSize = ref(defaultPageSize)

  const totalItems = computed(() => items.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

  const paginatedItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return items.value.slice(start, start + pageSize.value)
  })

  function goToPage(p: number) {
    page.value = Math.max(1, Math.min(p, totalPages.value))
  }

  function nextPage() {
    if (page.value < totalPages.value) page.value++
  }

  function prevPage() {
    if (page.value > 1) page.value--
  }

  function resetPage() {
    page.value = 1
  }

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    resetPage
  }
}
