import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

When('I visit the assignments page', () => {
  cy.visit('/assignments')
})

Then('I should see the assignments table', () => {
  cy.get('.an-table, table').should('exist')
})

Then('I should see assigned hardware with employee names', () => {
  cy.get('.an-table tbody tr, table tbody tr').should('have.length.at.least', 0)
})

When('I click the edit button on the first assignment', () => {
  cy.get('.an-table tbody tr, table tbody tr').first().within(() => {
    cy.get('button[class*="pencil"], button .pi-pencil').first().click({ force: true })
  })
})

Then('I should see an employee selection dropdown', () => {
  cy.get('.p-select, .employee-select, select').should('exist')
})

When('I click the return button on an assignment', () => {
  cy.get('.an-table tbody tr, table tbody tr').first().within(() => {
    cy.get('button .pi-undo, button[class*="undo"]').first().click({ force: true })
  })
})

Then('the assignment should be removed from the list', () => {
  cy.get('.an-table, table').should('exist')
})
