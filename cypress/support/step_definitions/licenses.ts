import { When, Then } from '@badeball/cypress-cucumber-preprocessor'

When('I visit the licenses page', () => {
  cy.visit('/licenses')
})

Then('I should see the licenses page title', () => {
  cy.contains('h1, h2, .page-title', /licen/i).should('be.visible')
})

Then('I should see the add license button', () => {
  cy.get('.pi-plus').closest('button').should('be.visible')
})

Then('I should see license summary statistics', () => {
  cy.get('.p-card, .summary-card, .kpi-card, [class*="card"]')
    .should('have.length.greaterThan', 0)
})

When('I search for a license by name', () => {
  cy.get('input[placeholder*="earch"], input[placeholder*="uche"], .p-inputtext')
    .first()
    .clear()
    .type('Microsoft')
})

Then('I should see filtered license results', () => {
  cy.get('.p-datatable, table, .empty-state').should('be.visible')
})

When('I click the add license button', () => {
  cy.get('.pi-plus').closest('button').first().click()
})

Then('I should see the license creation dialog', () => {
  cy.get('.p-dialog, [role="dialog"]').should('be.visible')
})

Then('I should see fields for name, publisher, type, and seats', () => {
  cy.get('.p-dialog, [role="dialog"]').within(() => {
    cy.get('input, .p-select, .p-dropdown').should('have.length.greaterThan', 2)
  })
})

When('I fill in the license name {string}', (name: string) => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('input')
    .first()
    .clear()
    .type(name)
})

When('I fill in the license publisher {string}', (publisher: string) => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('input')
    .eq(1)
    .clear()
    .type(publisher)
})

When('I select license type {string}', (type: string) => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('.p-select, .p-dropdown')
    .first()
    .click()
  cy.get('.p-select-option, .p-dropdown-item, li[role="option"]')
    .contains(new RegExp(type, 'i'))
    .click()
})

When('I fill in the number of seats {string}', (seats: string) => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('input[type="number"], .p-inputnumber input')
    .first()
    .clear()
    .type(seats)
})

When('I submit the license form', () => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('button[type="submit"], button.p-button')
    .filter(':contains("Save"), :contains("Create"), :contains("Speichern"), :contains("Erstellen")')
    .first()
    .click()
})
