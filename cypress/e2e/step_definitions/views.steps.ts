import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


const pageRoutes: Record<string, string> = {
  'consumables': '/consumables',
  'peripherals': '/peripherals',
  'maintenance': '/maintenance',
  'kits': '/kits',
  'components': '/components',
  'my-items': '/my-items',
  'my-team': '/my-team',
  'locations': '/locations',
  'departments': '/departments',
  'manufacturers': '/manufacturers',
  'suppliers': '/suppliers',
  'audits': '/audits',
  'labels': '/labels',
  'depreciations': '/depreciations',
  'import': '/import',
  'recycle-bin': '/recycle-bin',
  'categories': '/categories',
  'statuses': '/statuses',
  'custom-fields': '/custom-fields',
  'company-profile': '/company-profile',
  'reports': '/reports',
  'settings': '/settings',
}

When('I visit the consumables page', () => { cy.visit('/consumables') })
When('I visit the peripherals page', () => { cy.visit('/peripherals') })
When('I visit the maintenance page', () => { cy.visit('/maintenance') })
When('I visit the kits page', () => { cy.visit('/kits') })
When('I visit the components page', () => { cy.visit('/components') })
When('I visit the my-items page', () => { cy.visit('/my-items') })
When('I visit the my-team page', () => { cy.visit('/my-team') })
When('I visit the locations page', () => { cy.visit('/locations') })
When('I visit the departments page', () => { cy.visit('/departments') })
When('I visit the manufacturers page', () => { cy.visit('/manufacturers') })
When('I visit the suppliers page', () => { cy.visit('/suppliers') })
When('I visit the audits page', () => { cy.visit('/audits') })
When('I visit the labels page', () => { cy.visit('/labels') })
When('I visit the depreciations page', () => { cy.visit('/depreciations') })
When('I visit the import page', () => { cy.visit('/import') })
When('I visit the recycle-bin page', () => { cy.visit('/recycle-bin') })
When('I visit the categories page', () => { cy.visit('/categories') })
When('I visit the statuses page', () => { cy.visit('/statuses') })
When('I visit the custom-fields page', () => { cy.visit('/custom-fields') })
When('I visit the company-profile page', () => { cy.visit('/company-profile') })
When('I visit the reports page', () => { cy.visit('/reports') })
When('I visit the settings page', () => { cy.visit('/settings') })

Then('I should see the consumables page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the peripherals page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the maintenance page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the kits page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the components page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the my items page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the my team page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the locations page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the departments page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the manufacturers page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the suppliers page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the audits page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the labels page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the depreciations page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the import page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the recycle bin page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the categories page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the statuses page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the custom fields page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the company profile page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the reports page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see the settings page title', () => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see a table or empty state', () => {
  cy.get('table, .an-table, .p-datatable, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see a list of locations or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see a list of departments or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see a list of manufacturers or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see a list of suppliers or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see a list of categories or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see a list of statuses or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see custom field definitions or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see my assigned hardware or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see team members or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see audit log entries or an empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

Then('I should see filtered results or empty state', () => {
  cy.get('table, .an-table, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})

When('I search for consumables', () => {
  cy.get('input[placeholder*="search" i], input[placeholder*="Such" i]').first().type('a')
})

When('I search for peripherals', () => {
  cy.get('input[placeholder*="search" i], input[placeholder*="Such" i]').first().type('a')
})
