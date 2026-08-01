import { describe, it, expect } from 'vitest'


const LICENSE_TYPES = ['perpetual', 'subscription', 'oem', 'volume', 'freeware', 'open-source'] as const
const BILLING_CYCLES = ['monthly', 'annual', 'one-time', 'other'] as const

function availableSeats(totalSeats: number, checkedOutCount: number): number {
  if (totalSeats === -1) return Infinity
  return totalSeats - checkedOutCount
}

function isExpired(expirationDate: Date | null | undefined): boolean {
  if (!expirationDate) return false
  return new Date(expirationDate) < new Date()
}

function isUnlimited(totalSeats: number): boolean {
  return totalSeats === -1
}

function seatUtilizationPercent(totalSeats: number, checkedOut: number): number {
  if (totalSeats === -1) return 0
  if (totalSeats === 0) return 0
  return Math.round((checkedOut / totalSeats) * 100)
}

function totalCost(costPerSeat: number, totalSeats: number): number {
  if (totalSeats === -1) return costPerSeat
  return costPerSeat * totalSeats
}


describe('SoftwareLicense Model — Seat Management & Types', () => {
  describe('License Type Enum', () => {
    it('should have 6 license types', () => {
      expect(LICENSE_TYPES).toHaveLength(6)
    })

    it.each([
      'perpetual', 'subscription', 'oem', 'volume', 'freeware', 'open-source',
    ])('"%s" should be valid', (type) => {
      expect(LICENSE_TYPES).toContain(type)
    })
  })

  describe('Billing Cycle Enum', () => {
    it('should have 4 billing cycles', () => {
      expect(BILLING_CYCLES).toHaveLength(4)
    })

    it.each(['monthly', 'annual', 'one-time', 'other'] as const)(
      '"%s" should be valid', (cycle) => {
        expect(BILLING_CYCLES).toContain(cycle)
      }
    )
  })

  describe('Available Seats Calculation', () => {
    it('10 total, 3 checked out → 7 available', () => {
      expect(availableSeats(10, 3)).toBe(7)
    })

    it('5 total, 5 checked out → 0 available', () => {
      expect(availableSeats(5, 5)).toBe(0)
    })

    it('unlimited (-1) → Infinity', () => {
      expect(availableSeats(-1, 100)).toBe(Infinity)
    })

    it('1 seat license, 0 checked out → 1 available', () => {
      expect(availableSeats(1, 0)).toBe(1)
    })
  })

  describe('Unlimited Seats Detection', () => {
    it('-1 → unlimited', () => {
      expect(isUnlimited(-1)).toBe(true)
    })

    it('10 → not unlimited', () => {
      expect(isUnlimited(10)).toBe(false)
    })

    it('0 → not unlimited', () => {
      expect(isUnlimited(0)).toBe(false)
    })
  })

  describe('Expiration Check', () => {
    it('past date → expired', () => {
      expect(isExpired(new Date('2020-01-01'))).toBe(true)
    })

    it('future date → not expired', () => {
      expect(isExpired(new Date('2099-12-31'))).toBe(false)
    })

    it('null → not expired', () => {
      expect(isExpired(null)).toBe(false)
    })
  })

  describe('Seat Utilization Percent', () => {
    it('5/10 → 50%', () => {
      expect(seatUtilizationPercent(10, 5)).toBe(50)
    })

    it('10/10 → 100%', () => {
      expect(seatUtilizationPercent(10, 10)).toBe(100)
    })

    it('0/10 → 0%', () => {
      expect(seatUtilizationPercent(10, 0)).toBe(0)
    })

    it('unlimited → 0%', () => {
      expect(seatUtilizationPercent(-1, 50)).toBe(0)
    })
  })

  describe('Total Cost Calculation', () => {
    it('€12/seat × 10 seats = €120', () => {
      expect(totalCost(12, 10)).toBe(120)
    })

    it('unlimited license → cost = costPerSeat (site license)', () => {
      expect(totalCost(999, -1)).toBe(999)
    })

    it('free license → €0', () => {
      expect(totalCost(0, 50)).toBe(0)
    })
  })
})
