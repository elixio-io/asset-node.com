describe('Navigation & Role-based Access', () => {
  describe('Admin user navigation', () => {
    beforeEach(() => {
      cy.loginAsAdmin()
    })

    const adminPages = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Hardware', path: '/hardware' },
      { name: 'Employees', path: '/employees' },
      { name: 'Assignments', path: '/assignments' },
      { name: 'Licenses', path: '/licenses' },
      { name: 'Peripherals', path: '/peripherals' },
      { name: 'Reports', path: '/reports' },
      { name: 'Settings', path: '/settings' },
      { name: 'Categories', path: '/categories' },
      { name: 'Statuses', path: '/statuses' },
      { name: 'Departments', path: '/departments' },
      { name: 'Manufacturers', path: '/manufacturers' },
    ]

    adminPages.forEach(({ name, path }) => {
      it(`should navigate to ${name} (${path})`, () => {
        cy.visit(path)
        cy.url().should('include', path)
        cy.url().should('not.include', '/sign-in')
      })
    })
  })

  describe('Employee user restrictions', () => {
    beforeEach(() => {
      cy.loginAsEmployee()
    })

    it('should access the dashboard', () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    })

    it('should access My Items page', () => {
      cy.visit('/my-items')
      cy.url().should('include', '/my-items')
    })

    it('should be redirected from Settings (admin only)', () => {
      cy.visit('/settings')
      cy.url().should('not.include', '/settings')
    })

    it('should be redirected from Reports (admin/manager only)', () => {
      cy.visit('/reports')
      cy.url().should('not.include', '/reports')
    })
  })

  describe('Manager user access', () => {
    beforeEach(() => {
      cy.loginAsManager()
    })

    it('should access Employees page', () => {
      cy.visit('/employees')
      cy.url().should('include', '/employees')
    })

    it('should access Reports page', () => {
      cy.visit('/reports')
      cy.url().should('include', '/reports')
    })

    it('should be redirected from Settings (admin only)', () => {
      cy.visit('/settings')
      cy.url().should('not.include', '/settings')
    })
  })
})
