describe('Theme & Settings UI', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Theme Switching', () => {
    it('should have a theme toggle button in the navbar', () => {
      cy.visit('/dashboard')
      cy.wait(1500)
      cy.get('[class*="pi-moon"], [class*="pi-sun"], [class*="pi-desktop"], button[aria-label*="theme" i], button[title*="theme" i], button[title*="Theme" i]')
        .should('exist')
    })

    it('should persist theme across page navigation', () => {
      cy.visit('/dashboard')
      cy.wait(1500)
      cy.get('html').then($html => {
        const wasDark = $html.hasClass('p-dark')
        cy.visit('/hardware')
        cy.wait(1500)
        cy.get('html').then($html2 => {
          expect($html2.hasClass('p-dark')).to.eq(wasDark)
        })
      })
    })
  })

  describe('Settings Page', () => {
    it('should load settings page', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.url().should('include', '/settings')
      cy.get('body').should('be.visible')
    })

    it('should show organization settings', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasOrgSettings = /organization|organisation|company|unternehmen|einstellungen|settings/i.test(text)
        expect(hasOrgSettings).to.be.true
      })
    })

    it('should show settings content sections', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        expect(text.length).to.be.greaterThan(50)
      })
    })
  })

  describe('Profile Page', () => {
    it('should load profile page', () => {
      cy.visit('/profile')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should display user profile content', () => {
      cy.visit('/profile')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        expect(text.length).to.be.greaterThan(50)
      })
    })
  })
})
