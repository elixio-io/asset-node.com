import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


const PAGE_ROUTES: Record<string, string> = {
  'dashboard': '/',
  'hardware': '/hardware',
  'employees': '/employees',
  'assignments': '/assignments',
  'available': '/available',
  'defective': '/defective',
  'sales': '/sales',
  'licenses': '/licenses',
  'consumables': '/consumables',
  'peripherals': '/peripherals',
  'marketplace': '/marketplace',
  'reports': '/reports',
  'maintenance': '/maintenance',
  'my-items': '/my-items',
  'my-team': '/my-team',
  'labels': '/labels',
  'audits': '/audits',
  'locations': '/locations',
  'departments': '/departments',
  'manufacturers': '/manufacturers',
  'suppliers': '/suppliers',
  'kits': '/kits',
  'components': '/components',
  'import': '/import',
  'recycle-bin': '/recycle-bin',
  'categories': '/categories',
  'statuses': '/statuses',
  'depreciations': '/depreciations',
  'custom-fields': '/custom-fields',
  'settings': '/settings',
  'admin': '/admin',
  'profile': '/profile',
  'company-profile': '/company-profile',
}


Given('I am logged in as admin', () => {
  cy.loginAsAdmin()
})

Given('I am logged in as manager', () => {
  cy.loginAsManager()
})

Given('I am logged in as employee', () => {
  cy.loginAsEmployee()
})

Given('I am not logged in', () => {
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
})

Given('I am on the sign-in page', () => {
  cy.visit('/sign-in')
})

Given('I am on the dashboard', () => {
  cy.visit('/')
  cy.url().should('not.include', '/sign-in')
})


When('I visit the {string} page', (page: string) => {
  const route = PAGE_ROUTES[page] || `/${page}`
  cy.visit(route)
})

When('I visit the hardware page', () => {
  cy.visit('/hardware')
})

When('I visit the assignments page', () => {
  cy.visit('/assignments')
})

When('I try to visit the hardware page', () => {
  cy.visit('/hardware')
})

When('I click on {string} in the sidebar', (label: string) => {
  cy.get('.layout-sidebar, .p-menuitem, nav').contains(label).click()
})


When('I enter {string} as the email', (email: string) => {
  cy.get('input[type="email"], input[name="email"], #email').clear().type(email)
})

When('I enter {string} as the password', (password: string) => {
  cy.get('input[type="password"], input[name="password"], #password').clear().type(password)
})

When('I click the sign-in button', () => {
  cy.get('button[type="submit"]').click()
})

When('I click the logout button', () => {
  cy.get('body').then($body => {
    if ($body.find('[data-testid="logout-btn"]').length) {
      cy.getByTestId('logout-btn').click()
    } else {
      cy.contains('button', /log\s?out|sign\s?out|abmelden/i).click({ force: true })
    }
  })
})


Then('I should be redirected to the dashboard', () => {
  cy.url().should('satisfy', (url: string) => {
    return url.endsWith('/') || url.includes('/dashboard') || !url.includes('/sign-in')
  })
})

Then('I should be redirected to the sign-in page', () => {
  cy.url().should('include', '/sign-in')
})

Then('I should not be redirected to sign-in', () => {
  cy.url().should('not.include', '/sign-in')
})

Then('I should be on the {string} page', (page: string) => {
  const route = PAGE_ROUTES[page] || `/${page}`
  cy.url().should('include', route)
})

Then('I should be on the hardware page', () => {
  cy.url().should('include', '/hardware')
})

Then('I should be on the employees page', () => {
  cy.url().should('include', '/employees')
})

Then('I should remain on the sign-in page', () => {
  cy.url().should('include', '/sign-in')
})


Then('I should see the sign-in form', () => {
  cy.get('form').should('be.visible')
})

Then('I should see an email input field', () => {
  cy.get('input[type="email"], input[name="email"], #email').should('be.visible')
})

Then('I should see a password input field', () => {
  cy.get('input[type="password"], input[name="password"], #password').should('be.visible')
})

Then('I should see an error message', () => {
  cy.get('.p-message-error, .p-toast-message-error, [role="alert"], .error-message')
    .should('be.visible')
})

Then('I should see the dashboard page', () => {
  cy.url().should('not.include', '/sign-in')
})

Then('I should see the page title {string}', (title: string) => {
  cy.contains('h1, h2, .page-title', title).should('be.visible')
})

Then('I should see summary cards with asset statistics', () => {
  cy.get('.p-card, .summary-card, .kpi-card, [class*="card"]')
    .should('have.length.greaterThan', 0)
})

Then('I should see the navigation sidebar', () => {
  cy.get('.layout-sidebar, nav, .p-menu').should('be.visible')
})

Then('I should see the hardware list', () => {
  cy.get('.p-datatable, table, [class*="table"]').should('be.visible')
})

Then('I should see hardware assets from the inventory', () => {
  cy.get('.p-datatable-tbody tr, table tbody tr').should('have.length.greaterThan', 0)
})

Then('I should see the assignments table', () => {
  cy.get('.p-datatable, table').should('be.visible')
})

Then('I should see assigned hardware with employee names', () => {
  cy.get('.p-datatable-tbody tr, table tbody tr').should('have.length.greaterThan', 0)
})

Then('I should see a success confirmation', () => {
  cy.get('.p-toast-message-success, .p-message-success, [class*="success"]')
    .should('be.visible')
})
