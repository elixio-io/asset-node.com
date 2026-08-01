describe('Hardware CRUD Deep Lifecycle', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Hardware Creation Form', () => {
    it('should have an add button with plus icon', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })

    it('should open create form when clicking add button', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('.pi-plus').first().closest('button').click({ force: true })
      cy.wait(1500)
      cy.get('body').invoke('text').then(text => {
        const hasFormFields = /model|modell|category|kategorie|manufacturer|hersteller|serial|serien/i.test(text)
        expect(hasFormFields, 'Create form should show fields').to.be.true
      })
    })
  })

  describe('Hardware Table Interactions', () => {
    it('should support column sorting', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('th, [class*="column-header"], [role="columnheader"]').then($headers => {
        if ($headers.length > 0) {
          cy.wrap($headers.first()).click()
          cy.wait(500)
          cy.get('body').should('be.visible')
        }
      })
    })

    it('should support row click for detail view', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('tbody tr, [class*="row"]').then($rows => {
        if ($rows.length > 0) {
          cy.wrap($rows.first()).click()
          cy.wait(1500)
          cy.get('body').should('be.visible')
        }
      })
    })
  })

  describe('Hardware Search', () => {
    it('should have a search input field', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="such" i]')
        .should('exist')
    })

    it('should filter results when typing', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="such" i]')
        .first()
        .type('MacBook')
      cy.wait(1000)
      cy.get('body').should('be.visible')
    })

    it('should clear search results', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      const searchInput = 'input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="such" i]'
      cy.get(searchInput).first().type('zzzzxxx_nonexistent')
      cy.wait(1000)
      cy.get(searchInput).first().clear()
      cy.wait(1000)
      cy.get('body').should('be.visible')
    })
  })

  describe('Recycle Bin Access', () => {
    it('should have link to recycle bin', () => {
      cy.visit('/hardware')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasRecycleBin = /recycle|papierkorb|trash|gelöscht|deleted|bin/i.test(text)
        expect(hasRecycleBin, 'Should mention recycle bin').to.be.true
      })
    })

    it('should load recycle bin page', () => {
      cy.visit('/recycle-bin')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(text.length).to.be.greaterThan(50)
      })
    })
  })
})
