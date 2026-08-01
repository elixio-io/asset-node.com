describe('Public Marketing Pages', () => {
  describe('Landing Page', () => {
    it('should load landing page', () => {
      cy.visit('/')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/assetnode|asset.node|hardware|asset.management/i.test(text)).to.be.true
      })
    })

    it('should have sign-in and sign-up CTAs', () => {
      cy.visit('/')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasCTA = /sign.in|anmelden|sign.up|registrieren|kostenlos|free|starten/i.test(text)
        expect(hasCTA, 'Should have auth CTAs').to.be.true
      })
    })
  })

  describe('Pricing Page', () => {
    it('should load pricing page', () => {
      cy.visit('/pricing')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/preis|price|plan|starter|pro|enterprise|free/i.test(text)).to.be.true
      })
    })

    it('should show plan comparison', () => {
      cy.visit('/pricing')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        expect(/asset|user|integration|support/i.test(text)).to.be.true
      })
    })
  })

  describe('About Page', () => {
    it('should load about page', () => {
      cy.visit('/about')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/über|about|bonn|deutsch|germany|elixio/i.test(text)).to.be.true
      })
    })
  })

  describe('Blog', () => {
    it('should load blog index', () => {
      cy.visit('/blog')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/blog|artikel|article|itam|asset/i.test(text)).to.be.true
      })
    })

    it('should load blog article', () => {
      cy.visit('/blog/excel-vs-itam')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/excel|itam|asset.management/i.test(text)).to.be.true
      })
    })
  })

  describe('Changelog', () => {
    it('should load changelog page', () => {
      cy.visit('/changelog')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/changelog|update|version|release|feature/i.test(text)).to.be.true
      })
    })
  })

  describe('Careers', () => {
    it('should load careers page', () => {
      cy.visit('/careers')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/career|karriere|job|initiativ|team/i.test(text)).to.be.true
      })
    })
  })

  describe('API Documentation', () => {
    it('should load API docs page', () => {
      cy.visit('/api-docs')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/api|rest|endpoint|documentation|dokument/i.test(text)).to.be.true
      })
    })
  })

  describe('Legal Pages', () => {
    it('should load privacy policy', () => {
      cy.visit('/privacy-policy')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/datenschutz|privacy|dsgvo|gdpr/i.test(text)).to.be.true
      })
    })

    it('should load terms of service', () => {
      cy.visit('/terms')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/nutzung|terms|agb|bedingung/i.test(text)).to.be.true
      })
    })

    it('should load imprint', () => {
      cy.visit('/imprint')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/impressum|imprint|elixio|bonn/i.test(text)).to.be.true
      })
    })
  })

  describe('Password Recovery', () => {
    it('should load forgot password page', () => {
      cy.visit('/forgot-password')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/passwort|password|email|reset|vergessen|forgot/i.test(text)).to.be.true
      })
    })

    it('should have email input', () => {
      cy.visit('/forgot-password')
      cy.wait(2000)
      cy.get('input[type="email"], input[type="text"]').should('exist')
    })

    it('should load reset password page', () => {
      cy.visit('/reset-password')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })
  })
})
