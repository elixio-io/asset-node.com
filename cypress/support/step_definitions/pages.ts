import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


When('I visit the maintenance page', () => {
  cy.visit('/maintenance')
})

When('I visit the consumables page', () => {
  cy.visit('/consumables')
})

When('I visit the peripherals page', () => {
  cy.visit('/peripherals')
})

When('I visit the settings page', () => {
  cy.visit('/settings')
})

When('I visit the reports page', () => {
  cy.visit('/reports')
})

When('I visit the profile page', () => {
  cy.visit('/profile')
})

When('I visit the my-items page', () => {
  cy.visit('/my-items')
})

When('I visit the available assets page', () => {
  cy.visit('/available')
})

When('I visit the defective assets page', () => {
  cy.visit('/defective')
})

When('I visit the sales page', () => {
  cy.visit('/sales')
})


Then('I should see the maintenance page title', () => {
  cy.contains('h1, h2, .page-title', /maintenance|wartung/i).should('be.visible')
})

Then('I should see the consumables page title', () => {
  cy.contains('h1, h2, .page-title', /consumable|verbrauchsmaterial/i).should('be.visible')
})

Then('I should see the peripherals page title', () => {
  cy.contains('h1, h2, .page-title', /peripheral|peripherie/i).should('be.visible')
})

Then('I should see the settings page title', () => {
  cy.contains('h1, h2, .page-title', /setting|einstellung/i).should('be.visible')
})

Then('I should see the reports page title', () => {
  cy.contains('h1, h2, .page-title', /report|bericht/i).should('be.visible')
})

Then('I should see the my items page title', () => {
  cy.contains('h1, h2, .page-title', /my items|meine geräte/i).should('be.visible')
})


Then('I should see a table or empty state', () => {
  cy.get('.p-datatable, table, .empty-state, [class*="empty"]').should('be.visible')
})

Then('I should see a table or empty state message', () => {
  cy.get('.p-datatable, table, .empty-state, [class*="empty"]').should('be.visible')
})

Then('I should see my assigned hardware or an empty state', () => {
  cy.get('.p-datatable, table, .p-card, .empty-state, [class*="empty"]').should('be.visible')
})


When('I search for consumables', () => {
  cy.get('input[placeholder*="earch"], input[placeholder*="uche"], .p-inputtext')
    .first()
    .clear()
    .type('USB')
})

When('I search for peripherals', () => {
  cy.get('input[placeholder*="earch"], input[placeholder*="uche"], .p-inputtext')
    .first()
    .clear()
    .type('Monitor')
})

Then('I should see filtered results or empty state', () => {
  cy.get('.p-datatable, table, .empty-state, [class*="empty"]').should('be.visible')
})


Then('I should see settings tab navigation', () => {
  cy.get('.p-tabmenu, .p-tabs, [role="tablist"]').should('be.visible')
})

Then('I should see the general settings form', () => {
  cy.get('form, .settings-form, .p-card').should('be.visible')
})

Then('I should see the organization name field', () => {
  cy.get('input').should('have.length.greaterThan', 0)
})

When('I click on the notifications settings tab', () => {
  cy.contains('.p-tabmenu-nav a, [role="tab"], .p-tab', /notif|benachricht/i).click()
})

Then('I should see notification preferences', () => {
  cy.get('.p-card, form, .p-toggleswitch, .p-checkbox, .p-inputswitch').should('be.visible')
})

When('I click on the API keys settings tab', () => {
  cy.contains('.p-tabmenu-nav a, [role="tab"], .p-tab', /api/i).click()
})

Then('I should see the API keys management section', () => {
  cy.get('.p-card, .p-datatable, table').should('be.visible')
})

When('I click on the webhooks settings tab', () => {
  cy.contains('.p-tabmenu-nav a, [role="tab"], .p-tab', /webhook/i).click()
})

Then('I should see the webhooks management section', () => {
  cy.get('.p-card, .p-datatable, table').should('be.visible')
})

When('I click on the integrations settings tab', () => {
  cy.contains('.p-tabmenu-nav a, [role="tab"], .p-tab', /integr/i).click()
})

Then('I should see the integrations configuration section', () => {
  cy.get('.p-card, .integration-card, [class*="card"]').should('be.visible')
})


Then('I should see report tab navigation', () => {
  cy.get('.p-tabmenu, .p-tabs, [role="tablist"]').should('be.visible')
})

Then('I should see the asset summary tab content', () => {
  cy.get('.p-card, .p-datatable, table, .chart-container, canvas').should('be.visible')
})

When('I click on the depreciation tab', () => {
  cy.contains('.p-tabmenu-nav a, [role="tab"], .p-tab', /depreci|abschreib/i).click()
})

Then('I should see the depreciation report content', () => {
  cy.get('.p-card, .p-datatable, table, canvas').should('be.visible')
})

When('I click the export button', () => {
  cy.contains('button', /export/i).click({ force: true })
})

Then('the export action should trigger', () => {
  cy.get('.p-toast-message-error').should('not.exist')
})


Then('I should see my profile information', () => {
  cy.get('.p-card, form').should('be.visible')
})

Then('I should see my email address', () => {
  cy.get('input[type="email"], input[name="email"]').should('be.visible')
})

Then('I should see my first and last name', () => {
  cy.get('input[name="firstName"], input[name="first_name"], input')
    .should('have.length.greaterThan', 1)
})

When('I update my first name to {string}', (name: string) => {
  cy.get('input[name="firstName"], input[name="first_name"], input')
    .first()
    .clear()
    .type(name)
})

When('I save my profile changes', () => {
  cy.contains('button', /save|speichern/i).click()
})

Then('I should see a success message', () => {
  cy.get('.p-toast-message-success, .p-message-success, [class*="success"]')
    .should('be.visible')
})

When('I click the change password button', () => {
  cy.contains('button', /password|passwort|ändern/i).click()
})

Then('I should see the password change dialog', () => {
  cy.get('.p-dialog, [role="dialog"]').should('be.visible')
})

Then('I should see fields for current and new password', () => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('input[type="password"]')
    .should('have.length.greaterThan', 1)
})
