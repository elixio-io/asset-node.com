import { When, Then } from '@badeball/cypress-cucumber-preprocessor'


When('I search for {string}', (searchTerm: string) => {
  cy.get('input[placeholder*="earch"], input[placeholder*="uche"], .p-inputtext')
    .first()
    .clear()
    .type(searchTerm)
})

Then('I should see results containing {string}', (text: string) => {
  cy.get('.p-datatable-tbody, table tbody').should('contain.text', text)
})


When('I click the add hardware button', () => {
  cy.get('.pi-plus').closest('button').first().click()
})

Then('I should see the hardware creation form', () => {
  cy.get('.p-dialog, [role="dialog"]').should('be.visible')
})

When('I fill in the serial number {string}', (serial: string) => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('input')
    .filter('[placeholder*="erial"], [name*="serial"]')
    .clear()
    .type(serial)
})

When('I fill in the model {string}', (model: string) => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('input')
    .filter('[placeholder*="odel"], [name*="model"]')
    .clear()
    .type(model)
})

When('I submit the hardware form', () => {
  cy.get('.p-dialog, [role="dialog"]')
    .find('button[type="submit"], button.p-button')
    .filter(':contains("Save"), :contains("Create"), :contains("Speichern"), :contains("Erstellen")')
    .first()
    .click()
})


When('I click the edit button on the first assignment', () => {
  cy.get('.p-datatable-tbody tr, table tbody tr')
    .first()
    .find('button .pi-pencil, button .pi-pen-to-square')
    .closest('button')
    .click({ force: true })
})

Then('I should see an employee selection dropdown', () => {
  cy.get('.p-select, .p-dropdown, select').should('be.visible')
})

When('I click the return button on an assignment', () => {
  cy.get('.p-datatable-tbody tr, table tbody tr')
    .first()
    .find('button .pi-undo, button .pi-replay')
    .closest('button')
    .click({ force: true })
})

Then('the assignment should be removed from the list', () => {
  cy.get('.p-toast-message-success, .p-message-success, [class*="success"]')
    .should('be.visible')
})
