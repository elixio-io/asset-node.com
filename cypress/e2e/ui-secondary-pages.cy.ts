describe('Secondary Authenticated Pages', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Available Assets', () => {
    it('should load available assets page', () => {
      cy.visit('/available')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/available|verfügbar|asset|hardware/i.test(text)).to.be.true
      })
    })
  })

  describe('Defective Assets', () => {
    it('should load defective assets page', () => {
      cy.visit('/defective')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/defective|defekt|broken|kaputt|repair|reparatur/i.test(text)).to.be.true
      })
    })
  })

  describe('Sales Page', () => {
    it('should load sales page', () => {
      cy.visit('/sales')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/sale|verkauf|for sale|zum verkauf/i.test(text)).to.be.true
      })
    })
  })

  describe('My Items', () => {
    it('should load my items page', () => {
      cy.visit('/my-items')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/my item|meine|zugewiesen|assigned/i.test(text)).to.be.true
      })
    })
  })

  describe('Labels / QR Codes', () => {
    it('should load labels page', () => {
      cy.visit('/labels')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/label|qr|barcode|etikett|druck|print/i.test(text)).to.be.true
      })
    })
  })

  describe('My Team', () => {
    it('should load my team page', () => {
      cy.visit('/my-team')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/team|direct|report|mitarbeiter|colleague/i.test(text)).to.be.true
      })
    })
  })

  describe('Import Page', () => {
    it('should load import page', () => {
      cy.visit('/import')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/import|csv|upload|hochladen|datei|file/i.test(text)).to.be.true
      })
    })
  })

  describe('Company Profile', () => {
    it('should load company profile page', () => {
      cy.visit('/company-profile')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/company|unternehmen|firma|organization|organisation/i.test(text)).to.be.true
      })
    })
  })

  describe('Admin Page', () => {
    it('should load admin page', () => {
      cy.visit('/admin')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/admin|verwaltung|organization|benutzer|user/i.test(text)).to.be.true
      })
    })
  })

  describe('Privacy & Data Page', () => {
    it('should load privacy page', () => {
      cy.visit('/privacy')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/privacy|datenschutz|gdpr|dsgvo|data|löschung|deletion/i.test(text)).to.be.true
      })
    })
  })
})
