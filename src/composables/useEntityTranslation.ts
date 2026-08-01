import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NamedRef } from '../types/hardware'

export function useEntityTranslation(i18nPrefix: string) {
  const { t } = useI18n()

  function translateName(entity: { name: string; slug?: string } | null | undefined): string {
    if (!entity) return '—'
    if (entity.slug) {
      const key = `${i18nPrefix}.${entity.slug}`
      const translated = t(key)
      if (translated !== key) return translated
    }
    return entity.name
  }

  function translateSlug(slug: string): string {
    const key = `${i18nPrefix}.${slug}`
    const translated = t(key)
    return translated !== key ? translated : slug
  }

  function translatedList(items: Ref<NamedRef[]>) {
    return computed(() =>
      items.value.map(item => ({ ...item, name: translateName(item) }))
    )
  }

  return { translateName, translateSlug, translatedList }
}


export function useCategoryTranslation() {
  const { translateName, translateSlug, translatedList } = useEntityTranslation('hardware.categoryLabels')
  return {
    translateCategoryName: translateName,
    translateCategorySlug: translateSlug,
    translatedCategories: translatedList,
  }
}

export function useDepartmentTranslation() {
  const { translateName, translateSlug, translatedList } = useEntityTranslation('departmentLabels')
  return {
    translateDepartmentName: translateName,
    translateDepartmentSlug: translateSlug,
    translatedDepartments: translatedList,
  }
}

const STATUS_TYPE_SEVERITY: Record<string, string> = {
  deployable: 'success',
  deployed: 'info',
  undeployable: 'danger',
  pending: 'warn',
  archived: 'secondary',
}

export function useStatusTranslation() {
  const { translateName, translateSlug, translatedList } = useEntityTranslation('statusLabels')

  function getStatusSeverity(status: { type?: string } | null | undefined): string {
    if (!status?.type) return 'secondary'
    return STATUS_TYPE_SEVERITY[status.type] || 'secondary'
  }

  return {
    translateStatusName: translateName,
    translateStatusSlug: translateSlug,
    translatedStatuses: translatedList,
    getStatusSeverity,
  }
}
