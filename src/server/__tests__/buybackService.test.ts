import { describe, it, expect } from 'vitest'
import { estimateDeviceValue } from '../../server/services/buybackService'

function yearsAgo(n: number): number {
  return Date.now() - (n * 365.25 * 24 * 60 * 60 * 1000)
}

describe('Buyback Service — Price Estimation', () => {
  describe('Basic depreciation', () => {
    it('brand new device in excellent condition retains most value', () => {
      const result = estimateDeviceValue({
        purchasePrice: 2000,
        purchaseDateMs: Date.now() - (30 * 24 * 60 * 60 * 1000),
        condition: 'excellent',
        category: 'Laptops'
      })

      expect(result.estimatedValue).toBeGreaterThan(1800)
      expect(result.depreciationPct).toBeLessThan(15)
      expect(result.confidenceLevel).toBe('high')
    })

    it('2-year-old laptop in good condition', () => {
      const result = estimateDeviceValue({
        purchasePrice: 2000,
        purchaseDateMs: yearsAgo(2),
        condition: 'good',
        category: 'Laptops'
      })

      expect(result.estimatedValue).toBeGreaterThan(700)
      expect(result.estimatedValue).toBeLessThan(1000)
      expect(result.confidenceLevel).toBe('high')
    })

    it('3-year-old phone in fair condition', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1200,
        purchaseDateMs: yearsAgo(3),
        condition: 'fair',
        category: 'Mobilgeräte'
      })

      expect(result.estimatedValue).toBeGreaterThan(100)
      expect(result.estimatedValue).toBeLessThan(250)
    })
  })

  describe('Category-specific retention', () => {
    const baseCfg = {
      purchasePrice: 1000,
      purchaseDateMs: yearsAgo(2),
      condition: 'good' as const
    }

    it('monitors retain more value than phones', () => {
      const monitor = estimateDeviceValue({ ...baseCfg, category: 'Monitore' })
      const phone = estimateDeviceValue({ ...baseCfg, category: 'Mobilgeräte' })

      expect(monitor.estimatedValue).toBeGreaterThan(phone.estimatedValue)
    })

    it('laptops retain more value than network gear', () => {
      const laptop = estimateDeviceValue({ ...baseCfg, category: 'Laptops' })
      const network = estimateDeviceValue({ ...baseCfg, category: 'Netzwerk' })

      expect(laptop.estimatedValue).toBeGreaterThan(network.estimatedValue)
    })

    it('printers have the lowest retention', () => {
      const printer = estimateDeviceValue({ ...baseCfg, category: 'Drucker' })
      const laptop = estimateDeviceValue({ ...baseCfg, category: 'Laptops' })

      expect(printer.estimatedValue).toBeLessThan(laptop.estimatedValue)
    })

    it('unknown category uses default retention', () => {
      const result = estimateDeviceValue({ ...baseCfg, category: 'SomethingElse' })

      expect(result.estimatedValue).toBeGreaterThan(200)
      expect(result.estimatedValue).toBeLessThan(300)
    })
  })

  describe('Condition impact', () => {
    const baseCfg = {
      purchasePrice: 1000,
      purchaseDateMs: yearsAgo(1),
      category: 'Laptops'
    }

    it('excellent > good > fair > poor', () => {
      const excellent = estimateDeviceValue({ ...baseCfg, condition: 'excellent' })
      const good = estimateDeviceValue({ ...baseCfg, condition: 'good' })
      const fair = estimateDeviceValue({ ...baseCfg, condition: 'fair' })
      const poor = estimateDeviceValue({ ...baseCfg, condition: 'poor' })

      expect(excellent.estimatedValue).toBeGreaterThan(good.estimatedValue)
      expect(good.estimatedValue).toBeGreaterThan(fair.estimatedValue)
      expect(fair.estimatedValue).toBeGreaterThan(poor.estimatedValue)
    })
  })

  describe('Minimum value floor', () => {
    it('very old device never goes below 5% of purchase price', () => {
      const result = estimateDeviceValue({
        purchasePrice: 2000,
        purchaseDateMs: yearsAgo(10),
        condition: 'poor',
        category: 'Drucker'
      })

      expect(result.estimatedValue).toBe(100)
    })

    it('zero-value device should return 0 floor', () => {
      const result = estimateDeviceValue({
        purchasePrice: 0,
        purchaseDateMs: yearsAgo(1),
        condition: 'good',
        category: 'Laptops'
      })

      expect(result.estimatedValue).toBe(0)
    })
  })

  describe('Confidence levels', () => {
    it('high confidence for recent device with good price data', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1500,
        purchaseDateMs: yearsAgo(1),
        condition: 'good',
        category: 'Laptops'
      })
      expect(result.confidenceLevel).toBe('high')
    })

    it('medium confidence for 4-year-old device', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1500,
        purchaseDateMs: yearsAgo(4),
        condition: 'good',
        category: 'Laptops'
      })
      expect(result.confidenceLevel).toBe('medium')
    })

    it('low confidence for 6+ year old device', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1500,
        purchaseDateMs: yearsAgo(6),
        condition: 'good',
        category: 'Laptops'
      })
      expect(result.confidenceLevel).toBe('low')
    })

    it('low confidence for very cheap device', () => {
      const result = estimateDeviceValue({
        purchasePrice: 30,
        purchaseDateMs: yearsAgo(1),
        condition: 'good',
        category: 'Laptops'
      })
      expect(result.confidenceLevel).toBe('low')
    })
  })

  describe('Output shape', () => {
    it('returns all expected fields', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1000,
        purchaseDateMs: yearsAgo(1),
        condition: 'good',
        category: 'Laptops'
      })

      expect(result).toHaveProperty('estimatedValue')
      expect(result).toHaveProperty('confidenceLevel')
      expect(result).toHaveProperty('depreciationPct')
      expect(result).toHaveProperty('ageYears')
      expect(typeof result.estimatedValue).toBe('number')
      expect(typeof result.depreciationPct).toBe('number')
      expect(typeof result.ageYears).toBe('number')
      expect(['high', 'medium', 'low']).toContain(result.confidenceLevel)
    })

    it('depreciationPct is between 0 and 100', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1000,
        purchaseDateMs: yearsAgo(2),
        condition: 'good',
        category: 'Laptops'
      })

      expect(result.depreciationPct).toBeGreaterThanOrEqual(0)
      expect(result.depreciationPct).toBeLessThanOrEqual(100)
    })

    it('ageYears is rounded to 1 decimal', () => {
      const result = estimateDeviceValue({
        purchasePrice: 1000,
        purchaseDateMs: yearsAgo(1.5),
        condition: 'good',
        category: 'Laptops'
      })

      const decimalPart = (result.ageYears * 10) % 1
      expect(decimalPart).toBeCloseTo(0, 1)
    })
  })
})
