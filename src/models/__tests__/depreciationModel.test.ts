import { describe, it, expect } from 'vitest'


const DEPRECIATION_METHODS = ['straightLine', 'decliningBalance'] as const

function straightLineMonthly(purchasePrice: number, salvageValue: number, usefulLifeMonths: number): number {
  if (usefulLifeMonths <= 0) return 0
  return (purchasePrice - salvageValue) / usefulLifeMonths
}

function straightLineBookValue(purchasePrice: number, salvageValue: number, usefulLifeMonths: number, monthsElapsed: number): number {
  const monthlyDep = straightLineMonthly(purchasePrice, salvageValue, usefulLifeMonths)
  const totalDep = Math.min(monthlyDep * monthsElapsed, purchasePrice - salvageValue)
  return Math.max(purchasePrice - totalDep, salvageValue)
}

function decliningBalanceBookValue(purchasePrice: number, depreciationRate: number, yearsElapsed: number, salvageValue: number = 0): number {
  let value = purchasePrice
  for (let y = 0; y < yearsElapsed; y++) {
    value = value * (1 - depreciationRate / 100)
  }
  return Math.max(value, salvageValue)
}

function accumulatedDepreciation(purchasePrice: number, currentBookValue: number): number {
  return purchasePrice - currentBookValue
}

function depreciationPercent(purchasePrice: number, accumulatedDep: number): number {
  if (purchasePrice === 0) return 0
  return (accumulatedDep / purchasePrice) * 100
}


describe('Depreciation Model — Financial Calculations', () => {
  describe('Method Enum', () => {
    it('should support 2 methods', () => {
      expect(DEPRECIATION_METHODS).toHaveLength(2)
    })

    it.each(['straightLine', 'decliningBalance'] as const)(
      '"%s" should be valid', (method) => {
        expect(DEPRECIATION_METHODS).toContain(method)
      }
    )
  })

  describe('Straight-Line Depreciation', () => {
    const purchase = 2400
    const salvage = 200
    const lifeMonths = 36

    it('monthly depreciation = (2400 - 200) / 36 = €61.11', () => {
      const monthly = straightLineMonthly(purchase, salvage, lifeMonths)
      expect(monthly).toBeCloseTo(61.11, 1)
    })

    it('book value at month 0 = purchase price', () => {
      expect(straightLineBookValue(purchase, salvage, lifeMonths, 0)).toBe(purchase)
    })

    it('book value at month 12 = €2,400 - 12×61.11 ≈ €1,666.67', () => {
      const bv = straightLineBookValue(purchase, salvage, lifeMonths, 12)
      expect(bv).toBeCloseTo(1666.67, 0)
    })

    it('book value at end of life = salvage value', () => {
      expect(straightLineBookValue(purchase, salvage, lifeMonths, 36)).toBe(salvage)
    })

    it('book value should never go below salvage', () => {
      expect(straightLineBookValue(purchase, salvage, lifeMonths, 100)).toBe(salvage)
    })

    it('zero useful life → zero monthly depreciation', () => {
      expect(straightLineMonthly(1000, 100, 0)).toBe(0)
    })

    it('zero salvage → full depreciation', () => {
      const monthly = straightLineMonthly(1200, 0, 12)
      expect(monthly).toBe(100)
    })
  })

  describe('Declining Balance Depreciation', () => {
    const purchase = 5000
    const rate = 20
    const salvage = 500

    it('year 0 → book value = purchase price', () => {
      expect(decliningBalanceBookValue(purchase, rate, 0)).toBe(5000)
    })

    it('year 1 → 5000 × 0.8 = 4000', () => {
      expect(decliningBalanceBookValue(purchase, rate, 1)).toBe(4000)
    })

    it('year 2 → 4000 × 0.8 = 3200', () => {
      expect(decliningBalanceBookValue(purchase, rate, 2)).toBe(3200)
    })

    it('year 3 → 3200 × 0.8 = 2560', () => {
      expect(decliningBalanceBookValue(purchase, rate, 3)).toBe(2560)
    })

    it('year 5 → 5000 × 0.8^5 = 1638.40', () => {
      expect(decliningBalanceBookValue(purchase, rate, 5)).toBeCloseTo(1638.40, 1)
    })

    it('should never go below salvage value', () => {
      const bv = decliningBalanceBookValue(purchase, rate, 50, salvage)
      expect(bv).toBeGreaterThanOrEqual(salvage)
    })

    it('0% rate → no depreciation', () => {
      expect(decliningBalanceBookValue(purchase, 0, 10)).toBe(purchase)
    })

    it('100% rate → instant depreciation to zero/salvage', () => {
      expect(decliningBalanceBookValue(purchase, 100, 1, salvage)).toBe(salvage)
    })
  })

  describe('Accumulated Depreciation', () => {
    it('should equal purchase minus book value', () => {
      expect(accumulatedDepreciation(2400, 1600)).toBe(800)
    })

    it('should be zero when book value equals purchase', () => {
      expect(accumulatedDepreciation(2400, 2400)).toBe(0)
    })
  })

  describe('Depreciation Percentage', () => {
    it('50% depreciation', () => {
      expect(depreciationPercent(2000, 1000)).toBe(50)
    })

    it('100% depreciation', () => {
      expect(depreciationPercent(2000, 2000)).toBe(100)
    })

    it('0% depreciation', () => {
      expect(depreciationPercent(2000, 0)).toBe(0)
    })

    it('zero purchase price → 0%', () => {
      expect(depreciationPercent(0, 0)).toBe(0)
    })
  })
})
