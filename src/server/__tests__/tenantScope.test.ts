import { describe, it, expect } from 'vitest'
import { getTenantFilter, getOrgId, sanitizeBody } from '../../server/middleware/tenantScope'

describe('Tenant Scope', () => {
  describe('getTenantFilter', () => {
    it('should return { orgId } from authenticated request', () => {
      const req = { user: { orgId: 'org-abc', userId: 'u1', role: 'admin' } } as any
      expect(getTenantFilter(req)).toEqual({ orgId: 'org-abc' })
    })

    it('should throw when user is not set (unauthenticated)', () => {
      const req = { user: undefined } as any
      expect(() => getTenantFilter(req)).toThrow('Tenant context missing')
    })

    it('should throw when orgId is missing from JWT', () => {
      const req = { user: { userId: 'u1', role: 'admin' } } as any
      expect(() => getTenantFilter(req)).toThrow('Tenant context missing')
    })

    it('should throw when orgId is empty string', () => {
      const req = { user: { userId: 'u1', role: 'admin', orgId: '' } } as any
      expect(() => getTenantFilter(req)).toThrow('Tenant context missing')
    })
  })

  describe('getOrgId', () => {
    it('should return orgId string from authenticated request', () => {
      const req = { user: { orgId: 'org-xyz', userId: 'u1', role: 'admin' } } as any
      expect(getOrgId(req)).toBe('org-xyz')
    })

    it('should throw when user is missing', () => {
      const req = {} as any
      expect(() => getOrgId(req)).toThrow('Tenant context missing')
    })
  })

  describe('sanitizeBody — combined mass assignment tests', () => {
    it('should not alter legitimate hardware data', () => {
      const body = {
        model: 'MacBook Pro 16"',
        serialNumber: 'C02YD1234',
        purchasePrice: 2499.99,
        notes: 'Assigned to engineering',
        assetTag: 'HW-0042',
      }
      expect(sanitizeBody(body)).toEqual(body)
    })

    it('should strip orgId even when mixed with legitimate data', () => {
      const body = {
        model: 'ThinkPad X1',
        orgId: 'attacker-org-injection',
        serialNumber: 'TP-123',
      }
      const result = sanitizeBody(body)
      expect(result).not.toHaveProperty('orgId')
      expect(result.model).toBe('ThinkPad X1')
      expect((result as any).serialNumber).toBe('TP-123')
    })

    it('should handle request body with only dangerous fields', () => {
      const body = {
        _id: 'fake',
        orgId: 'fake',
        role: 'superAdmin',
        __v: 99,
        __proto__: { isAdmin: true },
        constructor: 'Object',
        $set: { anything: true },
      }
      const result = sanitizeBody(body as any)
      expect(Object.keys(result).length).toBe(0)
    })

    it('should preserve safe nested fields like orgId inside metadata', () => {
      const body = {
        model: 'Test',
        metadata: { orgId: 'should-stay', description: 'safe' },
      }
      const result = sanitizeBody(body)
      expect(result.model).toBe('Test')
      expect((result as any).metadata.orgId).toBe('should-stay')
    })
  })

  describe('sanitizeBody — DEEP nested sanitization', () => {
    it('strips $set from nested objects', () => {
      const body = {
        name: 'Test',
        customFields: { '$set': { orgId: 'attacker' }, color: 'blue' },
      }
      const result = sanitizeBody(body)
      expect((result as any).customFields).toEqual({ color: 'blue' })
    })

    it('strips $push from nested objects', () => {
      const body = {
        name: 'Test',
        tags: { normal: 'safe', '$push': { role: 'admin' } },
      }
      const result = sanitizeBody(body)
      expect((result as any).tags).toEqual({ normal: 'safe' })
    })

    it('strips $inc from deeply nested objects', () => {
      const body = {
        meta: { inner: { '$inc': { balance: 99999 }, note: 'ok' } },
      }
      const result = sanitizeBody(body)
      expect((result as any).meta.inner).toEqual({ note: 'ok' })
    })

    it('strips __proto__ from nested objects', () => {
      const body = {
        config: { '__proto__': { isAdmin: true }, theme: 'dark' },
      }
      const result = sanitizeBody(body as any)
      expect((result as any).config).toEqual({ theme: 'dark' })
    })

    it('strips constructor from nested objects', () => {
      const body = {
        settings: { constructor: 'Function', name: 'safe' },
      }
      const result = sanitizeBody(body)
      expect((result as any).settings).toEqual({ name: 'safe' })
    })

    it('strips MongoDB query operators ($where, $regex, $expr)', () => {
      const body = {
        filter: { '$where': 'this.role=="admin"', name: 'test' },
      }
      const result = sanitizeBody(body)
      expect((result as any).filter).toEqual({ name: 'test' })
    })

    it('strips operators from objects inside arrays', () => {
      const body = {
        items: [
          { name: 'safe', '$set': { orgId: 'bad' } },
          { name: 'also-safe' },
        ],
      }
      const result = sanitizeBody(body)
      expect((result as any).items).toEqual([
        { name: 'safe' },
        { name: 'also-safe' },
      ])
    })

    it('preserves primitive values in arrays', () => {
      const body = {
        tags: ['red', 'blue', 'green'],
        counts: [1, 2, 3],
      }
      const result = sanitizeBody(body)
      expect((result as any).tags).toEqual(['red', 'blue', 'green'])
      expect((result as any).counts).toEqual([1, 2, 3])
    })

    it('handles deeply nested structures (3+ levels)', () => {
      const body = {
        level1: {
          level2: {
            level3: {
              '$unset': { password: '' },
              safeField: 'value',
            },
          },
        },
      }
      const result = sanitizeBody(body)
      expect((result as any).level1.level2.level3).toEqual({ safeField: 'value' })
    })

    it('does not alter clean nested objects', () => {
      const body = {
        address: {
          street: '123 Main St',
          city: 'Berlin',
          country: 'DE',
        },
        customFields: {
          asset_label: 'floor-3',
          department_code: 'ENG',
        },
      }
      const result = sanitizeBody(body)
      expect(result).toEqual(body)
    })

    it('strips multiple operators at once from same object', () => {
      const body = {
        data: {
          '$set': { a: 1 },
          '$push': { b: 2 },
          '$inc': { c: 3 },
          safe: 'yes',
        },
      }
      const result = sanitizeBody(body)
      expect((result as any).data).toEqual({ safe: 'yes' })
    })
  })
})
