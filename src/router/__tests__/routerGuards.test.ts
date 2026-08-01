import { describe, it, expect } from 'vitest'


type UserRole = 'admin' | 'manager' | 'employee' | 'superAdmin'

interface RouteMeta {
  requiresAuth?: boolean
  roles?: UserRole[]
  title?: string
  description?: string
}

const PUBLIC_ROUTES = [
  { path: '/', name: 'Landing' },
  { path: '/sign-in', name: 'SignIn' },
  { path: '/sign-up', name: 'SignUp' },
  { path: '/privacy-policy', name: 'PrivacyPolicy' },
  { path: '/terms', name: 'TermsOfService' },
  { path: '/imprint', name: 'Imprint' },
  { path: '/pricing', name: 'Pricing' },
  { path: '/integrations', name: 'Integrations' },
  { path: '/api-docs', name: 'ApiDocs' },
  { path: '/changelog', name: 'Changelog' },
  { path: '/about', name: 'About' },
  { path: '/blog', name: 'Blog' },
  { path: '/blog/excel-vs-itam', name: 'BlogExcelVsItam' },
  { path: '/blog/snipe-it-vs-assetnode', name: 'BlogSnipeItVsAssetNode' },
  { path: '/blog/bluetally-vs-assetnode', name: 'BlogBlueTallyVsAssetNode' },
  { path: '/careers', name: 'Careers' },
  { path: '/faq', name: 'FAQ' },
  { path: '/auth/sso-callback', name: 'SsoCallback' },
  { path: '/forgot-password', name: 'ForgotPassword' },
  { path: '/reset-password', name: 'ResetPassword' },
]

const AUTH_ROUTES: Array<{ path: string; name: string; roles?: UserRole[] }> = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/marketplace', name: 'Marketplace' },
  { path: '/hardware', name: 'Hardware' },
  { path: '/assignments', name: 'Assignments' },
  { path: '/available', name: 'Available' },
  { path: '/defective', name: 'Defective' },
  { path: '/sales', name: 'Sales' },
  { path: '/profile', name: 'Profile' },
  { path: '/company-profile', name: 'CompanyProfile' },
  { path: '/licenses', name: 'Licenses' },
  { path: '/consumables', name: 'Consumables' },
  { path: '/peripherals', name: 'Peripherals' },
  { path: '/my-items', name: 'MyItems' },
  { path: '/privacy', name: 'Privacy' },

  { path: '/employees', name: 'Employees', roles: ['admin', 'manager'] },
  { path: '/locations', name: 'Locations', roles: ['admin', 'manager'] },
  { path: '/reports', name: 'Reports', roles: ['admin', 'manager'] },
  { path: '/maintenance', name: 'Maintenance', roles: ['admin', 'manager'] },
  { path: '/labels', name: 'Labels', roles: ['admin', 'manager'] },
  { path: '/audits', name: 'Audits', roles: ['admin', 'manager'] },
  { path: '/my-team', name: 'DirectReports', roles: ['admin', 'manager'] },
  { path: '/manufacturers', name: 'Manufacturers', roles: ['admin', 'manager'] },
  { path: '/suppliers', name: 'Suppliers', roles: ['admin', 'manager'] },
  { path: '/kits', name: 'Kits', roles: ['admin', 'manager'] },
  { path: '/components', name: 'Components', roles: ['admin', 'manager'] },
  { path: '/import', name: 'Import', roles: ['admin', 'manager'] },
  { path: '/recycle-bin', name: 'RecycleBin', roles: ['admin', 'manager'] },
  { path: '/categories', name: 'Categories', roles: ['admin', 'manager'] },
  { path: '/statuses', name: 'Statuses', roles: ['admin', 'manager'] },
  { path: '/departments', name: 'Departments', roles: ['admin', 'manager'] },
  { path: '/depreciations', name: 'Depreciations', roles: ['admin', 'manager'] },
  { path: '/workflows', name: 'Workflows', roles: ['admin', 'manager'] },

  { path: '/custom-fields', name: 'CustomFields', roles: ['admin'] },
  { path: '/settings', name: 'Settings', roles: ['admin'] },
  { path: '/billing', name: 'Billing', roles: ['admin'] },
  { path: '/admin', name: 'Admin', roles: ['admin'] },

  { path: '/super-admin', name: 'SuperAdmin', roles: ['superAdmin'] },
]

const MARKETING_ROUTES = new Set([
  'Landing', 'Pricing', 'Integrations', 'ApiDocs', 'About',
  'Blog', 'BlogExcelVsItam', 'BlogSnipeItVsAssetNode', 'BlogBlueTallyVsAssetNode',
  'Changelog', 'Careers', 'FAQ',
  'PrivacyPolicy', 'TermsOfService', 'Imprint', 'SetupGuide'
])

const APP_ROUTES = new Set([
  'SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword'
])

function guardDecision(
  meta: RouteMeta,
  isAuthenticated: boolean,
  userRole: UserRole | null
): 'allow' | 'redirect-sign-in' | 'redirect-dashboard' {
  if (!meta.requiresAuth) return 'allow'
  if (!isAuthenticated) return 'redirect-sign-in'
  if (meta.roles && meta.roles.length > 0) {
    if (!userRole || !meta.roles.includes(userRole)) return 'redirect-dashboard'
  }
  return 'allow'
}

function formatPageTitle(title?: string): string {
  return title ? `${title} | AssetNode` : 'AssetNode — IT Asset Management Software'
}


describe('Router — Route Registry & Guards', () => {
  describe('Public Routes', () => {
    it('should have 20 public routes', () => {
      expect(PUBLIC_ROUTES).toHaveLength(20)
    })

    it('landing page should be at /', () => {
      expect(PUBLIC_ROUTES.find(r => r.name === 'Landing')?.path).toBe('/')
    })

    it.each(['SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword'])(
      '%s should be public', (name) => {
        expect(PUBLIC_ROUTES.find(r => r.name === name)).toBeDefined()
      }
    )

    it('legal pages should be public', () => {
      expect(PUBLIC_ROUTES.find(r => r.name === 'PrivacyPolicy')).toBeDefined()
      expect(PUBLIC_ROUTES.find(r => r.name === 'TermsOfService')).toBeDefined()
      expect(PUBLIC_ROUTES.find(r => r.name === 'Imprint')).toBeDefined()
    })
  })

  describe('Authenticated Routes', () => {
    it('should have 37 authenticated routes', () => {
      expect(AUTH_ROUTES).toHaveLength(37)
    })

    it('all-role routes (no role restriction)', () => {
      const openAuthRoutes = AUTH_ROUTES.filter(r => !r.roles)
      expect(openAuthRoutes.length).toBeGreaterThan(10)
    })

    it('admin+manager routes should have 18 entries', () => {
      const mgr = AUTH_ROUTES.filter(r =>
        r.roles?.length === 2 && r.roles.includes('admin') && r.roles.includes('manager')
      )
      expect(mgr).toHaveLength(18)
    })

    it('admin-only routes should have 4 entries', () => {
      const admin = AUTH_ROUTES.filter(r =>
        r.roles?.length === 1 && r.roles[0] === 'admin'
      )
      expect(admin).toHaveLength(4)
    })

    it('superAdmin route should exist', () => {
      const sa = AUTH_ROUTES.find(r => r.roles?.includes('superAdmin'))
      expect(sa?.name).toBe('SuperAdmin')
    })
  })

  describe('Guard Decision Logic', () => {
    it('public route → allow (even unauthenticated)', () => {
      expect(guardDecision({}, false, null)).toBe('allow')
    })

    it('auth route, not authenticated → redirect-sign-in', () => {
      expect(guardDecision({ requiresAuth: true }, false, null)).toBe('redirect-sign-in')
    })

    it('auth route, authenticated admin → allow', () => {
      expect(guardDecision({ requiresAuth: true }, true, 'admin')).toBe('allow')
    })

    it('admin-only route, employee → redirect-dashboard', () => {
      expect(guardDecision(
        { requiresAuth: true, roles: ['admin'] },
        true,
        'employee'
      )).toBe('redirect-dashboard')
    })

    it('admin-only route, admin → allow', () => {
      expect(guardDecision(
        { requiresAuth: true, roles: ['admin'] },
        true,
        'admin'
      )).toBe('allow')
    })

    it('admin+manager route, manager → allow', () => {
      expect(guardDecision(
        { requiresAuth: true, roles: ['admin', 'manager'] },
        true,
        'manager'
      )).toBe('allow')
    })

    it('admin+manager route, employee → redirect-dashboard', () => {
      expect(guardDecision(
        { requiresAuth: true, roles: ['admin', 'manager'] },
        true,
        'employee'
      )).toBe('redirect-dashboard')
    })

    it('superAdmin route, admin → redirect-dashboard', () => {
      expect(guardDecision(
        { requiresAuth: true, roles: ['superAdmin'] },
        true,
        'admin'
      )).toBe('redirect-dashboard')
    })

    it('superAdmin route, superAdmin → allow', () => {
      expect(guardDecision(
        { requiresAuth: true, roles: ['superAdmin'] },
        true,
        'superAdmin'
      )).toBe('allow')
    })
  })

  describe('Page Title Formatting', () => {
    it('with title → "Title | AssetNode"', () => {
      expect(formatPageTitle('Dashboard')).toBe('Dashboard | AssetNode')
    })

    it('without title → default', () => {
      expect(formatPageTitle()).toBe('AssetNode — IT Asset Management Software')
    })

    it('with empty string → default', () => {
      expect(formatPageTitle('')).toBe('AssetNode — IT Asset Management Software')
    })
  })

  describe('Domain Classification', () => {
    it('marketing routes should have 16 entries', () => {
      expect(MARKETING_ROUTES.size).toBe(16)
    })

    it('app routes should have 4 entries', () => {
      expect(APP_ROUTES.size).toBe(4)
    })

    it.each(['Landing', 'Pricing', 'About', 'Blog', 'FAQ'])(
      '%s should be a marketing route', (name) => {
        expect(MARKETING_ROUTES.has(name)).toBe(true)
      }
    )

    it.each(['SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword'])(
      '%s should be an app route', (name) => {
        expect(APP_ROUTES.has(name)).toBe(true)
      }
    )

    it('Dashboard should NOT be in marketing routes', () => {
      expect(MARKETING_ROUTES.has('Dashboard')).toBe(false)
    })

    it('no overlap between marketing and app routes', () => {
      for (const name of APP_ROUTES) {
        expect(MARKETING_ROUTES.has(name)).toBe(false)
      }
    })
  })

  describe('Route Uniqueness', () => {
    it('all route paths should be unique', () => {
      const allPaths = [...PUBLIC_ROUTES, ...AUTH_ROUTES].map(r => r.path)
      const unique = new Set(allPaths)
      expect(unique.size).toBe(allPaths.length)
    })

    it('all route names should be unique', () => {
      const allNames = [...PUBLIC_ROUTES, ...AUTH_ROUTES].map(r => r.name)
      const unique = new Set(allNames)
      expect(unique.size).toBe(allNames.length)
    })
  })
})
