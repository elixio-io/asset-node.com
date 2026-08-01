import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


Given('I am on the sign-in page', () => {
  cy.visit('/sign-in')
})

Given('I am not logged in', () => {
  cy.clearLocalStorage()
})

Given('I am logged in as admin', () => {
  cy.loginAsAdmin()
})

Given('I am logged in as manager', () => {
  cy.loginAsManager()
})

Given('I am logged in as employee', () => {
  cy.loginAsEmployee()
})

Given('I am on the dashboard', () => {
  cy.visit('/dashboard')
})


When('I enter {string} as the email', (email: string) => {
  cy.get('input[type="email"], input[name="email"], [data-testid="email-input"]')
    .first()
    .clear()
    .type(email)
})

When('I enter {string} as the password', (password: string) => {
  cy.get('input[type="password"], input[name="password"], [data-testid="password-input"]')
    .first()
    .clear()
    .type(password)
})

When('I click the sign-in button', () => {
  cy.get('button[type="submit"], [data-testid="login-button"]')
    .first()
    .click()
})

When('I try to visit the hardware page', () => {
  cy.visit('/hardware')
})

When('I click the logout button', () => {
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="logout-button"]').length > 0) {
      cy.getByTestId('logout-button').click()
    } else if ($body.find('[data-testid="user-menu"]').length > 0) {
      cy.getByTestId('user-menu').click()
      cy.contains(/logout|sign out|abmelden/i).click()
    } else {
      cy.contains(/logout|sign out|abmelden/i).click()
    }
  })
})


Then('I should see the sign-in form', () => {
  cy.contains(/sign in/i).should('be.visible')
})

Then('I should see an email input field', () => {
  cy.get('input[type="email"], input[name="email"], [data-testid="email-input"]')
    .first()
    .should('be.visible')
})

Then('I should see a password input field', () => {
  cy.get('input[type="password"], input[name="password"], [data-testid="password-input"]')
    .first()
    .should('be.visible')
})

Then('I should be redirected to the dashboard', () => {
  cy.url().should('include', '/dashboard', { timeout: 15000 })
})

Then('I should see an error message', () => {
  cy.contains(/invalid|error|incorrect|falsch/i).should('be.visible')
})

Then('I should remain on the sign-in page', () => {
  cy.url().should('include', '/sign-in')
})

Then('I should be redirected to the sign-in page', () => {
  cy.url().should('include', '/sign-in', { timeout: 10000 })
})
