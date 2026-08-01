import { describe, it, expect } from 'vitest'


type UserRole = 'employee' | 'manager' | 'admin' | 'superAdmin'

interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  companyName: string
  orgId: string
  role: UserRole
  permissions?: string[]
}

function hasRole(user: AuthUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false
  if (user.role === 'superAdmin') return true
  return roles.includes(user.role)
}

function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'superAdmin') return true
  return user.permissions?.includes(permission) ?? false
}

function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'superAdmin'
}

function isManager(user: AuthUser | null): boolean {
  return ['manager', 'admin', 'superAdmin'].includes(user?.role || '')
}

function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === 'superAdmin'
}

const makeUser = (role: UserRole, permissions?: string[]): AuthUser => ({
  id: 'u1', email: 'test@co.com', firstName: 'Test', lastName: 'User',
  fullName: 'Test User', companyName: 'TestCo', orgId: 'org-1',
  role, permissions
})


describe('Auth Store — Pure Logic', () => {
  describe('hasRole', () => {
    it('should return false for null user', () => {
      expect(hasRole(null, 'admin')).toBe(false)
    })

    it('should return true when user has the required role', () => {
      expect(hasRole(makeUser('admin'), 'admin')).toBe(true)
    })

    it('should return false when user does not have the required role', () => {
      expect(hasRole(makeUser('employee'), 'admin')).toBe(false)
    })

    it('should support multiple allowed roles', () => {
      expect(hasRole(makeUser('manager'), 'admin', 'manager')).toBe(true)
    })

    it('superAdmin should always return true regardless of required role', () => {
      expect(hasRole(makeUser('superAdmin'), 'employee')).toBe(true)
      expect(hasRole(makeUser('superAdmin'), 'admin')).toBe(true)
      expect(hasRole(makeUser('superAdmin'), 'manager')).toBe(true)
    })

    it('employee should not match manager or admin', () => {
      expect(hasRole(makeUser('employee'), 'manager', 'admin')).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('should return false for null user', () => {
      expect(hasPermission(null, 'customize_columns')).toBe(false)
    })

    it('admin should always have all permissions', () => {
      expect(hasPermission(makeUser('admin'), 'customize_columns')).toBe(true)
      expect(hasPermission(makeUser('admin'), 'any_permission')).toBe(true)
    })

    it('superAdmin should always have all permissions', () => {
      expect(hasPermission(makeUser('superAdmin'), 'anything')).toBe(true)
    })

    it('employee with specific permission should return true', () => {
      const user = makeUser('employee', ['customize_columns', 'view_reports'])
      expect(hasPermission(user, 'customize_columns')).toBe(true)
    })

    it('employee without specific permission should return false', () => {
      const user = makeUser('employee', ['view_reports'])
      expect(hasPermission(user, 'customize_columns')).toBe(false)
    })

    it('employee with no permissions array should return false', () => {
      expect(hasPermission(makeUser('employee'), 'anything')).toBe(false)
    })

    it('manager without specific permission should return false', () => {
      const user = makeUser('manager')
      expect(hasPermission(user, 'custom_thing')).toBe(false)
    })
  })

  describe('Role computed getters', () => {
    it('isAdmin should be true for admin and superAdmin', () => {
      expect(isAdmin(makeUser('admin'))).toBe(true)
      expect(isAdmin(makeUser('superAdmin'))).toBe(true)
    })

    it('isAdmin should be false for employee and manager', () => {
      expect(isAdmin(makeUser('employee'))).toBe(false)
      expect(isAdmin(makeUser('manager'))).toBe(false)
    })

    it('isManager should be true for manager, admin, superAdmin', () => {
      expect(isManager(makeUser('manager'))).toBe(true)
      expect(isManager(makeUser('admin'))).toBe(true)
      expect(isManager(makeUser('superAdmin'))).toBe(true)
    })

    it('isManager should be false for employee', () => {
      expect(isManager(makeUser('employee'))).toBe(false)
    })

    it('isSuperAdmin should only be true for superAdmin', () => {
      expect(isSuperAdmin(makeUser('superAdmin'))).toBe(true)
      expect(isSuperAdmin(makeUser('admin'))).toBe(false)
      expect(isSuperAdmin(makeUser('manager'))).toBe(false)
      expect(isSuperAdmin(makeUser('employee'))).toBe(false)
    })

    it('all getters should return false for null user', () => {
      expect(isAdmin(null)).toBe(false)
      expect(isManager(null)).toBe(false)
      expect(isSuperAdmin(null)).toBe(false)
    })
  })
})
