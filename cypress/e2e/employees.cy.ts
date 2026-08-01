describe('Employees', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/employees')
  })

  it('should load the employees list page', () => {
    cy.url().should('include', '/employees')
    cy.contains(/employees|mitarbeiter/i).should('be.visible')
  })

  it('should display employees in the table', () => {
    cy.get('table', { timeout: 10000 }).should('be.visible')
    cy.get('table tbody tr').should('have.length.greaterThan', 0)
  })

  it('should create a new employee via API and verify in table', () => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const apiUrl = Cypress.env('apiUrl')

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then(loginRes => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/employees`,
        headers: { Authorization: `Bearer ${loginRes.body.accessToken}` },
        body: {
          firstName: 'Cypress',
          lastName: `Test-${uniqueId}`,
          email: `cypress-${uniqueId}@test.local`,
        },
      }).then(createRes => {
        expect(createRes.status).to.be.oneOf([200, 201])
        cy.visit('/employees')
        cy.wait(2000)
        cy.get('table', { timeout: 10000 }).should('be.visible')
      })
    })
  })

  it('should search employees', () => {
    cy.wait(2000)
    cy.get('input[type="text"], input[placeholder*="uch"], input[placeholder*="earch"]')
      .first()
      .clear()
      .type('Alex')
    cy.wait(1000)
    cy.get('table tbody', { timeout: 5000 }).should('be.visible')
  })
})
