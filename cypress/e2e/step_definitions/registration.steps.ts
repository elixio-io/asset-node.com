import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

Given('I am on the sign-up page', () => {
  cy.visit('/sign-up')
})

Then('I should see the registration form', () => {
  cy.get('form').should('exist')
})

Then('I should see fields for first name, last name, email, and password', () => {
  cy.get('input').should('have.length.at.least', 3)
})

When('I fill in the registration form with valid data', () => {
  const unique = Date.now()
  cy.get('input[type="text"], input[placeholder*="name" i], input[placeholder*="Name" i]').first().type(`Test${unique}`)
  cy.get('input[type="email"], input[placeholder*="email" i]').first().type(`testuser${unique}@example.com`)
  cy.get('input[type="password"]').first().type('SecurePass123!')
})

When('I submit the registration form', () => {
  cy.get('form').submit()
})


When('I submit the registration form without filling in required fields', () => {
  cy.get('form').submit()
})

Then('I should see validation errors', () => {
  cy.get('.p-message-error, .p-invalid, [class*="error"], [class*="invalid"]').should('exist')
})

Then('I should remain on the sign-up page', () => {
  cy.url().should('include', '/sign-up')
})

When('I fill in the registration form with email {string}', (email: string) => {
  cy.get('input[type="text"], input[placeholder*="name" i], input[placeholder*="Name" i]').first().type('Duplicate')
  cy.get('input[type="email"], input[placeholder*="email" i]').first().type(email)
  cy.get('input[type="password"]').first().type('SecurePass123!')
})

Then('I should see an error about the email already being in use', () => {
  cy.get('.p-message-error, [class*="error"], [class*="toast"]').should('exist')
})
