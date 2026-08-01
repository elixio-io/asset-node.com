import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types/user'
import Landing from '../views/Landing.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: UserRole[]
    title?: string
    description?: string
    indexable?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Landing',
    component: Landing,
    meta: { title: 'IT-Asset-Management-Software für wachsende Teams', description: 'IT-Inventar verwalten ohne Excel — AssetNode ist die DSGVO-konforme ITAM-Software für den Mittelstand. Hardware, Lizenzen & Peripherie zentral verwalten.' }
  },
  {
    path: '/sign-in',
    name: 'SignIn',
    component: () => import('../views/SignIn.vue'),
    meta: { title: 'Anmelden', description: 'Bei AssetNode anmelden — IT-Assets, Lizenzen und Hardware-Zuordnungen verwalten.', indexable: false }
  },
  {
    path: '/sign-up',
    name: 'SignUp',
    component: () => import('../views/SignUp.vue'),
    meta: { title: 'Kostenlos registrieren', description: 'AssetNode-Konto kostenlos erstellen — IT-Assets in Minuten professionell verwalten. Keine Kreditkarte nötig.', indexable: false }
  },
  {
    path: '/privacy-policy',
    name: 'PrivacyPolicy',
    component: () => import('../views/PrivacyPolicy.vue'),
    meta: { title: 'Datenschutzerklärung', description: 'AssetNode Datenschutzerklärung — wie wir Ihre Daten schützen und DSGVO-konform verarbeiten. Hosting in Deutschland.' }
  },
  {
    path: '/terms',
    name: 'TermsOfService',
    component: () => import('../views/TermsOfService.vue'),
    meta: { title: 'Nutzungsbedingungen', description: 'AssetNode AGB — Nutzungsbedingungen für die IT-Asset-Management-Plattform.' }
  },
  {
    path: '/imprint',
    name: 'Imprint',
    component: () => import('../views/Imprint.vue'),
    meta: { title: 'Impressum', description: 'Impressum und Kontaktdaten von AssetNode (ein Produkt der Elixio UG) mit Sitz in Bonn.' }
  },
  {
    path: '/pricing',
    name: 'Pricing',
    component: () => import('../views/Pricing.vue'),
    meta: { title: 'Preise & Pläne — IT-Asset-Management', description: 'AssetNode Preise: Kostenlos starten mit 100 Assets. Pro ab €20/Monat. ITAM-Software für KMU — ohne Kreditkarte testen.' }
  },
  {
    path: '/design-library',
    name: 'DesignLibrary',
    component: () => import('../views/DesignLibrary.vue'),
    meta: { title: 'SVG Design Library', description: 'Interactive playground and archive for AssetNode SVG characters and logos.' }
  },
  {
    path: '/integrations',
    name: 'Integrations',
    component: () => import('../views/Integrations.vue'),
    meta: { title: 'MDM-, HR- & Identity-Integrationen', description: 'MDM-Integration für IT-Asset-Management: Microsoft Intune, Jamf Pro, Kandji, Autopilot. Plus HR-Sync mit Personio, BambooHR & SCIM 2.0.' }
  },
  {
    path: '/api-docs',
    name: 'ApiDocs',
    component: () => import('../views/ApiDocs.vue'),
    meta: { title: 'REST API Dokumentation', description: 'AssetNode REST API — IT-Asset-Daten, Hardware-Inventar und Mitarbeiter-Zuordnungen in bestehende Workflows integrieren.' }
  },
  {
    path: '/changelog',
    name: 'Changelog',
    component: () => import('../views/Changelog.vue'),
    meta: { title: 'Changelog — Alle Updates', description: 'Alle AssetNode-Updates und neue Features im Überblick. Bleiben Sie informiert über Produktverbesserungen.' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue'),
    meta: { title: 'Über uns — IT-Asset-Management aus Deutschland', description: 'Über AssetNode — deutsches Startup aus Bonn. DSGVO-konforme IT-Asset-Management-Software für wachsende Teams. Hosting in der EU.' }
  },
  {
    path: '/blog',
    name: 'Blog',
    component: () => import('../views/Blog.vue'),
    meta: { title: 'Blog — IT-Asset-Management Ratgeber', description: 'AssetNode Blog — Artikel, Tipps und Best Practices zu IT-Asset-Management, Hardware-Tracking, DSGVO-Compliance und Digitalisierung.' }
  },
  {
    path: '/blog/excel-vs-itam',
    name: 'BlogExcelVsItam',
    component: () => import('../views/BlogExcelVsItam.vue'),
    meta: { title: 'Excel vs. ITAM-Software — 5 Gründe für den Wechsel', description: 'Excel vs. professionelle IT-Inventarverwaltung: 5 Gründe, warum Tabellen nicht skalieren und warum Sie ITAM-Software wie AssetNode nutzen sollten.' }
  },
  {
    path: '/blog/snipe-it-vs-assetnode',
    name: 'BlogSnipeItVsAssetNode',
    component: () => import('../views/BlogSnipeItVsAssetNode.vue'),
    meta: { title: 'Snipe-IT vs. AssetNode — Ehrlicher Vergleich für IT-Teams', description: 'Snipe-IT vs. AssetNode: Feature-Vergleich für KMU. Wann Open-Source gewinnt und wann Cloud-ITAM mit MDM-Auto-Sync die bessere Wahl ist.' }
  },
  {
    path: '/blog/bluetally-vs-assetnode',
    name: 'BlogBlueTallyVsAssetNode',
    component: () => import('../views/BlogBlueTallyVsAssetNode.vue'),
    meta: { title: 'BlueTally vs. AssetNode — Preis- & Feature-Vergleich', description: 'BlueTally vs. AssetNode: Preisvergleich ($99 vs. €20/Monat), Features, DSGVO-Konformität und Workflow-Automatisierung im direkten Vergleich.' }
  },
  {
    path: '/blog/it-offboarding-checkliste',
    name: 'BlogItOffboarding',
    component: () => import('../views/BlogItOffboarding.vue'),
    meta: { title: 'IT-Offboarding Checkliste — Mitarbeiteraustritt absichern', description: 'IT-Offboarding Checkliste: 7 Schritte für einen sicheren Mitarbeiteraustritt. Geräterückgabe, Zugänge deaktivieren, Lizenzen freigeben.' }
  },
  {
    path: '/blog/dsgvo-it-asset-management',
    name: 'BlogDsgvoItam',
    component: () => import('../views/BlogDsgvoItam.vue'),
    meta: { title: 'DSGVO-konformes IT-Asset-Management — Anforderungen & Checkliste', description: 'DSGVO und IT-Asset-Management: 5 Anforderungen, Checkliste und Best Practices für datenschutzkonforme IT-Inventarverwaltung.' }
  },
  {
    path: '/blog/laptop-onboarding',
    name: 'BlogLaptopOnboarding',
    component: () => import('../views/BlogLaptopOnboarding.vue'),
    meta: { title: 'Laptop-Onboarding automatisieren — Neue Mitarbeiter ausstatten', description: 'Laptop-Onboarding für neue Mitarbeiter automatisieren: HR-Sync, MDM-Integration und Kits für IT-Ausstattung in Minuten statt Tagen.' }
  },
  {
    path: '/careers',
    name: 'Careers',
    component: () => import('../views/Careers.vue'),
    meta: { title: 'Karriere', description: 'Karriere bei AssetNode — wir bauen auf. Initiativbewerbungen sind willkommen.' }
  },
  {
    path: '/faq',
    name: 'FAQ',
    component: () => import('../views/FAQ.vue'),
    meta: { title: 'FAQ — Häufige Fragen zu IT-Asset-Management', description: 'Häufige Fragen zu AssetNode: Setup, Preise, DSGVO, Intune- & Jamf-Integrationen und Import. Alles zur IT-Inventarverwaltung.' }
  },
  {
    path: '/auth/sso-callback',
    name: 'SsoCallback',
    component: () => import('../views/SsoCallback.vue'),
    meta: { title: 'SSO Login', indexable: false }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPassword.vue'),
    meta: { title: 'Forgot Password', description: 'Reset your AssetNode password. Enter your email address and we will send you a reset link.', indexable: false }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('../views/ResetPassword.vue'),
    meta: { title: 'Reset Password', description: 'Set a new password for your AssetNode account.', indexable: false }
  },
  {
    path: '/accept-invite',
    name: 'AcceptInvite',
    component: () => import('../views/AcceptInvite.vue'),
    meta: { title: 'Einladung annehmen', description: 'Treten Sie Ihrem Team auf AssetNode bei.', indexable: false }
  },

  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true, title: 'Dashboard' }
  },
  {
    path: '/hardware',
    name: 'Hardware',
    component: () => import('../views/Hardware.vue'),
    meta: { requiresAuth: true, title: 'All Assets' }
  },
  {
    path: '/procurement',
    name: 'Procurement',
    component: () => import('../views/Procurement.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Procurement' }
  },
  {
    path: '/procurement/:id',
    name: 'ProcurementDetail',
    component: () => import('../views/ProcurementDetail.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Procurement Detail' }
  },
  {
    path: '/marketplace',
    name: 'Marketplace',
    component: () => import('../views/Marketplace.vue'),
    meta: { requiresAuth: true, title: 'Marketplace', description: 'Buy refurbished IT hardware or sell retired devices to certified ITAD partners.' }
  },
  {
    path: '/assignments',
    name: 'Assignments',
    component: () => import('../views/Assignments.vue'),
    meta: { requiresAuth: true, title: 'Assignments' }
  },
  {
    path: '/available',
    name: 'Available',
    component: () => import('../views/Available.vue'),
    meta: { requiresAuth: true, title: 'Available Assets' }
  },
  {
    path: '/defective',
    name: 'Defective',
    component: () => import('../views/Defective.vue'),
    meta: { requiresAuth: true, title: 'Defective Assets' }
  },
  {
    path: '/sales',
    name: 'Sales',
    component: () => import('../views/Sales.vue'),
    meta: { requiresAuth: true, title: 'For Sale' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true, title: 'My Profile' }
  },
  {
    path: '/company-profile',
    name: 'CompanyProfile',
    component: () => import('../views/CompanyProfile.vue'),
    meta: { requiresAuth: true, title: 'Company Profile' }
  },
  {
    path: '/employees',
    name: 'Employees',
    component: () => import('../views/Employees.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Employees' }
  },
  {
    path: '/employees/:id',
    name: 'EmployeeDetail',
    component: () => import('../views/EmployeeDetail.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Employee Detail' }
  },
  {
    path: '/locations',
    name: 'Locations',
    component: () => import('../views/Locations.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Locations' }
  },
  {
    path: '/licenses',
    name: 'Licenses',
    component: () => import('../views/Licenses.vue'),
    meta: { requiresAuth: true, title: 'Software Licenses' }
  },
  {
    path: '/consumables',
    name: 'Consumables',
    component: () => import('../views/Consumables.vue'),
    meta: { requiresAuth: true, title: 'Consumables' }
  },
  {
    path: '/peripherals',
    name: 'Peripherals',
    component: () => import('../views/Peripherals.vue'),
    meta: { requiresAuth: true, title: 'Peripherals' }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/Reports.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Reports' }
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: () => import('../views/Maintenance.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Maintenance' }
  },
  {
    path: '/my-items',
    name: 'MyItems',
    component: () => import('../views/MyItems.vue'),
    meta: { requiresAuth: true, title: 'My Items' }
  },
  {
    path: '/labels',
    name: 'Labels',
    component: () => import('../views/Labels.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'QR Labels' }
  },
  {
    path: '/audits',
    name: 'Audits',
    component: () => import('../views/Audits.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Audits' }
  },
  {
    path: '/my-team',
    name: 'DirectReports',
    component: () => import('../views/DirectReports.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'My Team' }
  },
  {
    path: '/manufacturers',
    name: 'Manufacturers',
    component: () => import('../views/Manufacturers.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Manufacturers' }
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    component: () => import('../views/Suppliers.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Suppliers' }
  },
  {
    path: '/kits',
    name: 'Kits',
    component: () => import('../views/Kits.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Kits' }
  },
  {
    path: '/components',
    name: 'Components',
    component: () => import('../views/Components.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Components' }
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('../views/Import.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Import' }
  },
  {
    path: '/recycle-bin',
    name: 'RecycleBin',
    component: () => import('../views/RecycleBin.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Recycle Bin' }
  },
  {
    path: '/categories',
    name: 'Categories',
    component: () => import('../views/Categories.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Categories' }
  },
  {
    path: '/statuses',
    name: 'Statuses',
    component: () => import('../views/Statuses.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Statuses' }
  },
  {
    path: '/departments',
    name: 'Departments',
    component: () => import('../views/Departments.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Departments' }
  },
  {
    path: '/depreciations',
    name: 'Depreciations',
    component: () => import('../views/Depreciations.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Depreciations' }
  },
  {
    path: '/workflows',
    name: 'Workflows',
    component: () => import('../views/Workflows.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'Automations' }
  },
  {
    path: '/custom-fields',
    name: 'CustomFields',
    component: () => import('../views/CustomFields.vue'),
    meta: { requiresAuth: true, roles: ['admin'], title: 'Custom Fields' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true, roles: ['admin'], title: 'Settings' }
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('../views/Billing.vue'),
    meta: { requiresAuth: true, roles: ['admin'], title: 'Billing & Plans' }
  },

  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true, roles: ['admin'], title: 'Administration' }
  },
  {
    path: '/ai-logs',
    name: 'AILogs',
    component: () => import('../views/AILogs.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'], title: 'AI Logs' }
  },
  {
    path: '/privacy',
    name: 'Privacy',
    component: () => import('../views/Privacy.vue'),
    meta: { requiresAuth: true, title: 'Privacy & Data' }
  },
  {
    path: '/guides/:slug',
    name: 'SetupGuide',
    component: () => import('../views/SetupGuide.vue'),
    meta: { title: 'Integration Setup Guide', description: 'Step-by-step setup guide for connecting your tools to AssetNode. MDM, HR, SSO and SCIM integrations with screenshots.' }
  },

  {
    path: '/super-admin',
    name: 'SuperAdmin',
    component: () => import('../views/SuperAdmin.vue'),
    meta: { requiresAuth: true, roles: ['superAdmin'], title: 'Platform Super-Admin' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  }
})

const MARKETING_DOMAIN = 'asset-node.com'
const APP_DOMAIN = 'app.asset-node.com'

const MARKETING_ROUTES = new Set([
  'Landing', 'Pricing', 'Integrations', 'ApiDocs', 'About',
  'Blog', 'BlogExcelVsItam', 'BlogSnipeItVsAssetNode', 'BlogBlueTallyVsAssetNode',
  'BlogItOffboarding', 'BlogDsgvoItam', 'BlogLaptopOnboarding',
  'Changelog', 'Careers', 'FAQ',
  'PrivacyPolicy', 'TermsOfService', 'Imprint', 'SetupGuide'
])



const APP_ROUTES = new Set([
  'SignIn', 'SignUp', 'ForgotPassword', 'ResetPassword', 'AcceptInvite'
])

function isProduction(): boolean {
  const hostname = window.location.hostname
  return hostname === MARKETING_DOMAIN || hostname === APP_DOMAIN
}

function isMarketingDomain(): boolean {
  return window.location.hostname === MARKETING_DOMAIN
}

function isAppDomain(): boolean {
  return window.location.hostname === APP_DOMAIN
}

router.beforeEach(async (to, _from, next) => {
  document.title = to.meta.title ? `${to.meta.title} | AssetNode` : 'AssetNode — IT-Asset-Management-Software'

  const descTag = document.querySelector('meta[name="description"]') || (() => {
    const tag = document.createElement('meta')
    tag.setAttribute('name', 'description')
    document.head.appendChild(tag)
    return tag
  })()
  if (to.meta.description) {
    descTag.setAttribute('content', to.meta.description)
  } else {
    descTag.setAttribute('content', 'AssetNode — IT-Asset-Management-Plattform für wachsende Teams.')
  }

  const robotsTag = document.querySelector('meta[name="robots"]')
  if (robotsTag) {
    robotsTag.setAttribute(
      'content',
      to.meta.indexable === false || to.meta.requiresAuth
        ? 'noindex, nofollow'
        : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
    )
  }

  const canonical = document.querySelector('link[rel="canonical"]')
  if (canonical) {
    canonical.setAttribute('href', `https://asset-node.com${to.path}`)
  }

  const ogUrl = document.querySelector('meta[property="og:url"]')
  if (ogUrl) {
    ogUrl.setAttribute('content', `https://asset-node.com${to.path}`)
  }

  const pageTitle = to.meta.title ? `${to.meta.title} | AssetNode` : 'AssetNode — IT-Asset-Management für wachsende Teams'
  const pageDesc = to.meta.description || 'AssetNode — IT-Asset-Management-Plattform für wachsende Teams.'

  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', pageTitle)

  const ogDesc = document.querySelector('meta[property="og:description"]')
  if (ogDesc) ogDesc.setAttribute('content', pageDesc)

  const twTitle = document.querySelector('meta[name="twitter:title"]')
  if (twTitle) twTitle.setAttribute('content', pageTitle)

  const twDesc = document.querySelector('meta[name="twitter:description"]')
  if (twDesc) twDesc.setAttribute('content', pageDesc)

  if (isProduction()) {
    const routeName = to.name as string

    if (isAppDomain() && MARKETING_ROUTES.has(routeName)) {
      window.location.href = `https://${MARKETING_DOMAIN}${to.fullPath}`
      return
    }

    if (isMarketingDomain() && (APP_ROUTES.has(routeName) || to.meta.requiresAuth)) {
      window.location.href = `https://${APP_DOMAIN}${to.fullPath}`
      return
    }
  }

  if (!to.meta.requiresAuth) {
    return next()
  }

  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    const restored = await authStore.fetchCurrentUser()
    if (!restored) {
      return next({ name: 'SignIn', query: { redirect: to.fullPath } })
    }
  }

  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!authStore.hasRole(...to.meta.roles)) {
      return next({ name: 'Dashboard' })
    }
  }

  next()
})



router.afterEach((to, from) => {
  import('../composables/useClientLogBuffer').then(({ pushLog }) => {


    pushLog('route', `${from.path || '∅'} → ${to.path}`)
  }).catch(() => {  })
})

export default router
