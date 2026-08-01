describe('Remaining Feature Pages — Deep Coverage', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Categories Page', () => {
    it('should load categories page', () => {
      cy.visit('/categories')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        const hasContent = /categor|kategorie/i.test(text)
        expect(hasContent, 'Should show category content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/categories')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })

    it('should show category list or empty state', () => {
      cy.visit('/categories')
      cy.wait(2000)
      cy.get('body').then($body => {
        const hasTable = $body.find('table, [class*="datatable"]').length > 0
        const hasCards = $body.find('[class*="card"]').length > 0
        const hasContent = $body.text().length > 100
        expect(hasTable || hasCards || hasContent).to.be.true
      })
    })
  })

  describe('Departments Page', () => {
    it('should load departments page', () => {
      cy.visit('/departments')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        const hasContent = /department|abteilung/i.test(text)
        expect(hasContent, 'Should show department content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/departments')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Manufacturers Page', () => {
    it('should load manufacturers page', () => {
      cy.visit('/manufacturers')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/manufacturer|hersteller/i.test(text), 'Should show manufacturer content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/manufacturers')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Suppliers Page', () => {
    it('should load suppliers page', () => {
      cy.visit('/suppliers')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/supplier|lieferant/i.test(text), 'Should show supplier content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/suppliers')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Locations Page', () => {
    it('should load locations page', () => {
      cy.visit('/locations')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/location|standort/i.test(text), 'Should show location content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/locations')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Statuses Page', () => {
    it('should load statuses page', () => {
      cy.visit('/statuses')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/status|stati/i.test(text), 'Should show status content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/statuses')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })

    it('should show default statuses', () => {
      cy.visit('/statuses')
      cy.wait(2000)
      cy.get('body').invoke('text').then(text => {
        const hasDefault = /deploy|repair|broken|retired|pending|reparatur|bereit/i.test(text)
        expect(hasDefault, 'Should show default statuses').to.be.true
      })
    })
  })

  describe('Custom Fields Page', () => {
    it('should load custom fields page', () => {
      cy.visit('/custom-fields')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/custom|benutzerdefiniert|field|feld/i.test(text), 'Should show custom fields').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/custom-fields')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Kits Page', () => {
    it('should load kits page', () => {
      cy.visit('/kits')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/kit|paket|bundle/i.test(text), 'Should show kit content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/kits')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Components Page', () => {
    it('should load components page', () => {
      cy.visit('/components')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/component|komponente|bauteil/i.test(text), 'Should show component content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/components')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Consumables Page', () => {
    it('should load consumables page', () => {
      cy.visit('/consumables')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/consumable|verbrauchsmaterial/i.test(text), 'Should show consumable content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/consumables')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Peripherals Page', () => {
    it('should load peripherals page', () => {
      cy.visit('/peripherals')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/peripheral|peripherie|zubehör/i.test(text), 'Should show peripheral content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/peripherals')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Depreciations Page', () => {
    it('should load depreciations page', () => {
      cy.visit('/depreciations')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/depreciation|abschreibung/i.test(text), 'Should show depreciation content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/depreciations')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Audits Page', () => {
    it('should load audits page', () => {
      cy.visit('/audits')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/audit|prüfung|inventur/i.test(text), 'Should show audit content').to.be.true
      })
    })

    it('should have add/create button', () => {
      cy.visit('/audits')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Assignments Page', () => {
    it('should load assignments page', () => {
      cy.visit('/assignments')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/assignment|zuweisung/i.test(text), 'Should show assignment content').to.be.true
      })
    })

    it('should have add button', () => {
      cy.visit('/assignments')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })
  })

  describe('Workflows Page', () => {
    it('should load workflows page', () => {
      cy.visit('/workflows')
      cy.wait(2000)
      cy.get('body').should('be.visible')
      cy.get('body').invoke('text').then(text => {
        expect(/workflow|automation|automatisierung/i.test(text), 'Should show workflow content').to.be.true
      })
    })
  })
})
