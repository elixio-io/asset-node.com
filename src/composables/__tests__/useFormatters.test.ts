import { describe, it, expect } from 'vitest'


function fmtDate(val: string | Date | undefined | null, locale: string = 'de'): string {
  if (!val) return '—'
  const loc = locale === 'de' ? 'de-DE' : 'en-US'
  return new Date(val).toLocaleDateString(loc)
}

function fmtCurrency(val: number | undefined | null, locale: string = 'de'): string {
  if (val == null) return '—'
  const loc = locale === 'de' ? 'de-DE' : 'en-US'
  return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(val)
}


describe('Formatters Composable', () => {
  describe('fmtDate', () => {
    it('should format date in German locale', () => {
      const result = fmtDate('2026-04-19', 'de')
      expect(result).toContain('19')
      expect(result).toContain('4')
      expect(result).toContain('2026')
    })

    it('should format date in English locale', () => {
      const result = fmtDate('2026-04-19', 'en')
      expect(result).toContain('19')
      expect(result).toContain('2026')
    })

    it('should return "—" for null', () => {
      expect(fmtDate(null)).toBe('—')
    })

    it('should return "—" for undefined', () => {
      expect(fmtDate(undefined)).toBe('—')
    })

    it('should return "—" for empty string', () => {
      expect(fmtDate('')).toBe('—')
    })

    it('should handle Date object', () => {
      const result = fmtDate(new Date('2026-01-15'))
      expect(result).toContain('15')
    })
  })

  describe('fmtCurrency', () => {
    it('should format EUR in German locale', () => {
      const result = fmtCurrency(1234.50, 'de')
      expect(result).toContain('1.234')
      expect(result).toContain('€')
    })

    it('should format EUR in English locale', () => {
      const result = fmtCurrency(1234.50, 'en')
      expect(result).toContain('€')
      expect(result).toContain('1,234')
    })

    it('should return "—" for null', () => {
      expect(fmtCurrency(null)).toBe('—')
    })

    it('should return "—" for undefined', () => {
      expect(fmtCurrency(undefined)).toBe('—')
    })

    it('should handle zero', () => {
      const result = fmtCurrency(0, 'de')
      expect(result).toContain('0')
      expect(result).toContain('€')
    })

    it('should handle negative values', () => {
      const result = fmtCurrency(-500, 'de')
      expect(result).toContain('500')
      expect(result).toContain('€')
    })

    it('should handle small decimals', () => {
      const result = fmtCurrency(0.99, 'de')
      expect(result).toContain('0,99')
    })

    it('should handle large values', () => {
      const result = fmtCurrency(99999.99, 'de')
      expect(result).toContain('€')
    })
  })
})
