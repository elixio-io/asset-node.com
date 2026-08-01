import { describe, it, expect } from 'vitest'


function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim()
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>)
  }
  return value
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue
    sanitized[key] = sanitizeValue(val)
  }
  return sanitized
}


describe('Sanitize Middleware — XSS & NoSQL Prevention', () => {
  describe('XSS — HTML Tag Stripping', () => {
    it('should strip simple HTML tags', () => {
      expect(sanitizeValue('<script>alert("xss")</script>')).toBe('alert("xss")')
    })

    it('should strip tags with attributes', () => {
      expect(sanitizeValue('<img src=x onerror=alert(1)>')).toBe('')
    })

    it('should strip nested tags', () => {
      expect(sanitizeValue('<div><span>text</span></div>')).toBe('text')
    })

    it('should preserve plain text', () => {
      expect(sanitizeValue('Hello World')).toBe('Hello World')
    })

    it('should strip style tags', () => {
      expect(sanitizeValue('<style>body{display:none}</style>')).toBe('body{display:none}')
    })

    it('should handle self-closing tags', () => {
      expect(sanitizeValue('before<br/>after')).toBe('beforeafter')
    })

    it('should strip iframe tags', () => {
      expect(sanitizeValue('<iframe src="evil.com"></iframe>')).toBe('')
    })
  })

  describe('Whitespace Trimming', () => {
    it('should trim leading whitespace', () => {
      expect(sanitizeValue('   hello')).toBe('hello')
    })

    it('should trim trailing whitespace', () => {
      expect(sanitizeValue('hello   ')).toBe('hello')
    })

    it('should trim both', () => {
      expect(sanitizeValue('  hello  ')).toBe('hello')
    })
  })

  describe('NoSQL Injection — $ Key Blocking', () => {
    it('should remove $gt operator', () => {
      const result = sanitizeObject({ password: { $gt: '' } } as any)
      expect(result.password).toEqual({})
    })

    it('should remove $ne operator', () => {
      const result = sanitizeObject({ $ne: null, name: 'test' } as any)
      expect(result).not.toHaveProperty('$ne')
      expect(result.name).toBe('test')
    })

    it('should remove $or operator', () => {
      const result = sanitizeObject({ $or: [{}, {}], status: 'active' })
      expect(result).not.toHaveProperty('$or')
      expect(result.status).toBe('active')
    })

    it('should remove $where operator', () => {
      const result = sanitizeObject({ $where: 'true', name: 'safe' })
      expect(result).not.toHaveProperty('$where')
    })

    it('should remove deeply nested $ keys', () => {
      const result = sanitizeObject({
        filter: { email: { $regex: '.*' } }
      } as any)
      expect((result.filter as any).email).toEqual({})
    })
  })

  describe('Recursive Object Sanitization', () => {
    it('should sanitize nested objects', () => {
      const result = sanitizeObject({
        user: { name: '<b>Bold</b>', role: 'admin' }
      })
      expect((result.user as any).name).toBe('Bold')
      expect((result.user as any).role).toBe('admin')
    })

    it('should sanitize arrays of strings', () => {
      const result = sanitizeValue(['<script>1</script>', 'safe'])
      expect(result).toEqual(['1', 'safe'])
    })

    it('should sanitize arrays of objects', () => {
      const result = sanitizeValue([
        { name: '<img src=x>', $evil: true },
        { name: 'safe' }
      ])
      expect(result).toEqual([
        { name: '' },
        { name: 'safe' }
      ])
    })
  })

  describe('Type Preservation', () => {
    it('should preserve numbers', () => {
      expect(sanitizeValue(42)).toBe(42)
    })

    it('should preserve booleans', () => {
      expect(sanitizeValue(true)).toBe(true)
      expect(sanitizeValue(false)).toBe(false)
    })

    it('should preserve null', () => {
      expect(sanitizeValue(null)).toBeNull()
    })

    it('should preserve undefined', () => {
      expect(sanitizeValue(undefined)).toBeUndefined()
    })
  })

  describe('Combined Attack Vectors', () => {
    it('should handle combined XSS + NoSQL injection', () => {
      const result = sanitizeObject({
        username: '<script>steal()</script>',
        password: { $gt: '' },
        $where: 'malicious()',
      } as any)
      expect(result.username).toBe('steal()')
      expect(result.password).toEqual({})
      expect(result).not.toHaveProperty('$where')
    })

    it('should handle empty object', () => {
      expect(sanitizeObject({})).toEqual({})
    })

    it('should handle empty string', () => {
      expect(sanitizeValue('')).toBe('')
    })
  })
})
