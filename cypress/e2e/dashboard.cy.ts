describe('Dashboard', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/dashboard')
  })

  it('should load the dashboard page', () => {
    cy.url().should('include', '/dashboard')
    cy.get('.pbi-dashboard', { timeout: 10000 }).should('be.visible')
  })

  it('should display KPI / summary cards', () => {
    cy.get('.pbi-kpi-grid', { timeout: 10000 }).should('be.visible')
    cy.get('.pbi-kpi-tile').should('have.length.greaterThan', 0)
  })

  it('should show the navigation sidebar', () => {
    cy.get('aside.sidebar').should('exist')
  })

  it('should navigate to hardware page via URL', () => {
    cy.visit('/hardware')
    cy.url().should('include', '/hardware')
  })

  it('should navigate to employees page via URL', () => {
    cy.visit('/employees')
    cy.url().should('include', '/employees')
  })
})
