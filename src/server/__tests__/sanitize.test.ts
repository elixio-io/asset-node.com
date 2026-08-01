import { describe, it, expect } from 'vitest'
import { sanitizeValue, sanitizeObject } from '../../server/middleware/sanitize'

describe('Sanitize Middleware', () => {
  describe('sanitizeValue', () => {
    it('should strip HTML tags from strings', () => {
      expect(sanitizeValue('<script>alert("xss")</script>dangerous')).toBe('alert("xss")dangerous')
    })

    it('should strip nested/self-closing HTML tags', () => {
      expect(sanitizeValue('Hello <b>world</b>')).toBe('Hello world')
      expect(sanitizeValue('<img src=x onerror=alert(1)>')).toBe('')
      expect(sanitizeValue('<div class="test">content</div>')).toBe('content')
    })

    it('should trim whitespace from strings', () => {
      expect(sanitizeValue('  hello world  ')).toBe('hello world')
    })

    it('should handle empty string', () => {
      expect(sanitizeValue('')).toBe('')
    })

    it('should pass through numbers unchanged', () => {
      expect(sanitizeValue(42)).toBe(42)
      expect(sanitizeValue(0)).toBe(0)
      expect(sanitizeValue(-1)).toBe(-1)
      expect(sanitizeValue(3.14)).toBe(3.14)
    })

    it('should pass through booleans unchanged', () => {
      expect(sanitizeValue(true)).toBe(true)
      expect(sanitizeValue(false)).toBe(false)
    })

    it('should pass through null unchanged', () => {
      expect(sanitizeValue(null)).toBe(null)
    })

    it('should pass through undefined unchanged', () => {
      expect(sanitizeValue(undefined)).toBe(undefined)
    })

    it('should sanitize arrays recursively', () => {
      const result = sanitizeValue(['<b>bold</b>', 'clean', 42])
      expect(result).toEqual(['bold', 'clean', 42])
    })

    it('should sanitize nested objects', () => {
      const result = sanitizeValue({ name: '<script>xss</script>John' })
      expect(result).toEqual({ name: 'xssJohn' })
    })
  })

  describe('sanitizeObject', () => {
    it('should strip keys starting with $ (NoSQL injection)', () => {
      const malicious = {
        name: 'John',
        $set: { role: 'admin' },
        $gt: { age: 0 },
        $ne: 'test',
      }
      const result = sanitizeObject(malicious)
      expect(result).toEqual({ name: 'John' })
      expect(result).not.toHaveProperty('$set')
      expect(result).not.toHaveProperty('$gt')
      expect(result).not.toHaveProperty('$ne')
    })

    it('should sanitize string values while keeping structure', () => {
      const result = sanitizeObject({
        name: '  <b>Test</b>  ',
        count: 5,
        active: true,
      })
      expect(result).toEqual({
        name: 'Test',
        count: 5,
        active: true,
      })
    })

    it('should handle deeply nested objects', () => {
      const result = sanitizeObject({
        level1: {
          level2: {
            $evil: 'attack',
            safe: '<div>text</div>',
          },
        },
      })
      const nested = (result.level1 as any).level2
      expect(nested).not.toHaveProperty('$evil')
      expect(nested.safe).toBe('text')
    })

    it('should handle mixed arrays in objects', () => {
      const result = sanitizeObject({
        tags: ['<b>tag1</b>', 'tag2', '<script>bad</script>'],
      })
      expect(result.tags).toEqual(['tag1', 'tag2', 'bad'])
    })

    it('should handle empty objects', () => {
      expect(sanitizeObject({})).toEqual({})
    })

    it('should block MongoDB regex injection via $regex', () => {
      const result = sanitizeObject({
        email: { $regex: '.*' },
      })
      expect(result).not.toHaveProperty('$regex')
    })

    it('should block MongoDB $where injection', () => {
      const result = sanitizeObject({
        name: 'test',
        $where: 'function() { return true }',
      })
      expect(result).not.toHaveProperty('$where')
      expect(result.name).toBe('test')
    })
  })
})
