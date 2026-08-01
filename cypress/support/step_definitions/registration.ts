import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

Given('I am on the sign-up page', () => {
  cy.visit('/sign-up')
})

Then('I should see the registration form', () => {
  cy.get('form').should('be.visible')
})

Then('I should see fields for first name, last name, email, and password', () => {
  cy.get('form input').should('have.length.greaterThan', 3)
})

When('I fill in the registration form with valid data', () => {
  const uniqueId = Date.now()
  cy.get('input[name="firstName"], input[placeholder*="irst"], input[placeholder*="orname"]')
    .first()
    .clear()
    .type('Cypress')
  cy.get('input[name="lastName"], input[placeholder*="ast"], input[placeholder*="achname"]')
    .first()
    .clear()
    .type('TestUser')
  cy.get('input[type="email"], input[name="email"]')
    .clear()
    .type(`cypress-${uniqueId}@test.com`)
  cy.get('input[type="password"], input[name="password"]')
    .first()
    .clear()
    .type('TestPassword123!')
  cy.get('body').then($body => {
    const orgInput = $body.find('input[name="orgName"], input[placeholder*="rganiz"], input[placeholder*="nternehmen"]')
    if (orgInput.length) {
      cy.wrap(orgInput).first().clear().type(`TestOrg-${uniqueId}`)
    }
  })
})

When('I submit the registration form', () => {
  cy.get('form button[type="submit"]').click()
})

When('I submit the registration form without filling in required fields', () => {
  cy.get('form button[type="submit"]').click()
})

Then('I should see validation errors', () => {
  cy.get('.p-message-error, .p-invalid, .field-error, [class*="error"], [class*="invalid"]')
    .should('be.visible')
})

Then('I should remain on the sign-up page', () => {
  cy.url().should('include', '/sign-up')
})

When('I fill in the registration form with email {string}', (email: string) => {
  cy.get('input[name="firstName"], input[placeholder*="irst"]')
    .first()
    .clear()
    .type('Duplicate')
  cy.get('input[name="lastName"], input[placeholder*="ast"]')
    .first()
    .clear()
    .type('User')
  cy.get('input[type="email"], input[name="email"]')
    .clear()
    .type(email)
  cy.get('input[type="password"], input[name="password"]')
    .first()
    .clear()
    .type('TestPassword123!')
  cy.get('body').then($body => {
    const orgInput = $body.find('input[name="orgName"], input[placeholder*="rganiz"]')
    if (orgInput.length) {
      cy.wrap(orgInput).first().clear().type('DuplicateTestOrg')
    }
  })
})

Then('I should see an error about the email already being in use', () => {
  cy.get('.p-toast-message-error, .p-message-error, [role="alert"], [class*="error"]')
    .should('be.visible')
})
