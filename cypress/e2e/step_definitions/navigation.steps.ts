import { When, Then } from '@badeball/cypress-cucumber-preprocessor'


When('I visit the {string} page', (page: string) => {
  cy.visit(`/${page}`)
})


Then('I should not be redirected to sign-in', () => {
  cy.url().should('not.include', '/sign-in')
})

Then('I should be on the {string} page', (page: string) => {
  cy.url().should('include', `/${page}`)
})
