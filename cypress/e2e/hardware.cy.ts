describe('Hardware Management', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/hardware')
  })

  it('should load the hardware list page', () => {
    cy.url().should('include', '/hardware')
    cy.get('table', { timeout: 10000 }).should('be.visible')
  })

  it('should display hardware assets in the table', () => {
    cy.get('table', { timeout: 10000 }).should('be.visible')
    cy.get('table tbody tr').should('have.length.greaterThan', 0)
  })

  it('should click the add asset button and show dialog', () => {
    cy.get('button').contains(/asset hinzufügen|add asset/i).click()
    cy.get('.p-dialog', { timeout: 5000 }).should('be.visible')
    cy.get('body').type('{esc}')
  })

  it('should search/filter hardware assets', () => {
    cy.wait(2000)
    cy.get('input[type="text"], input[placeholder*="uch"], input[placeholder*="earch"]')
      .first()
      .clear()
      .type('MacBook')
    cy.wait(1000)
    cy.get('table', { timeout: 5000 }).should('be.visible')
  })

  it('should show category filter', () => {
    cy.wait(2000)
    cy.get('.p-select').should('have.length.gte', 1)
  })
})
