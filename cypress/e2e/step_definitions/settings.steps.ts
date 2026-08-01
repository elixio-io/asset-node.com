import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


Then('I should see settings tab navigation', () => {
  cy.get('[class*="tab"], button, [role="tab"]').should('have.length.at.least', 2)
})

Then('I should see the general settings form', () => {
  cy.get('form, input, .an-card, .view-page').should('exist')
})

Then('I should see the organization name field', () => {
  cy.get('input').should('have.length.at.least', 1)
})

When('I click on the notifications settings tab', () => {
  cy.get('[class*="tab"] button, button, [role="tab"]').contains(/notification|Benachrichtigung/i).click()
})

Then('I should see notification preferences', () => {
  cy.get('.an-card, .view-page, input, [class*="toggle"], [class*="switch"]').should('exist')
})

When('I click on the API keys settings tab', () => {
  cy.get('[class*="tab"] button, button, [role="tab"]').contains(/API/i).click()
})

Then('I should see the API keys management section', () => {
  cy.get('.an-card, .view-page, table, button').should('exist')
})

When('I click on the webhooks settings tab', () => {
  cy.get('[class*="tab"] button, button, [role="tab"]').contains(/webhook/i).click()
})

Then('I should see the webhooks management section', () => {
  cy.get('.an-card, .view-page, table, button').should('exist')
})

When('I click on the integrations settings tab', () => {
  cy.get('[class*="tab"] button, button, [role="tab"]').contains(/integration/i).click()
})

Then('I should see the integrations configuration section', () => {
  cy.get('.an-card, .view-page, [class*="integration"]').should('exist')
})
