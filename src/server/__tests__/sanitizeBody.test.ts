import { describe, it, expect } from 'vitest'
import { sanitizeBody } from '../../server/middleware/tenantScope'

describe('sanitizeBody', () => {
  it('should pass through normal fields unchanged', () => {
    const input = { model: 'MacBook Pro', serialNumber: 'SN123', notes: 'test' }
    const result = sanitizeBody(input)
    expect(result).toEqual(input)
  })

  it('should strip _id from input', () => {
    const result = sanitizeBody({ model: 'Test', _id: 'injected-id' })
    expect(result).not.toHaveProperty('_id')
    expect(result.model).toBe('Test')
  })

  it('should strip orgId to prevent tenant isolation bypass', () => {
    const result = sanitizeBody({ model: 'Test', orgId: 'attacker-org-id' })
    expect(result).not.toHaveProperty('orgId')
  })

  it('should strip role to prevent privilege escalation', () => {
    const result = sanitizeBody({ firstName: 'John', role: 'superadmin' })
    expect(result).not.toHaveProperty('role')
    expect(result.firstName).toBe('John')
  })

  it('should strip __proto__ to prevent prototype pollution', () => {
    const result = sanitizeBody({ model: 'Test', __proto__: { isAdmin: true } } as any)
    expect(result).not.toHaveProperty('__proto__')
  })

  it('should strip MongoDB operator injection ($set, $unset, etc.)', () => {
    const result = sanitizeBody({
      model: 'Test',
      $set: { role: 'admin' },
      $unset: { orgId: '' },
      $push: { tags: 'malicious' },
      $pull: { tags: 'legit' },
      $inc: { credits: 9999 },
    } as any)

    expect(result).not.toHaveProperty('$set')
    expect(result).not.toHaveProperty('$unset')
    expect(result).not.toHaveProperty('$push')
    expect(result).not.toHaveProperty('$pull')
    expect(result).not.toHaveProperty('$inc')
    expect(result.model).toBe('Test')
  })

  it('should strip timestamp fields', () => {
    const result = sanitizeBody({ model: 'Test', createdAt: '2020-01-01', updatedAt: '2020-01-01', __v: 5 })
    expect(result).not.toHaveProperty('createdAt')
    expect(result).not.toHaveProperty('updatedAt')
    expect(result).not.toHaveProperty('__v')
  })

  it('should strip constructor field', () => {
    const result = sanitizeBody({ model: 'Test', constructor: 'malicious' } as any)
    expect(result).not.toHaveProperty('constructor')
  })

  it('should handle empty input', () => {
    const result = sanitizeBody({})
    expect(result).toEqual({})
  })

  it('should handle input with ONLY forbidden fields', () => {
    const result = sanitizeBody({ _id: 'x', orgId: 'y', role: 'z' })
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should strip multiple forbidden fields in one pass', () => {
    const result = sanitizeBody({
      model: 'Legit',
      categoryId: 'cat1',
      _id: 'injected',
      orgId: 'attacker-org',
      role: 'superadmin',
      __v: 99,
      createdAt: 'fake',
      $set: { admin: true },
    })
    expect(result).toEqual({ model: 'Legit', categoryId: 'cat1' })
  })
})
