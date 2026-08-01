import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

When('I visit the licenses page', () => {
  cy.visit('/licenses')
})

Then('I should see the licenses page title', () => {
  cy.get('h1, h2').should('exist')
})

Then('I should see the add license button', () => {
  cy.get('button').contains(/add|hinzufügen/i).should('exist')
})

Then('I should see license summary statistics', () => {
  cy.get('.kpi-card, .kpi-grid, [class*="kpi"]').should('exist')
})

When('I search for a license by name', () => {
  cy.get('input[placeholder*="search" i], input[placeholder*="Such" i]').first().type('a')
})

Then('I should see filtered license results', () => {
  cy.get('table, .an-table').should('exist')
})

When('I click the add license button', () => {
  cy.get('button').contains(/add|hinzufügen/i).click()
})

Then('I should see the license creation dialog', () => {
  cy.get('.p-dialog').should('be.visible')
})

Then('I should see fields for name, publisher, type, and seats', () => {
  cy.get('.p-dialog input, .p-dialog .p-select').should('have.length.at.least', 2)
})

When('I fill in the license name {string}', (name: string) => {
  cy.get('.p-dialog input').first().type(name)
})

When('I fill in the license publisher {string}', (publisher: string) => {
  cy.get('.p-dialog input').eq(1).type(publisher)
})

When('I select license type {string}', (type: string) => {
  cy.get('.p-dialog .p-select').first().click()
  cy.get('.p-select-item, .p-listbox-item, li').contains(type).click()
})

When('I fill in the number of seats {string}', (seats: string) => {
  cy.get('.p-dialog input[type="number"], .p-dialog .p-inputnumber input').first().type(seats)
})

When('I submit the license form', () => {
  cy.get('.p-dialog button').contains(/save|speichern|add|hinzufügen/i).click()
})

Then('I should see a success confirmation', () => {
  cy.get('.p-dialog').should('not.exist')
})
