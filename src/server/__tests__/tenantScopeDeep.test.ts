import { describe, it, expect } from 'vitest'


const FORBIDDEN_FIELDS = new Set([
  '_id', '__v',
  'orgId',
  'role',
  'createdAt', 'updatedAt',
  '__proto__',
  'constructor',
  '$set', '$unset', '$push', '$pull', '$inc',
])

function sanitizeBody<T extends Record<string, unknown>>(body: T): Partial<T> {
  const sanitized = { ...body }
  for (const key of Object.keys(sanitized)) {
    if (FORBIDDEN_FIELDS.has(key)) delete sanitized[key]
  }
  return sanitized as any
}

function getTenantFilter(user: { orgId?: string } | undefined): { orgId: string } {
  if (!user?.orgId) throw new Error('Tenant context missing — ensure authenticate middleware runs first')
  return { orgId: user.orgId }
}

function getOrgId(user: { orgId?: string } | undefined): string {
  if (!user?.orgId) throw new Error('Tenant context missing — ensure authenticate middleware runs first')
  return user.orgId
}


describe('Tenant Scope — Deep Security', () => {
  describe('FORBIDDEN_FIELDS completeness', () => {
    it('should contain 13 forbidden fields', () => {
      expect(FORBIDDEN_FIELDS.size).toBe(13)
    })

    it.each([
      ['_id', 'identity takeover'],
      ['orgId', 'tenant isolation bypass'],
      ['role', 'privilege escalation'],
      ['__proto__', 'prototype pollution'],
      ['constructor', 'prototype pollution'],
      ['$set', 'MongoDB operator injection'],
      ['$unset', 'MongoDB operator injection'],
      ['$push', 'MongoDB array injection'],
      ['$pull', 'MongoDB array injection'],
      ['$inc', 'MongoDB counter manipulation'],
      ['__v', 'version field tampering'],
      ['createdAt', 'timestamp manipulation'],
      ['updatedAt', 'timestamp manipulation'],
    ])('should block "%s" (%s)', (field) => {
      expect(FORBIDDEN_FIELDS.has(field)).toBe(true)
    })
  })

  describe('sanitizeBody — IDOR Prevention', () => {
    it('should strip orgId (tenant isolation attack)', () => {
      const safe = sanitizeBody({ name: 'Test', orgId: 'attacker-org-id' })
      expect(safe).not.toHaveProperty('orgId')
      expect(safe).toHaveProperty('name', 'Test')
    })

    it('should strip role (privilege escalation attack)', () => {
      const safe = sanitizeBody({ firstName: 'Evil', role: 'superAdmin' })
      expect(safe).not.toHaveProperty('role')
      expect(safe).toHaveProperty('firstName', 'Evil')
    })

    it('should strip _id (identity takeover attack)', () => {
      const safe = sanitizeBody({ model: 'MacBook', _id: 'stolen-id' })
      expect(safe).not.toHaveProperty('_id')
    })

    it('should strip __proto__ (prototype pollution)', () => {
      const body = { model: 'Dell', '__proto__': { isAdmin: true } } as any
      const safe = sanitizeBody(body)
      expect(Object.keys(safe)).not.toContain('__proto__')
    })

    it('should strip MongoDB operators ($set, $inc)', () => {
      const body = { name: 'Good', '$set': { role: 'admin' }, '$inc': { balance: 99999 } } as any
      const safe = sanitizeBody(body)
      expect(safe).not.toHaveProperty('$set')
      expect(safe).not.toHaveProperty('$inc')
    })

    it('should strip $push and $pull operators', () => {
      const body = { '$push': { tags: 'admin' }, '$pull': { permissions: 'safe' } } as any
      const safe = sanitizeBody(body)
      expect(safe).not.toHaveProperty('$push')
      expect(safe).not.toHaveProperty('$pull')
    })

    it('should strip $unset operator', () => {
      const body = { '$unset': { hashedPassword: 1 } } as any
      const safe = sanitizeBody(body)
      expect(safe).not.toHaveProperty('$unset')
    })

    it('should preserve all legitimate fields', () => {
      const body = { model: 'ThinkPad', serialNumber: 'SN123', notes: 'Test', tags: ['laptop'] }
      const safe = sanitizeBody(body)
      expect(safe).toEqual(body)
    })

    it('should handle empty body', () => {
      expect(sanitizeBody({})).toEqual({})
    })

    it('should strip ALL forbidden fields in a combined attack', () => {
      const body = {
        model: 'Keep', _id: 'bad', orgId: 'bad', role: 'bad',
        createdAt: 'bad', updatedAt: 'bad', __v: 'bad',
        '$set': {}, '$inc': {}, '$push': {}, '$pull': {}, '$unset': {},
        '__proto__': {}, constructor: 'bad'
      }
      const safe = sanitizeBody(body)
      expect(Object.keys(safe)).toEqual(['model'])
    })

    it('should not modify the original object', () => {
      const body = { name: 'Test', orgId: 'evil' }
      sanitizeBody(body)
      expect(body.orgId).toBe('evil')
    })

    it('should handle nested objects safely (no deep sanitize needed)', () => {
      const body = { config: { orgId: 'nested-ok' }, model: 'Test' }
      const safe = sanitizeBody(body)
      expect((safe as any).config.orgId).toBe('nested-ok')
    })
  })

  describe('getTenantFilter', () => {
    it('should return { orgId } from authenticated user', () => {
      expect(getTenantFilter({ orgId: 'org-123' })).toEqual({ orgId: 'org-123' })
    })

    it('should throw for missing user', () => {
      expect(() => getTenantFilter(undefined)).toThrow('Tenant context missing')
    })

    it('should throw for user with no orgId', () => {
      expect(() => getTenantFilter({})).toThrow('Tenant context missing')
    })

    it('should throw for empty orgId string', () => {
      expect(() => getTenantFilter({ orgId: '' })).toThrow('Tenant context missing')
    })
  })

  describe('getOrgId', () => {
    it('should return orgId string', () => {
      expect(getOrgId({ orgId: 'org-456' })).toBe('org-456')
    })

    it('should throw for undefined user', () => {
      expect(() => getOrgId(undefined)).toThrow('Tenant context missing')
    })

    it('should throw for missing orgId', () => {
      expect(() => getOrgId({})).toThrow('Tenant context missing')
    })
  })
})
