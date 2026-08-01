describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/sign-in')
  })

  it('should display the sign-in page', () => {
    cy.url().should('include', '/sign-in')
    cy.getByTestId('sign-in-email').should('be.visible')
    cy.getByTestId('sign-in-password').should('be.visible')
    cy.getByTestId('sign-in-submit').should('be.visible')
  })

  it('should login successfully with valid credentials', () => {
    cy.getByTestId('sign-in-email').clear().type('admin@evinsta.com')
    cy.getByTestId('sign-in-password').clear().type('password123')
    cy.getByTestId('sign-in-submit').click()

    cy.url().should('include', '/dashboard', { timeout: 15000 })
  })

  it('should show error with invalid credentials', () => {
    cy.getByTestId('sign-in-email').clear().type('admin@evinsta.com')
    cy.getByTestId('sign-in-password').clear().type('wrongpassword')
    cy.getByTestId('sign-in-submit').click()

    cy.url().should('include', '/sign-in')
    cy.get('.p-message, .p-toast, [data-pc-name="message"]', { timeout: 5000 })
      .should('be.visible')
  })

  it('should redirect unauthenticated users to sign-in', () => {
    cy.visit('/hardware')
    cy.url().should('include', '/sign-in')
  })

  it('should logout via localStorage clear and redirect', () => {
    cy.loginAsAdmin()
    cy.visit('/dashboard')
    cy.url().should('include', '/dashboard')

    cy.window().then((win) => {
      win.localStorage.removeItem('hw_access_token')
      win.localStorage.removeItem('hw_refresh_token')
    })
    cy.visit('/dashboard')
    cy.url().should('include', '/sign-in', { timeout: 10000 })
  })
})
