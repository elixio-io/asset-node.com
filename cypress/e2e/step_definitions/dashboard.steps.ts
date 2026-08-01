import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


Then('I should see the dashboard page', () => {
  cy.url().should('include', '/dashboard')
})

Then('I should see the page title {string}', (title: string) => {
  cy.contains(new RegExp(title, 'i')).should('be.visible')
})

Then('I should see summary cards with asset statistics', () => {
  cy.get('.v-card, [data-testid*="kpi"], [data-testid*="stat"]', { timeout: 10000 })
    .should('have.length.greaterThan', 0)
})

Then('I should see the navigation sidebar', () => {
  cy.get('.v-navigation-drawer, nav, [data-testid="sidebar"]')
    .should('be.visible')
})


When('I click on {string} in the sidebar', (linkText: string) => {
  cy.contains('a, .v-list-item', new RegExp(linkText, 'i'))
    .first()
    .click()
})


Then('I should be on the hardware page', () => {
  cy.url().should('include', '/hardware')
})

Then('I should be on the employees page', () => {
  cy.url().should('include', '/employees')
})
