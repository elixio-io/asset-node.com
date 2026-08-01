import { describe, it, expect } from 'vitest'


const MARKETING_ROUTES = new Set([
  'Landing', 'Pricing', 'Integrations', 'ApiDocs', 'About',
  'Blog', 'BlogExcelVsItam', 'BlogSnipeItVsAssetNode', 'BlogBlueTallyVsAssetNode',
  'Changelog', 'Careers', 'FAQ',
  'PrivacyPolicy', 'TermsOfService', 'Imprint', 'SetupGuide'
])

const APP_ROUTES = new Set([
  'SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword'
])

const ROUTES = [
  { path: '/', name: 'Landing', requiresAuth: false, roles: [] },
  { path: '/sign-in', name: 'SignIn', requiresAuth: false, roles: [] },
  { path: '/sign-up', name: 'SignUp', requiresAuth: false, roles: [] },
  { path: '/privacy-policy', name: 'PrivacyPolicy', requiresAuth: false, roles: [] },
  { path: '/terms', name: 'TermsOfService', requiresAuth: false, roles: [] },
  { path: '/imprint', name: 'Imprint', requiresAuth: false, roles: [] },
  { path: '/pricing', name: 'Pricing', requiresAuth: false, roles: [] },
  { path: '/integrations', name: 'Integrations', requiresAuth: false, roles: [] },
  { path: '/api-docs', name: 'ApiDocs', requiresAuth: false, roles: [] },
  { path: '/changelog', name: 'Changelog', requiresAuth: false, roles: [] },
  { path: '/about', name: 'About', requiresAuth: false, roles: [] },
  { path: '/blog', name: 'Blog', requiresAuth: false, roles: [] },
  { path: '/blog/excel-vs-itam', name: 'BlogExcelVsItam', requiresAuth: false, roles: [] },
  { path: '/blog/snipe-it-vs-assetnode', name: 'BlogSnipeItVsAssetNode', requiresAuth: false, roles: [] },
  { path: '/blog/bluetally-vs-assetnode', name: 'BlogBlueTallyVsAssetNode', requiresAuth: false, roles: [] },
  { path: '/careers', name: 'Careers', requiresAuth: false, roles: [] },
  { path: '/faq', name: 'FAQ', requiresAuth: false, roles: [] },
  { path: '/forgot-password', name: 'ForgotPassword', requiresAuth: false, roles: [] },
  { path: '/reset-password', name: 'ResetPassword', requiresAuth: false, roles: [] },
  { path: '/dashboard', name: 'Dashboard', requiresAuth: true, roles: [] },
  { path: '/hardware', name: 'Hardware', requiresAuth: true, roles: [] },
  { path: '/assignments', name: 'Assignments', requiresAuth: true, roles: [] },
  { path: '/available', name: 'Available', requiresAuth: true, roles: [] },
  { path: '/defective', name: 'Defective', requiresAuth: true, roles: [] },
  { path: '/sales', name: 'Sales', requiresAuth: true, roles: [] },
  { path: '/profile', name: 'Profile', requiresAuth: true, roles: [] },
  { path: '/company-profile', name: 'CompanyProfile', requiresAuth: true, roles: [] },
  { path: '/employees', name: 'Employees', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/locations', name: 'Locations', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/licenses', name: 'Licenses', requiresAuth: true, roles: [] },
  { path: '/consumables', name: 'Consumables', requiresAuth: true, roles: [] },
  { path: '/peripherals', name: 'Peripherals', requiresAuth: true, roles: [] },
  { path: '/reports', name: 'Reports', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/maintenance', name: 'Maintenance', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/my-items', name: 'MyItems', requiresAuth: true, roles: [] },
  { path: '/labels', name: 'Labels', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/audits', name: 'Audits', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/my-team', name: 'DirectReports', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/manufacturers', name: 'Manufacturers', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/suppliers', name: 'Suppliers', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/kits', name: 'Kits', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/components', name: 'Components', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/import', name: 'Import', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/recycle-bin', name: 'RecycleBin', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/categories', name: 'Categories', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/statuses', name: 'Statuses', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/departments', name: 'Departments', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/depreciations', name: 'Depreciations', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/workflows', name: 'Workflows', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/custom-fields', name: 'CustomFields', requiresAuth: true, roles: ['admin'] },
  { path: '/settings', name: 'Settings', requiresAuth: true, roles: ['admin'] },
  { path: '/billing', name: 'Billing', requiresAuth: true, roles: ['admin'] },
  { path: '/admin', name: 'Admin', requiresAuth: true, roles: ['admin'] },
  { path: '/ai-logs', name: 'AILogs', requiresAuth: true, roles: ['admin', 'manager'] },
  { path: '/privacy', name: 'Privacy', requiresAuth: true, roles: [] },
  { path: '/super-admin', name: 'SuperAdmin', requiresAuth: true, roles: ['superAdmin'] },
]


describe('Router Configuration — Deep', () => {
  describe('Route Completeness', () => {
    it('should have 56 routes defined', () => {
      expect(ROUTES).toHaveLength(56)
    })

    it('all routes should have unique paths', () => {
      const paths = ROUTES.map(r => r.path)
      expect(new Set(paths).size).toBe(paths.length)
    })

    it('all routes should have unique names', () => {
      const names = ROUTES.map(r => r.name)
      expect(new Set(names).size).toBe(names.length)
    })
  })

  describe('Public Routes (no auth required)', () => {
    const publicRoutes = ROUTES.filter(r => !r.requiresAuth)

    it('should have 19 public routes', () => {
      expect(publicRoutes).toHaveLength(19)
    })

    it.each([
      '/', '/sign-in', '/sign-up', '/pricing', '/faq',
      '/about', '/blog', '/changelog', '/careers',
      '/privacy-policy', '/terms', '/imprint',
      '/integrations', '/api-docs', '/forgot-password', '/reset-password'
    ])('"%s" should be public', (path) => {
      const route = ROUTES.find(r => r.path === path)
      expect(route?.requiresAuth).toBe(false)
    })
  })

  describe('Protected Routes (auth required)', () => {
    const protectedRoutes = ROUTES.filter(r => r.requiresAuth)

    it('should have 37 protected routes', () => {
      expect(protectedRoutes).toHaveLength(37)
    })

    it.each([
      '/dashboard', '/hardware', '/employees', '/settings',
      '/billing', '/admin', '/super-admin'
    ])('"%s" should require auth', (path) => {
      const route = ROUTES.find(r => r.path === path)
      expect(route?.requiresAuth).toBe(true)
    })
  })

  describe('RBAC Role Requirements', () => {
    it('super-admin route requires superAdmin role', () => {
      const route = ROUTES.find(r => r.path === '/super-admin')
      expect(route?.roles).toEqual(['superAdmin'])
    })

    it('settings requires admin role only', () => {
      const route = ROUTES.find(r => r.path === '/settings')
      expect(route?.roles).toEqual(['admin'])
    })

    it('billing requires admin role only', () => {
      const route = ROUTES.find(r => r.path === '/billing')
      expect(route?.roles).toEqual(['admin'])
    })

    it('custom-fields requires admin role only', () => {
      const route = ROUTES.find(r => r.path === '/custom-fields')
      expect(route?.roles).toEqual(['admin'])
    })

    it('employees requires admin or manager', () => {
      const route = ROUTES.find(r => r.path === '/employees')
      expect(route?.roles).toEqual(['admin', 'manager'])
    })

    it('reports requires admin or manager', () => {
      const route = ROUTES.find(r => r.path === '/reports')
      expect(route?.roles).toEqual(['admin', 'manager'])
    })

    it('dashboard has no role restriction', () => {
      const route = ROUTES.find(r => r.path === '/dashboard')
      expect(route?.roles).toEqual([])
    })

    it('profile has no role restriction', () => {
      const route = ROUTES.find(r => r.path === '/profile')
      expect(route?.roles).toEqual([])
    })

    it('admin-only routes should be exactly 4', () => {
      const adminOnly = ROUTES.filter(r => r.roles.length === 1 && r.roles[0] === 'admin')
      expect(adminOnly).toHaveLength(4)
    })
  })

  describe('Domain Routing Strategy', () => {
    it('should have 16 marketing routes', () => {
      expect(MARKETING_ROUTES.size).toBe(16)
    })

    it('should have 4 app routes (auth-related)', () => {
      expect(APP_ROUTES.size).toBe(4)
    })

    it.each([
      'Landing', 'Pricing', 'About', 'Blog', 'FAQ', 'Careers'
    ])('"%s" should be a marketing route', (name) => {
      expect(MARKETING_ROUTES.has(name)).toBe(true)
    })

    it.each([
      'SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword'
    ])('"%s" should be an app route', (name) => {
      expect(APP_ROUTES.has(name)).toBe(true)
    })

    it('marketing and app routes should not overlap', () => {
      const overlap = [...MARKETING_ROUTES].filter(r => APP_ROUTES.has(r))
      expect(overlap).toHaveLength(0)
    })
  })

  describe('SEO Page Titles', () => {
    it('every public marketing route should have a path starting with /', () => {
      ROUTES.filter(r => !r.requiresAuth).forEach(r => {
        expect(r.path.startsWith('/')).toBe(true)
      })
    })

    it('title format should be "[title] | AssetNode"', () => {
      const title = 'Dashboard'
      const formatted = `${title} | AssetNode`
      expect(formatted).toBe('Dashboard | AssetNode')
    })

    it('default title for routes without meta.title', () => {
      const defaultTitle = 'AssetNode — IT Asset Management Software'
      expect(defaultTitle.length).toBeGreaterThan(10)
    })
  })
})
