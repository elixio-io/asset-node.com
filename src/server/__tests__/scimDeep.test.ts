import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

function getScimBaseUrl(apiUrl?: string): string {
  if (apiUrl) return `${apiUrl.replace(/\/$/, '')}/api/scim/v2`
  return 'http://localhost:3001/api/scim/v2'
}

function scimError(detail: string, status: string): any {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status
  }
}

function mapEmployeeToScim(emp: any, baseUrl: string): any {
  return {
    schemas: [
      'urn:ietf:params:scim:schemas:core:2.0:User',
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
    ],
    id: emp._id,
    externalId: emp.externalId || undefined,
    userName: emp.email,
    name: {
      givenName: emp.firstName,
      familyName: emp.lastName,
      formatted: `${emp.firstName} ${emp.lastName}`
    },
    displayName: `${emp.firstName} ${emp.lastName}`,
    emails: [{ value: emp.email, type: 'work', primary: true }],
    active: emp.isActive,
    title: emp.jobTitle || '',
    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
      department: emp.department || ''
    },
    meta: {
      resourceType: 'User',
      created: emp.createdAt,
      lastModified: emp.updatedAt,
      location: `${baseUrl}/Users/${emp._id}`
    }
  }
}

function applyPatchByPath(emp: any, path: string, value: any): void {
  const normalized = path.toLowerCase().replace(/\s+/g, '')
  switch (normalized) {
    case 'active':
      if (value === false || value === 'false') {
        emp.isActive = false
        emp.endDate = new Date()
      } else {
        emp.isActive = true
        emp.endDate = undefined
      }
      break
    case 'name.givenname':
    case 'givenname':
      if (typeof value === 'string') emp.firstName = value
      break
    case 'name.familyname':
    case 'familyname':
      if (typeof value === 'string') emp.lastName = value
      break
    case 'username':
      if (typeof value === 'string') emp.email = value.toLowerCase()
      break
    case 'title':
      if (typeof value === 'string') emp.jobTitle = value
      break
    case 'name':
      if (typeof value === 'object' && value !== null) {
        if (value.givenName) emp.firstName = value.givenName
        if (value.familyName) emp.lastName = value.familyName
      }
      break
    case 'emails':
    case 'emails[type eq "work"].value':
      if (typeof value === 'string') {
        emp.email = value.toLowerCase()
      } else if (Array.isArray(value) && value.length > 0) {
        const primary = value.find((e: any) => e.primary) || value[0]
        if (primary?.value) emp.email = primary.value.toLowerCase()
      }
      break
    case 'externalid':
      if (typeof value === 'string') emp.externalId = value
      break
    case 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:user':
      if (typeof value === 'object' && value !== null) {
        if (value.department) emp.department = value.department
      }
      break
  }
}

function parseScimFilter(filter: string): { field: string; value: string } | null {
  const userNameMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i)
  if (userNameMatch) return { field: 'email', value: userNameMatch[1].toLowerCase() }
  const externalIdMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i)
  if (externalIdMatch) return { field: 'externalId', value: externalIdMatch[1] }
  return null
}


describe('SCIM 2.0 — Deep Logic', () => {
  describe('Timing-Safe Compare', () => {
    it('should match identical strings', () => {
      expect(timingSafeCompare('hello', 'hello')).toBe(true)
    })

    it('should reject different strings', () => {
      expect(timingSafeCompare('hello', 'world')).toBe(false)
    })

    it('should reject different length strings', () => {
      expect(timingSafeCompare('short', 'longer-string')).toBe(false)
    })

    it('should reject empty vs non-empty', () => {
      expect(timingSafeCompare('', 'something')).toBe(false)
    })

    it('should match empty strings', () => {
      expect(timingSafeCompare('', '')).toBe(true)
    })

    it('should match UUID-format tokens', () => {
      const token = '550e8400-e29b-41d4-a716-446655440000'
      expect(timingSafeCompare(token, token)).toBe(true)
    })
  })

  describe('SCIM Base URL', () => {
    it('should use API_URL when available', () => {
      expect(getScimBaseUrl('https://api.asset-node.com'))
        .toBe('https://api.asset-node.com/api/scim/v2')
    })

    it('should strip trailing slash', () => {
      expect(getScimBaseUrl('https://api.asset-node.com/'))
        .toBe('https://api.asset-node.com/api/scim/v2')
    })

    it('should fallback to localhost', () => {
      expect(getScimBaseUrl()).toBe('http://localhost:3001/api/scim/v2')
    })
  })

  describe('SCIM Error Format', () => {
    it('should produce RFC 7644 error response', () => {
      const err = scimError('User not found', '404')
      expect(err.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error'])
      expect(err.detail).toBe('User not found')
      expect(err.status).toBe('404')
    })

    it('should handle 401 unauthorized', () => {
      const err = scimError('Unauthorized', '401')
      expect(err.status).toBe('401')
    })

    it('should handle 409 conflict', () => {
      const err = scimError('User already exists', '409')
      expect(err.detail).toBe('User already exists')
    })
  })

  describe('Employee → SCIM Mapping', () => {
    const emp = {
      _id: 'emp-123',
      externalId: 'ext-456',
      email: 'alex@example.com',
      firstName: 'Alex',
      lastName: 'von H',
      isActive: true,
      jobTitle: 'Engineer',
      department: 'IT',
      createdAt: '2026-01-01',
      updatedAt: '2026-04-19',
    }
    const scim = mapEmployeeToScim(emp, 'https://api.asset-node.com/api/scim/v2')

    it('should include both SCIM schemas', () => {
      expect(scim.schemas).toHaveLength(2)
      expect(scim.schemas[0]).toContain('core:2.0:User')
      expect(scim.schemas[1]).toContain('enterprise:2.0:User')
    })

    it('should map id to _id', () => {
      expect(scim.id).toBe('emp-123')
    })

    it('should map externalId', () => {
      expect(scim.externalId).toBe('ext-456')
    })

    it('should map userName to email', () => {
      expect(scim.userName).toBe('alex@example.com')
    })

    it('should map name fields', () => {
      expect(scim.name.givenName).toBe('Alex')
      expect(scim.name.familyName).toBe('von H')
      expect(scim.name.formatted).toBe('Alex von H')
    })

    it('should create displayName', () => {
      expect(scim.displayName).toBe('Alex von H')
    })

    it('should map emails array', () => {
      expect(scim.emails).toHaveLength(1)
      expect(scim.emails[0].value).toBe('alex@example.com')
      expect(scim.emails[0].type).toBe('work')
      expect(scim.emails[0].primary).toBe(true)
    })

    it('should map active flag', () => {
      expect(scim.active).toBe(true)
    })

    it('should map title', () => {
      expect(scim.title).toBe('Engineer')
    })

    it('should map enterprise extension department', () => {
      expect(scim['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'].department).toBe('IT')
    })

    it('should include meta with location', () => {
      expect(scim.meta.resourceType).toBe('User')
      expect(scim.meta.location).toBe('https://api.asset-node.com/api/scim/v2/Users/emp-123')
    })

    it('should handle missing externalId', () => {
      const noExt = mapEmployeeToScim({ ...emp, externalId: undefined }, 'http://localhost:3001/api/scim/v2')
      expect(noExt.externalId).toBeUndefined()
    })

    it('should handle missing jobTitle', () => {
      const noTitle = mapEmployeeToScim({ ...emp, jobTitle: '' }, 'http://localhost:3001/api/scim/v2')
      expect(noTitle.title).toBe('')
    })
  })

  describe('PATCH Path Resolver', () => {
    function makeEmp() {
      return { firstName: 'A', lastName: 'B', email: 'a@b.com', jobTitle: '', isActive: true, externalId: null, department: '' }
    }

    it('active=false → deactivates user', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'active', false)
      expect(emp.isActive).toBe(false)
      expect(emp.endDate).toBeDefined()
    })

    it('active="false" (string) → deactivates user', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'active', 'false')
      expect(emp.isActive).toBe(false)
    })

    it('active=true → activates user', () => {
      const emp = makeEmp()
      emp.isActive = false
      applyPatchByPath(emp, 'active', true)
      expect(emp.isActive).toBe(true)
      expect(emp.endDate).toBeUndefined()
    })

    it('name.givenName → sets firstName', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'name.givenName', 'Jane')
      expect(emp.firstName).toBe('Jane')
    })

    it('givenName (flat) → sets firstName', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'givenName', 'Jane')
      expect(emp.firstName).toBe('Jane')
    })

    it('name.familyName → sets lastName', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'name.familyName', 'Doe')
      expect(emp.lastName).toBe('Doe')
    })

    it('familyName (flat) → sets lastName', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'familyName', 'Doe')
      expect(emp.lastName).toBe('Doe')
    })

    it('userName → sets email (lowercased)', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'userName', 'NEW@EXAMPLE.COM')
      expect(emp.email).toBe('new@example.com')
    })

    it('title → sets jobTitle', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'title', 'CTO')
      expect(emp.jobTitle).toBe('CTO')
    })

    it('name (object) → sets both names', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'name', { givenName: 'X', familyName: 'Y' })
      expect(emp.firstName).toBe('X')
      expect(emp.lastName).toBe('Y')
    })

    it('emails (string) → sets email lowercased', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'emails', 'Test@Example.COM')
      expect(emp.email).toBe('test@example.com')
    })

    it('emails (array) → picks primary email', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'emails', [
        { value: 'secondary@b.com', primary: false },
        { value: 'Primary@B.COM', primary: true }
      ])
      expect(emp.email).toBe('primary@b.com')
    })

    it('emails (array, no primary) → picks first', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'emails', [
        { value: 'First@B.COM' }
      ])
      expect(emp.email).toBe('first@b.com')
    })

    it('externalId → sets external ID', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'externalId', 'okta-123')
      expect(emp.externalId).toBe('okta-123')
    })

    it('enterprise extension → sets department', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User', { department: 'Engineering' })
      expect(emp.department).toBe('Engineering')
    })

    it('unknown path → no-op (graceful)', () => {
      const emp = makeEmp()
      const before = { ...emp }
      applyPatchByPath(emp, 'unknownField', 'value')
      expect(emp.firstName).toBe(before.firstName)
    })
  })

  describe('SCIM Filter Parsing', () => {
    it('should parse userName eq filter', () => {
      const result = parseScimFilter('userName eq "test@example.com"')
      expect(result).toEqual({ field: 'email', value: 'test@example.com' })
    })

    it('should lowercase email from userName filter', () => {
      const result = parseScimFilter('userName eq "Test@EXAMPLE.com"')
      expect(result?.value).toBe('test@example.com')
    })

    it('should parse externalId eq filter', () => {
      const result = parseScimFilter('externalId eq "okta-user-123"')
      expect(result).toEqual({ field: 'externalId', value: 'okta-user-123' })
    })

    it('should return null for unsupported filter', () => {
      const result = parseScimFilter('displayName co "John"')
      expect(result).toBeNull()
    })
  })
})
