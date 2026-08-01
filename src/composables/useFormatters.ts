import { useI18n } from 'vue-i18n'

export function useFormatters() {
  const { locale } = useI18n()

  function fmtDate(val: string | Date | undefined | null): string {
    if (!val) return '—'
    const loc = locale.value === 'de' ? 'de-DE' : 'en-US'
    return new Date(val).toLocaleDateString(loc)
  }

  function fmtCurrency(val: number | undefined | null): string {
    if (val == null) return '—'
    const loc = locale.value === 'de' ? 'de-DE' : 'en-US'
    return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(val)
  }

  return { fmtDate, fmtCurrency }
}
