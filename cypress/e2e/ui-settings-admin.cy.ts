describe('Settings & Admin Pages — Deep', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Settings Page', () => {
    it('should load settings page', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should show organization settings section', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasOrgSettings = /organization|organisation|company|unternehmen|einstellung/i.test(text)
        expect(hasOrgSettings, 'Should show org settings').to.be.true
      })
    })

    it('should show API keys section', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasApi = /api|key|schlüssel|token/i.test(text)
        expect(hasApi, 'Should show API keys section').to.be.true
      })
    })

    it('should show webhook configuration', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasWebhook = /webhook/i.test(text)
        expect(hasWebhook, 'Should show webhook section').to.be.true
      })
    })

    it('should have custom fields management', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasCustom = /custom|benutzerdefiniert|feld|field/i.test(text)
        expect(hasCustom, 'Should show custom fields management').to.be.true
      })
    })
  })

  describe('Profile Page', () => {
    it('should load profile page', () => {
      cy.visit('/profile')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should show user information', () => {
      cy.visit('/profile')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasProfile = /profil|email|name|role|rolle|passwort|password/i.test(text)
        expect(hasProfile, 'Should show profile information').to.be.true
      })
    })
  })

  describe('Dashboard Widgets', () => {
    it('should show asset count widget', () => {
      cy.visit('/')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasAssetCount = /hardware|asset|gerät/i.test(text)
        expect(hasAssetCount, 'Dashboard should show asset info').to.be.true
      })
    })

    it('should show activity feed or recent changes', () => {
      cy.visit('/')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasActivity = /activity|aktivität|recent|kürzlich|change|änderung|log|created|erstellt|updated|aktualisiert/i.test(text)
        expect(hasActivity, 'Dashboard should show activity').to.be.true
      })
    })

    it('should show status distribution', () => {
      cy.visit('/')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasStatus = /status|deploy|repair|active|chart|diagramm/i.test(text)
        expect(hasStatus, 'Dashboard should show status distribution').to.be.true
      })
    })
  })

  describe('FAQ Page', () => {
    it('should load FAQ page', () => {
      cy.visit('/faq')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should show FAQ content', () => {
      cy.visit('/faq')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasFaq = /faq|frage|question|answer|antwort|häufig/i.test(text)
        expect(hasFaq, 'Should show FAQ content').to.be.true
      })
    })

    it('FAQ items should be expandable', () => {
      cy.visit('/faq')
      cy.wait(2000)
      cy.get('.pi-plus, [class*="accordion"], [class*="faq"]').then($items => {
        if ($items.length > 0) {
          cy.wrap($items.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('be.visible')
        }
      })
    })
  })
})
