import { describe, it, expect } from 'vitest'


type UserRole = 'user' | 'manager' | 'admin' | 'superAdmin'

interface AuthUser {
  id: string; email: string; firstName: string; lastName: string
  fullName: string; companyName: string; orgId: string
  department?: string; role: UserRole; permissions?: string[]
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

function isAuthenticated(user: AuthUser | null, hasToken: boolean): boolean {
  return !!user && hasToken
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
  id: 'user-1', email: 'test@test.com', firstName: 'Test', lastName: 'User',
  fullName: 'Test User', companyName: 'TestCo', orgId: 'org-1', role, permissions
})

describe('Auth Store — Pure Logic', () => {
  describe('hasRole', () => {
    it('null user has no roles', () => {
      expect(hasRole(null, 'user')).toBe(false)
      expect(hasRole(null, 'admin')).toBe(false)
    })

    it('user has user role', () => {
      expect(hasRole(makeUser('user'), 'user')).toBe(true)
    })

    it('user does NOT have admin role', () => {
      expect(hasRole(makeUser('user'), 'admin')).toBe(false)
    })

    it('admin has admin role', () => {
      expect(hasRole(makeUser('admin'), 'admin')).toBe(true)
    })

    it('manager has manager role', () => {
      expect(hasRole(makeUser('manager'), 'manager')).toBe(true)
    })

    it('manager does NOT have admin role', () => {
      expect(hasRole(makeUser('manager'), 'admin')).toBe(false)
    })

    it('superAdmin has ALL roles (bypass)', () => {
      const su = makeUser('superAdmin')
      expect(hasRole(su, 'user')).toBe(true)
      expect(hasRole(su, 'manager')).toBe(true)
      expect(hasRole(su, 'admin')).toBe(true)
      expect(hasRole(su, 'superAdmin')).toBe(true)
    })

    it('multiple role check: manager OR admin', () => {
      expect(hasRole(makeUser('manager'), 'manager', 'admin')).toBe(true)
      expect(hasRole(makeUser('admin'), 'manager', 'admin')).toBe(true)
      expect(hasRole(makeUser('user'), 'manager', 'admin')).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('null user has no permissions', () => {
      expect(hasPermission(null, 'customize_columns')).toBe(false)
    })

    it('admin has ALL permissions (implicit)', () => {
      expect(hasPermission(makeUser('admin'), 'customize_columns')).toBe(true)
      expect(hasPermission(makeUser('admin'), 'anything')).toBe(true)
    })

    it('superAdmin has ALL permissions (implicit)', () => {
      expect(hasPermission(makeUser('superAdmin'), 'customize_columns')).toBe(true)
    })

    it('user with specific permission', () => {
      const user = makeUser('user', ['customize_columns', 'view_reports'])
      expect(hasPermission(user, 'customize_columns')).toBe(true)
      expect(hasPermission(user, 'view_reports')).toBe(true)
    })

    it('user without specific permission', () => {
      const user = makeUser('user', ['customize_columns'])
      expect(hasPermission(user, 'delete_assets')).toBe(false)
    })

    it('user with no permissions array', () => {
      const user = makeUser('user')
      expect(hasPermission(user, 'anything')).toBe(false)
    })

    it('user with empty permissions array', () => {
      const user = makeUser('user', [])
      expect(hasPermission(user, 'anything')).toBe(false)
    })
  })

  describe('isAuthenticated', () => {
    it('null user is not authenticated', () => {
      expect(isAuthenticated(null, true)).toBe(false)
    })

    it('user without token is not authenticated', () => {
      expect(isAuthenticated(makeUser('user'), false)).toBe(false)
    })

    it('user with token IS authenticated', () => {
      expect(isAuthenticated(makeUser('user'), true)).toBe(true)
    })
  })

  describe('Role Computed Getters', () => {
    it('isAdmin for admin', () => expect(isAdmin(makeUser('admin'))).toBe(true))
    it('isAdmin for superAdmin', () => expect(isAdmin(makeUser('superAdmin'))).toBe(true))
    it('isAdmin for user', () => expect(isAdmin(makeUser('user'))).toBe(false))
    it('isAdmin for manager', () => expect(isAdmin(makeUser('manager'))).toBe(false))
    it('isAdmin for null', () => expect(isAdmin(null)).toBe(false))

    it('isManager for manager', () => expect(isManager(makeUser('manager'))).toBe(true))
    it('isManager for admin', () => expect(isManager(makeUser('admin'))).toBe(true))
    it('isManager for superAdmin', () => expect(isManager(makeUser('superAdmin'))).toBe(true))
    it('isManager for user', () => expect(isManager(makeUser('user'))).toBe(false))
    it('isManager for null', () => expect(isManager(null)).toBe(false))

    it('isSuperAdmin for superAdmin', () => expect(isSuperAdmin(makeUser('superAdmin'))).toBe(true))
    it('isSuperAdmin for admin', () => expect(isSuperAdmin(makeUser('admin'))).toBe(false))
    it('isSuperAdmin for null', () => expect(isSuperAdmin(null)).toBe(false))
  })
})
