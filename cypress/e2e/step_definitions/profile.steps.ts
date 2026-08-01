import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

When('I visit the profile page', () => {
  cy.visit('/profile')
})

Then('I should see my profile information', () => {
  cy.get('.view-page, .view-inner').should('exist')
})

Then('I should see my email address', () => {
  cy.get('input[disabled]').should('exist')
})

Then('I should see my first and last name', () => {
  cy.get('input').should('have.length.at.least', 2)
})

When('I update my first name to {string}', (name: string) => {
  cy.get('input').first().clear().type(name)
})

When('I save my profile changes', () => {
  cy.get('button[type="submit"]').click()
})

Then('I should see a success message', () => {
  cy.get('.p-message-success, .p-toast, [class*="success"]').should('exist')
})

When('I click the change password button', () => {
  cy.contains('button', /password|Passwort/i).click()
})

Then('I should see the password change dialog', () => {
  cy.get('.p-dialog').should('be.visible')
})

Then('I should see fields for current and new password', () => {
  cy.get('.p-dialog input[type="password"]').should('have.length.at.least', 2)
})
