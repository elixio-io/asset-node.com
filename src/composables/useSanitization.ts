export function useSanitization() {
  function getRelatedName(fieldValue: any, nameKey: string = 'name'): string {
    if (!fieldValue) return '—'
    if (typeof fieldValue === 'string') {
      if (/^[0-9a-fA-F]{24}$/.test(fieldValue)) return 'Unbekannt / Gelöscht'
      return fieldValue
    }
    return fieldValue[nameKey] || '—'
  }

  function getEmployeeName(emp: any): string {
    if (!emp) return '—'
    if (typeof emp === 'string') {
      if (/^[0-9a-fA-F]{24}$/.test(emp)) return 'Unbekannt / Gelöscht'
      return emp
    }
    return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—'
  }

  return {
    getRelatedName,
    getEmployeeName
  }
}
