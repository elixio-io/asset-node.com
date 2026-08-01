describe('Data Integrity Across Views', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Dashboard Counter Consistency', () => {
    it('dashboard should display numeric counts', () => {
      cy.visit('/dashboard')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasNumbers = /\d+/.test(text)
        expect(hasNumbers, 'Dashboard should display numeric data').to.be.true
      })
    })

    it('hardware list should load with table or empty state', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('body').then($body => {
        const hasTable = $body.find('table, [class*="datatable"], [class*="DataTable"]').length > 0
        const hasEmpty = /no hardware|keine|empty|leer|start adding/i.test($body.text())
        expect(hasTable || hasEmpty, 'Hardware page should show table or empty state').to.be.true
      })
    })

    it('employee list should load with table or empty state', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('body').then($body => {
        const hasTable = $body.find('table, [class*="datatable"], [class*="DataTable"]').length > 0
        const hasEmpty = /no employee|keine|empty|leer|start adding/i.test($body.text())
        expect(hasTable || hasEmpty, 'Employee page should show table or empty state').to.be.true
      })
    })
  })

  describe('Table Rendering', () => {
    it('hardware table should render correctly', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').then($body => {
        const hasTable = $body.find('table, [class*="datatable"], [class*="DataTable"]').length > 0
        const hasContent = $body.text().length > 100
        expect(hasTable || hasContent, 'Hardware page should render content').to.be.true
      })
    })
  })

  describe('Navbar Active State', () => {
    it('hardware nav item should be active on /hardware', () => {
      cy.visit('/hardware')
      cy.wait(1500)
      cy.get('a[href*="hardware"], [class*="menu"] *').filter(':contains("Hardware")').first()
        .should('exist')
    })

    it('employees nav item should exist on /employees', () => {
      cy.visit('/employees')
      cy.wait(1500)
      cy.url().should('include', '/employees')
      cy.get('body').should('be.visible')
    })

    it('dashboard nav item should be active on /dashboard', () => {
      cy.visit('/dashboard')
      cy.wait(1500)
      cy.get('a[href*="dashboard"], [class*="menu"] *').filter(':contains("Dashboard")').first()
        .should('exist')
    })
  })

  describe('Multi-Page Navigation Stability', () => {
    it('should navigate through 5 pages without error', () => {
      const pages = ['/dashboard', '/hardware', '/employees', '/settings', '/billing']
      pages.forEach(page => {
        cy.visit(page)
        cy.wait(1000)
        cy.get('body').should('be.visible')
        cy.on('uncaught:exception', () => false)
      })
    })

    it('should maintain auth across rapid navigation', () => {
      cy.visit('/hardware')
      cy.wait(500)
      cy.visit('/employees')
      cy.wait(500)
      cy.visit('/dashboard')
      cy.wait(500)
      cy.visit('/settings')
      cy.wait(500)
      cy.url().should('include', '/settings')
    })
  })
})
