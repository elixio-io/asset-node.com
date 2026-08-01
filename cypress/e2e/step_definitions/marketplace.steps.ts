import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

When('I visit the marketplace page', () => {
  cy.visit('/marketplace')
})

Then('I should see the marketplace search bar', () => {
  cy.get('.mp-search-bar, input[placeholder*="search" i], input[placeholder*="Such" i]').should('exist')
})

Then('I should see the marketplace title', () => {
  cy.get('h1').should('exist')
})

When('I enter {string} in the marketplace search', (query: string) => {
  cy.get('.mp-search-bar input, input[placeholder*="search" i], input[placeholder*="Such" i]').first().clear().type(query)
})

When('I click the marketplace search button', () => {
  cy.get('.mp-search-btn, button').contains(/search|Such/i).click()
})

Then('I should see product results or a loading indicator', () => {
  cy.get('.mp-grid, .mp-loading, .mp-results, .mp-error, [class*="no-results"]').should('exist')
})

Then('the marketplace search button should be disabled', () => {
  cy.get('.mp-search-btn, button').contains(/search|Such/i).should('be.disabled')
})
