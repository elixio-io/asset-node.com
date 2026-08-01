import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'


function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

function scimError(detail: string, status: string): any {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status
  }
}

function getScimBaseUrl(): string {
  const apiUrl = process.env.API_URL || process.env.APP_URL
  if (apiUrl) return `${apiUrl.replace(/\/$/, '')}/api/scim/v2`
  return 'http://localhost:3001/api/scim/v2'
}

function mapEmployeeToScim(emp: any): any {
  const base = getScimBaseUrl()
  return {
    schemas: [
      'urn:ietf:params:scim:schemas:core:2.0:User',
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
    ],
    id: emp._id.toString(),
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
      location: `${base}/Users/${emp._id}`
    }
  }
}

function applyPatchByPath(emp: any, path: string, value: any): void {
  const normalized = path.toLowerCase().replace(/\s+/g, '')
  switch (normalized) {
    case 'active':
      if (value === false || value === 'false') { emp.isActive = false; emp.endDate = new Date() }
      else { emp.isActive = true; emp.endDate = undefined }
      break
    case 'name.givenname': case 'givenname':
      if (typeof value === 'string') emp.firstName = value; break
    case 'name.familyname': case 'familyname':
      if (typeof value === 'string') emp.lastName = value; break
    case 'username':
      if (typeof value === 'string') emp.email = value.toLowerCase(); break
    case 'title':
      if (typeof value === 'string') emp.jobTitle = value; break
    case 'name':
      if (typeof value === 'object' && value !== null) {
        if (value.givenName) emp.firstName = value.givenName
        if (value.familyName) emp.lastName = value.familyName
      }
      break
    case 'emails': case 'emails[type eq "work"].value':
      if (typeof value === 'string') { emp.email = value.toLowerCase() }
      else if (Array.isArray(value) && value.length > 0) {
        const primary = value.find((e: any) => e.primary) || value[0]
        if (primary?.value) emp.email = primary.value.toLowerCase()
      }
      break
    case 'externalid':
      if (typeof value === 'string') emp.externalId = value; break
    case 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:user':
      if (typeof value === 'object' && value !== null) {
        if (value.department) emp.department = value.department
      }
      break
  }
}

function parseScimFilter(filter: string): { email?: string; externalId?: string } {
  const result: { email?: string; externalId?: string } = {}
  const userNameMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i)
  if (userNameMatch) result.email = userNameMatch[1].toLowerCase()
  const externalIdMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i)
  if (externalIdMatch) result.externalId = externalIdMatch[1]
  return result
}


describe('SCIM 2.0 Helpers', () => {
  describe('timingSafeCompare', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeCompare('secret-token', 'secret-token')).toBe(true)
    })

    it('should return false for different strings of same length', () => {
      expect(timingSafeCompare('aaaaaaa', 'bbbbbbb')).toBe(false)
    })

    it('should return false for different-length strings', () => {
      expect(timingSafeCompare('short', 'much-longer-string')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(timingSafeCompare('', '')).toBe(true)
    })

    it('should detect single-char differences', () => {
      expect(timingSafeCompare('abcdefg', 'abcdefh')).toBe(false)
    })
  })

  describe('scimError format', () => {
    it('should follow RFC 7644 error format', () => {
      const err = scimError('User not found', '404')
      expect(err.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error'])
      expect(err.detail).toBe('User not found')
      expect(err.status).toBe('404')
    })
  })

  describe('mapEmployeeToScim', () => {
    const emp = {
      _id: { toString: () => 'emp-123' },
      email: 'jane@company.com',
      firstName: 'Jane',
      lastName: 'Doe',
      isActive: true,
      jobTitle: 'Engineer',
      department: 'Engineering',
      externalId: 'ext-999',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-03-15T12:00:00Z',
    }

    it('should include both core and enterprise SCIM schemas', () => {
      const scim = mapEmployeeToScim(emp)
      expect(scim.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:User')
      expect(scim.schemas).toContain('urn:ietf:params:scim:schemas:extension:enterprise:2.0:User')
    })

    it('should map email to userName', () => {
      expect(mapEmployeeToScim(emp).userName).toBe('jane@company.com')
    })

    it('should map name fields', () => {
      const scim = mapEmployeeToScim(emp)
      expect(scim.name.givenName).toBe('Jane')
      expect(scim.name.familyName).toBe('Doe')
      expect(scim.name.formatted).toBe('Jane Doe')
    })

    it('should include externalId when present', () => {
      expect(mapEmployeeToScim(emp).externalId).toBe('ext-999')
    })

    it('should exclude externalId when missing', () => {
      const noExt = { ...emp, externalId: null }
      expect(mapEmployeeToScim(noExt).externalId).toBeUndefined()
    })

    it('should include enterprise extension with department', () => {
      const scim = mapEmployeeToScim(emp)
      const ext = scim['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']
      expect(ext.department).toBe('Engineering')
    })

    it('should include meta with resourceType and location', () => {
      const scim = mapEmployeeToScim(emp)
      expect(scim.meta.resourceType).toBe('User')
      expect(scim.meta.location).toContain('/Users/emp-123')
    })

    it('should include emails as work type primary', () => {
      const scim = mapEmployeeToScim(emp)
      expect(scim.emails[0]).toEqual({ value: 'jane@company.com', type: 'work', primary: true })
    })
  })

  describe('applyPatchByPath — SCIM PATCH operations', () => {
    function makeEmp() {
      return { firstName: 'Jane', lastName: 'Doe', email: 'jane@co.com', isActive: true, jobTitle: '', department: '', externalId: null, endDate: undefined }
    }

    it('should deactivate user on active=false', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'active', false)
      expect(emp.isActive).toBe(false)
      expect(emp.endDate).toBeDefined()
    })

    it('should activate user on active=true', () => {
      const emp = makeEmp()
      emp.isActive = false
      applyPatchByPath(emp, 'active', true)
      expect(emp.isActive).toBe(true)
    })

    it('should handle string "false" for active', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'active', 'false')
      expect(emp.isActive).toBe(false)
    })

    it('should update givenName via name.givenName path', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'name.givenName', 'Sarah')
      expect(emp.firstName).toBe('Sarah')
    })

    it('should update familyName via name.familyName path', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'name.familyName', 'Smith')
      expect(emp.lastName).toBe('Smith')
    })

    it('should update name from object value', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'name', { givenName: 'Alex', familyName: 'Kim' })
      expect(emp.firstName).toBe('Alex')
      expect(emp.lastName).toBe('Kim')
    })

    it('should update userName and lowercase it', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'userName', 'NEW@COMPANY.COM')
      expect(emp.email).toBe('new@company.com')
    })

    it('should update title → jobTitle', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'title', 'Lead Engineer')
      expect(emp.jobTitle).toBe('Lead Engineer')
    })

    it('should update emails from string value', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'emails', 'UPDATED@CO.COM')
      expect(emp.email).toBe('updated@co.com')
    })

    it('should update emails from array (pick primary)', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'emails', [
        { value: 'personal@gmail.com', type: 'personal' },
        { value: 'work@co.com', type: 'work', primary: true }
      ])
      expect(emp.email).toBe('work@co.com')
    })

    it('should update emails from array (pick first if no primary)', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'emails', [
        { value: 'first@co.com', type: 'work' },
        { value: 'second@co.com', type: 'personal' }
      ])
      expect(emp.email).toBe('first@co.com')
    })

    it('should update externalId', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'externalId', 'okta-ext-123')
      expect(emp.externalId).toBe('okta-ext-123')
    })

    it('should update enterprise extension department', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User', { department: 'Finance' })
      expect(emp.department).toBe('Finance')
    })

    it('should handle case-insensitive paths (Azure AD sends Active, Okta sends active)', () => {
      const emp = makeEmp()
      applyPatchByPath(emp, 'Active', false)
      expect(emp.isActive).toBe(false)
    })

    it('should ignore unknown paths gracefully', () => {
      const emp = makeEmp()
      const original = { ...emp }
      applyPatchByPath(emp, 'unknownField', 'whatever')
      expect(emp.firstName).toBe(original.firstName)
    })
  })

  describe('SCIM filter parsing', () => {
    it('should parse userName eq filter', () => {
      const result = parseScimFilter('userName eq "john@example.com"')
      expect(result.email).toBe('john@example.com')
    })

    it('should parse externalId eq filter', () => {
      const result = parseScimFilter('externalId eq "ext-abc-123"')
      expect(result.externalId).toBe('ext-abc-123')
    })

    it('should lowercase email in userName filter', () => {
      const result = parseScimFilter('userName eq "JOHN@EXAMPLE.COM"')
      expect(result.email).toBe('john@example.com')
    })

    it('should handle filter with extra whitespace', () => {
      const result = parseScimFilter('userName   eq   "test@co.com"')
      expect(result.email).toBe('test@co.com')
    })

    it('should return empty for unrecognized filter', () => {
      const result = parseScimFilter('displayName eq "John"')
      expect(result.email).toBeUndefined()
      expect(result.externalId).toBeUndefined()
    })
  })
})
