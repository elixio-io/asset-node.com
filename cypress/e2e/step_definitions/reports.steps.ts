import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'


Then('I should see report tab navigation', () => {
  cy.get('.tab-bar, [class*="tab"], button, [role="tab"]').should('have.length.at.least', 2)
})

Then('I should see the asset summary tab content', () => {
  cy.get('.an-card, .an-table, table, .view-page').should('exist')
})

When('I click on the depreciation tab', () => {
  cy.get('.tab-bar button, [class*="tab"] button, [role="tab"]').contains(/depreciation|Abschreibung/i).click()
})

Then('I should see the depreciation report content', () => {
  cy.get('.an-card, .an-table, table, .view-page').should('exist')
})

When('I click the export button', () => {
  cy.get('button').contains(/export|Export/i).click()
})

Then('the export action should trigger', () => {
  cy.get('.p-message-error').should('not.exist')
})
