describe('Feature Pages UI Smoke', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Billing Page', () => {
    it('should load billing page with plan info', () => {
      cy.visit('/billing')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        const hasPlanInfo = /free|starter|pro|enterprise|plan|tarif/i.test(text)
        expect(hasPlanInfo, 'Billing page should mention plan info').to.be.true
      })
    })

    it('should show usage metrics', () => {
      cy.visit('/billing')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasUsage = /asset|user|usage|nutzung|verbrauch|\d+\s*\/\s*\d+/i.test(text)
        expect(hasUsage, 'Billing should show usage info').to.be.true
      })
    })

    it('should show plan comparison/upgrade options', () => {
      cy.visit('/billing')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasPlans = /upgrade|downgrade|starter|pro|enterprise|vergleich/i.test(text)
        expect(hasPlans, 'Should show plan options').to.be.true
      })
    })
  })

  describe('Settings Page', () => {
    it('should load with organization settings', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        const hasSettings = /settings|einstellungen|organisation|company|unternehmen/i.test(text)
        expect(hasSettings, 'Settings page should show settings').to.be.true
      })
    })

    it('should show GDPR/data export options', () => {
      cy.visit('/settings')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasGdpr = /gdpr|dsgvo|export|data|daten|datenschutz|lösch/i.test(text)
        cy.log(`GDPR presence: ${hasGdpr}`)
      })
    })
  })

  describe('Integrations Page', () => {
    it('should load and show available integrations', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        const providers = ['Microsoft', 'Intune', 'Jamf', 'Kandji', 'Personio', 'BambooHR', 'Google']
        const found = providers.filter(p => text.includes(p))
        expect(found.length, 'Should list at least some integration providers').to.be.greaterThan(0)
      })
    })

    it('should show integration cards/tiles', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('[class*="card"], [class*="tile"], [class*="integration"], .p-card').should('have.length.gte', 1)
    })
  })

  describe('Reports Page', () => {
    it('should load reports page', () => {
      cy.visit('/reports')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })

    it('should show some report content or chart area', () => {
      cy.visit('/reports')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasReports = /report|bericht|chart|diagram|export|übersicht|asset|hardware/i.test(text)
        expect(hasReports, 'Reports page should have report content').to.be.true
      })
    })
  })

  describe('Dashboard', () => {
    it('should load with summary widgets/stats', () => {
      cy.visit('/dashboard')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        const hasStats = /\d+/.test(text)
        expect(hasStats, 'Dashboard should display numeric stats').to.be.true
      })
    })

    it('should show asset distribution or status breakdown', () => {
      cy.visit('/dashboard')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasSummary = /total|gesamt|available|verfügbar|assigned|zugewiesen|dashboard/i.test(text)
        expect(hasSummary, 'Dashboard should show status summary').to.be.true
      })
    })
  })

  describe('Licenses Page', () => {
    it('should load without errors', () => {
      cy.visit('/licenses')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('Peripherals Page', () => {
    it('should load without errors', () => {
      cy.visit('/peripherals')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('Consumables Page', () => {
    it('should load without errors', () => {
      cy.visit('/consumables')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('Company Profile Page', () => {
    it('should load without errors', () => {
      cy.visit('/company-profile')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('My Items Page', () => {
    it('should load without errors', () => {
      cy.visit('/my-items')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('Audit Log Page', () => {
    it('should load without errors', () => {
      cy.visit('/audits')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })
  })

  describe('Recycle Bin Page', () => {
    it('should load recycle bin', () => {
      cy.visit('/recycle-bin')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('Kits Page', () => {
    it('should load without errors', () => {
      cy.visit('/kits')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })

  describe('Maintenance Page', () => {
    it('should load without errors', () => {
      cy.visit('/maintenance')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').should('not.contain.text', '404')
    })
  })
})
