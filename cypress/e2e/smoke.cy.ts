describe('Smoke Test', () => {
  it('loads the sign-in page', () => {
    cy.visit('/sign-in', { timeout: 30000 })
    cy.get('body').should('be.visible')
  })
})
