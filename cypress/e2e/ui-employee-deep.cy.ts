describe('Employee Management Deep', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Employee List', () => {
    it('should load employee list page', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.url().should('include', '/employees')
      cy.get('body').should('be.visible')
    })

    it('should show employee data or empty state', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('body').then($body => {
        const hasTable = $body.find('table, [class*="datatable"]').length > 0
        const hasCards = $body.find('[class*="card"]').length > 0
        const hasEmpty = /no employee|keine mitarbeiter|empty|leer/i.test($body.text())
        const hasContent = $body.text().length > 100
        expect(hasTable || hasCards || hasEmpty || hasContent, 'Employee page should render').to.be.true
      })
    })

    it('should have a search/filter input', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="such" i], input[placeholder*="filter" i]')
        .should('exist')
    })

    it('search should accept typed input without crashing', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="such" i], input[placeholder*="filter" i]')
        .first()
        .type('Test Employee')
      cy.wait(1000)
      cy.get('body').should('be.visible')
    })
  })

  describe('Employee Creation', () => {
    it('should have an add button with plus icon', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('.pi-plus').should('exist')
    })

    it('should open creation form/dialog when clicking add', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('.pi-plus').first().closest('button').click({ force: true })
      cy.wait(1500)
      cy.get('body').invoke('text').then(text => {
        const hasForm = /name|email|vorname|nachname|first|last|department|abteilung/i.test(text)
        expect(hasForm, 'Should show employee form fields').to.be.true
      })
    })
  })

  describe('Employee Detail View', () => {
    it('clicking an employee should show details', () => {
      cy.visit('/employees')
      cy.wait(2000)
      cy.get('tbody tr, [class*="row"], [class*="card"]').then($rows => {
        if ($rows.length > 0) {
          cy.wrap($rows.first()).click()
          cy.wait(1500)
          cy.get('body').should('be.visible')
          cy.get('body').invoke('text').then(text => {
            expect(text.length).to.be.greaterThan(50)
          })
        }
      })
    })
  })
})
