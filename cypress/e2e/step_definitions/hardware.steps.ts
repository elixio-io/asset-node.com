import { When, Then } from '@badeball/cypress-cucumber-preprocessor'


When('I visit the hardware page', () => {
  cy.visit('/hardware')
})

When('I click the add hardware button', () => {
  cy.get('[data-testid="add-hardware-button"], [data-testid="create-hardware-button"]')
    .first()
    .click()
})

When('I fill in the serial number {string}', (serial: string) => {
  cy.get('[data-testid="serial-number-input"], input[name="serialNumber"]')
    .first()
    .clear()
    .type(serial)
})

When('I fill in the model {string}', (model: string) => {
  cy.get('[data-testid="model-input"], input[name="model"]')
    .first()
    .clear()
    .type(model)
})

When('I submit the hardware form', () => {
  cy.get('[data-testid="save-hardware-button"], button[type="submit"]')
    .filter(':visible')
    .first()
    .click()
})

When('I search for {string}', (query: string) => {
  cy.get('[data-testid="search-input"], input[type="search"], input[placeholder*="earch"]')
    .first()
    .clear()
    .type(query)
})


Then('I should see the hardware list', () => {
  cy.get('.v-data-table, .v-table, table, [data-testid="hardware-table"]', { timeout: 10000 })
    .should('be.visible')
})

Then('I should see hardware assets from the inventory', () => {
  cy.get('tbody tr, .v-data-table__tr').should('have.length.greaterThan', 0)
})

Then('I should see results containing {string}', (text: string) => {
  cy.contains(new RegExp(text, 'i')).should('be.visible')
})

Then('I should see the hardware creation form', () => {
  cy.get('.v-dialog, .v-card, [data-testid="hardware-form"]', { timeout: 5000 })
    .should('be.visible')
})

Then('I should see a success confirmation', () => {
  cy.contains(/success|created|gespeichert|hinzugefügt/i, { timeout: 10000 })
    .should('be.visible')
})
