describe('Employee UI CRUD', () => {
  const uid = `${Date.now()}`

  beforeEach(() => {
    cy.loginAsAdmin()
  })

  it('should load the employees page with a table', () => {
    cy.visit('/employees')
    cy.get('table, [class*="table"], [class*="list"]', { timeout: 10000 }).should('be.visible')
    cy.get('table tbody tr, [class*="table"] tbody tr').should('have.length.gte', 1)
  })

  it('should open the Add Employee dialog', () => {
    cy.visit('/employees')
    cy.get('button').contains(/add|hinzufügen|mitarbeiter|employee/i).click()
    cy.get('[class*="dialog"], [role="dialog"], .p-dialog', { timeout: 5000 }).should('be.visible')
  })

  it('should search/filter employees', () => {
    cy.visit('/employees')
    cy.get('input[placeholder*="such"], input[placeholder*="search"], .an-search-input').first()
      .clear()
      .type('admin')
    cy.wait(500)
    cy.get('table tbody, [class*="table"] tbody').should('be.visible')
  })
})
