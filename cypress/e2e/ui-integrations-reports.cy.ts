describe('Integrations & Reports Pages', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Integrations Page', () => {
    it('should load integrations page', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should display integration provider cards', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasProvider = /intune|jamf|kandji|personio|scim|sso|bamboo|google workspace|mosyle/i.test(text)
        expect(hasProvider, 'Should display integration providers').to.be.true
      })
    })

    it('should show MDM section', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasMDM = /mdm|device management|intune|jamf|kandji|mosyle|geräte/i.test(text)
        expect(hasMDM, 'Should show MDM integrations').to.be.true
      })
    })

    it('should show HR integrations section', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasHR = /hr|personio|bamboo|hibob|identity|personal/i.test(text)
        expect(hasHR, 'Should show HR integrations').to.be.true
      })
    })

    it('each provider card should be clickable', () => {
      cy.visit('/integrations')
      cy.wait(2000)
      cy.get('[class*="card"], [class*="integration"], [class*="provider"]').then($cards => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).click({ force: true })
          cy.wait(1000)
          cy.get('body').should('be.visible')
        }
      })
    })
  })

  describe('Reports Page', () => {
    it('should load reports page', () => {
      cy.visit('/reports')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should display report options', () => {
      cy.visit('/reports')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasReports = /report|bericht|asset|hardware|export|download|summary|zusammenfassung/i.test(text)
        expect(hasReports, 'Should show report options').to.be.true
      })
    })

    it('should not show 404 content', () => {
      cy.visit('/reports')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        expect(text.toLowerCase()).to.not.include('page not found')
        expect(text.toLowerCase()).to.not.include('404')
      })
    })
  })

  describe('Maintenance Page', () => {
    it('should load maintenance page', () => {
      cy.visit('/maintenance')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should show maintenance records or empty state', () => {
      cy.visit('/maintenance')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasMaintenance = /maintenance|wartung|repair|reparatur|schedule|schedule|no maintenance/i.test(text)
        expect(hasMaintenance, 'Should show maintenance content').to.be.true
      })
    })
  })

  describe('Licenses Page', () => {
    it('should load licenses page', () => {
      cy.visit('/licenses')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should show license content', () => {
      cy.visit('/licenses')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasLicenses = /license|lizenz|seat|platz|software|subscription/i.test(text)
        expect(hasLicenses, 'Should show license content').to.be.true
      })
    })
  })
})
