import { When, Then } from '@badeball/cypress-cucumber-preprocessor'


When('I visit the categories page', () => { cy.visit('/categories') })
When('I visit the statuses page', () => { cy.visit('/statuses') })
When('I visit the custom-fields page', () => { cy.visit('/custom-fields') })
When('I visit the company-profile page', () => { cy.visit('/company-profile') })
When('I visit the audits page', () => { cy.visit('/audits') })
When('I visit the labels page', () => { cy.visit('/labels') })
When('I visit the depreciations page', () => { cy.visit('/depreciations') })
When('I visit the import page', () => { cy.visit('/import') })
When('I visit the recycle-bin page', () => { cy.visit('/recycle-bin') })
When('I visit the kits page', () => { cy.visit('/kits') })
When('I visit the components page', () => { cy.visit('/components') })
When('I visit the my-team page', () => { cy.visit('/my-team') })
When('I visit the marketplace page', () => { cy.visit('/marketplace') })


Then('I should see the categories page title', () => {
  cy.contains('h1, h2, .page-title', /categor|kategor/i).should('be.visible')
})

Then('I should see the statuses page title', () => {
  cy.contains('h1, h2, .page-title', /status|stati/i).should('be.visible')
})

Then('I should see the custom fields page title', () => {
  cy.contains('h1, h2, .page-title', /custom field|benutzerdefinierte/i).should('be.visible')
})

Then('I should see the company profile page title', () => {
  cy.contains('h1, h2, .page-title', /company|unternehmen|profil/i).should('be.visible')
})

Then('I should see the audits page title', () => {
  cy.contains('h1, h2, .page-title', /audit|protokoll/i).should('be.visible')
})

Then('I should see the labels page title', () => {
  cy.contains('h1, h2, .page-title', /label|etiketten/i).should('be.visible')
})

Then('I should see the depreciations page title', () => {
  cy.contains('h1, h2, .page-title', /depreci|abschreib/i).should('be.visible')
})

Then('I should see the import page title', () => {
  cy.contains('h1, h2, .page-title', /import/i).should('be.visible')
})

Then('I should see the recycle bin page title', () => {
  cy.contains('h1, h2, .page-title', /recycle|papierkorb|trash/i).should('be.visible')
})

Then('I should see the kits page title', () => {
  cy.contains('h1, h2, .page-title', /kit|set/i).should('be.visible')
})

Then('I should see the components page title', () => {
  cy.contains('h1, h2, .page-title', /component|komponente/i).should('be.visible')
})

Then('I should see the my team page title', () => {
  cy.contains('h1, h2, .page-title', /my team|mein team/i).should('be.visible')
})


Then('I should see a list of categories or an empty state', () => {
  cy.get('.p-datatable, table, .p-card, .empty-state, [class*="empty"]').should('be.visible')
})

Then('I should see a list of statuses or an empty state', () => {
  cy.get('.p-datatable, table, .p-card, .empty-state, [class*="empty"]').should('be.visible')
})

Then('I should see custom field definitions or an empty state', () => {
  cy.get('.p-datatable, table, .p-card, .empty-state, [class*="empty"]').should('be.visible')
})

Then('I should see audit log entries or an empty state', () => {
  cy.get('.p-datatable, table, .p-card, .empty-state, [class*="empty"]').should('be.visible')
})

Then('I should see team members or an empty state', () => {
  cy.get('.p-datatable, table, .p-card, .empty-state, [class*="empty"]').should('be.visible')
})


Then('I should see the marketplace search bar', () => {
  cy.get('input[placeholder*="earch"], input[placeholder*="uche"], .p-inputtext')
    .should('be.visible')
})

Then('I should see the marketplace title', () => {
  cy.contains('h1, h2, .page-title', /market|marktplatz/i).should('be.visible')
})

When('I enter {string} in the marketplace search', (query: string) => {
  cy.get('input[placeholder*="earch"], input[placeholder*="uche"], .p-inputtext')
    .first()
    .clear()
    .type(query)
})

When('I click the marketplace search button', () => {
  cy.get('button .pi-search, button[type="submit"]')
    .closest('button')
    .first()
    .click()
})

Then('I should see product results or a loading indicator', () => {
  cy.get('.p-card, .product-card, .p-skeleton, .p-progressspinner, [class*="loading"]', { timeout: 10000 })
    .should('be.visible')
})

Then('the marketplace search button should be disabled', () => {
  cy.get('button .pi-search, button[type="submit"]')
    .closest('button')
    .first()
    .should('be.disabled')
})
