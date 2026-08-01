import { When, Then } from '@badeball/cypress-cucumber-preprocessor'


When('I visit the employees page', () => {
  cy.visit('/employees')
})

When('I click the add employee button', () => {
  cy.get('[data-testid="add-employee-button"], [data-testid="create-employee-button"]')
    .first()
    .click()
})

When('I fill in the first name {string}', (firstName: string) => {
  cy.get('[data-testid="first-name-input"], input[name="firstName"]')
    .first()
    .clear()
    .type(firstName)
})

When('I fill in the last name {string}', (lastName: string) => {
  cy.get('[data-testid="last-name-input"], input[name="lastName"]')
    .first()
    .clear()
    .type(lastName)
})

When('I fill in the employee email {string}', (email: string) => {
  cy.get('[data-testid="email-input"], input[name="email"]')
    .first()
    .clear()
    .type(email)
})

When('I submit the employee form', () => {
  cy.get('[data-testid="save-employee-button"], button[type="submit"]')
    .filter(':visible')
    .first()
    .click()
})


Then('I should see the employees list', () => {
  cy.get('.v-data-table, .v-table, table, [data-testid="employees-table"]', { timeout: 10000 })
    .should('be.visible')
})

Then('I should see employees from the organization', () => {
  cy.get('tbody tr, .v-data-table__tr').should('have.length.greaterThan', 0)
})

Then('I should see the employee creation form', () => {
  cy.get('.v-dialog, .v-card, [data-testid="employee-form"]', { timeout: 5000 })
    .should('be.visible')
})
