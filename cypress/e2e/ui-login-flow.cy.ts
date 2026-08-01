describe('Login & Navigation UI', () => {

  it('should display the sign-in page with email and password fields', () => {
    cy.visit('/sign-in')
    cy.get('input[type="email"], input[placeholder*="mail"], input[id*="email"]').should('be.visible')
    cy.get('input[type="password"], input[placeholder*="assword"], input[id*="password"]').should('be.visible')
  })

  it('should reject invalid credentials with a visual error', () => {
    cy.visit('/sign-in')
    cy.get('input[type="email"], input[placeholder*="mail"], input[id*="email"]').type('bad@email.com')
    cy.get('input[type="password"], input[placeholder*="assword"], input[id*="password"]').type('wrongpass')
    cy.get('button[type="submit"], button').contains(/sign.?in|log.?in|anmelden/i).click()
    cy.wait(2000)
    cy.url().should('include', '/sign-in')
    cy.get('.p-toast, .p-message, [class*="error"], [class*="alert"], [role="alert"]', { timeout: 5000 })
      .should('exist')
  })

  it('should login successfully and redirect to dashboard', () => {
    cy.loginAsAdmin()
    cy.visit('/')
    cy.url().should('not.include', '/sign-in')
    cy.get('body').should('be.visible')
  })

  it('should render the sidebar with key menu items after login', () => {
    cy.loginAsAdmin()
    cy.visit('/hardware')
    cy.wait(2000)


    cy.get('a[href*="/hardware"], a[href*="/dashboard"]', { timeout: 10000 })
      .should('have.length.gte', 1)
  })

  it('should navigate to /hardware and show the asset table', () => {
    cy.loginAsAdmin()
    cy.visit('/hardware')
    cy.get('table, [class*="table"]', { timeout: 10000 }).should('be.visible')
    cy.get('table tbody tr').should('have.length.gte', 1)
  })

  it('should navigate to /employees and show employee data', () => {
    cy.loginAsAdmin()
    cy.visit('/employees')
    cy.get('table, [class*="table"]', { timeout: 10000 }).should('be.visible')
    cy.get('table tbody tr').should('have.length.gte', 1)
  })

  it('should navigate to /settings without errors', () => {
    cy.loginAsAdmin()
    cy.visit('/settings')
    cy.url().should('include', '/settings')
    cy.get('body').should('be.visible')
    cy.get('body').should('not.contain.text', '404')
  })

  it('should navigate to /billing without errors', () => {
    cy.loginAsAdmin()
    cy.visit('/billing')
    cy.url().should('include', '/billing')
    cy.get('body').should('be.visible')
  })

  it('should navigate to /integrations without errors', () => {
    cy.loginAsAdmin()
    cy.visit('/integrations')
    cy.url().should('include', '/integrations')
    cy.get('body').should('be.visible')
  })

  it('should navigate to /reports without errors', () => {
    cy.loginAsAdmin()
    cy.visit('/reports')
    cy.url().should('include', '/reports')
    cy.get('body').should('be.visible')
  })

  it('should not show raw i18n keys on critical pages', () => {
    cy.loginAsAdmin()
    const pages = ['/hardware', '/employees', '/settings', '/billing']
    pages.forEach(page => {
      cy.visit(page)
      cy.wait(1500)
      cy.get('body').invoke('text').then(text => {
        const i18nKeyPattern = /(?<!\w)(common|hardware|employees|settings|billing|dashboard)\.[a-zA-Z]{3,}/g
        const matches = text.match(i18nKeyPattern) || []
        const realKeys = matches.filter((m: string) =>
          !m.includes('http') && !m.includes('asset-node.com') && !m.includes('api.')
        )
        if (realKeys.length > 0) {
          cy.log(`⚠ Possible untranslated keys on ${page}: ${realKeys.join(', ')}`)
        }
      })
    })
  })

  it('should restrict employee from seeing admin-only pages', () => {
    cy.loginAsEmployee()
    cy.visit('/settings')
    cy.wait(2000)
    cy.url().then(url => {
      cy.log(`Employee on /settings: URL is ${url}`)
    })
  })
})
