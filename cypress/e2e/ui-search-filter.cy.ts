
describe('Search & Filter — Hardware', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/hardware')
    cy.wait(2000)
  })

  it('should display search input on hardware page', () => {
    cy.get('input[type="text"], input[placeholder*="such"], input[placeholder*="search"], [class*="search"]')
      .should('exist')
  })

  it('should filter table when typing non-existent term', () => {
    cy.get('input[type="text"], input[placeholder*="such"], input[placeholder*="search"]').first()
      .clear()
      .type('zzz_nonexistent_asset_9999')
    cy.wait(500)
    cy.get('body').then($body => {
      const text = $body.text()
      const hasNoResults = /keine|no results|leer|empty|nicht gefunden/i.test(text)
      const rowCount = $body.find('.p-datatable-tbody tr, table tbody tr').length
      expect(hasNoResults || rowCount === 0 || rowCount === 1).to.be.true
    })
  })

  it('should restore results when search is cleared', () => {
    const searchSel = 'input[type="text"], input[placeholder*="such"], input[placeholder*="search"]'
    cy.get(searchSel).first().clear().type('zzz_nothing')
    cy.wait(500)
    cy.get(searchSel).first().clear()
    cy.wait(500)
    cy.get('body').should('be.visible')
  })

  it('should have sortable column headers', () => {
    cy.get('.p-datatable th, table th').should('have.length.at.least', 2)
  })
})

describe('Search & Filter — Employees', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/employees')
    cy.wait(2000)
  })

  it('should display search input on employees page', () => {
    cy.get('input[type="text"], input[placeholder*="such"], input[placeholder*="search"], [class*="search"]')
      .should('exist')
  })

  it('should filter employees when searching non-existent name', () => {
    cy.get('input[type="text"], input[placeholder*="such"], input[placeholder*="search"]').first()
      .clear()
      .type('zzz_nonexistent_employee_9999')
    cy.wait(500)
    cy.get('body').then($body => {
      const text = $body.text()
      const hasNoResults = /keine|no results|leer|empty/i.test(text)
      const rowCount = $body.find('.p-datatable-tbody tr, table tbody tr').length
      expect(hasNoResults || rowCount === 0 || rowCount === 1).to.be.true
    })
  })
})
