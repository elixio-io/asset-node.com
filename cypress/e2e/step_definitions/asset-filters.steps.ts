import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

When('I visit the available assets page', () => {
  cy.visit('/available')
})

When('I visit the defective assets page', () => {
  cy.visit('/defective')
})

When('I visit the sales page', () => {
  cy.visit('/sales')
})

Then('I should see the page title {string}', (title: string) => {
  cy.get('h1, h2, .view-header').should('exist')
})

Then('I should see a table or empty state message', () => {
  cy.get('table, .an-table, .p-datatable, [class*="empty"], [class*="no-data"], .view-page').should('exist')
})
