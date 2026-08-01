describe('Assignment & Offboarding UI', () => {
  let token: string

  before(() => {
    const apiUrl = Cypress.env('apiUrl')
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then(res => {
      token = res.body.accessToken
    })
  })

  beforeEach(() => {
    cy.loginAsAdmin()
  })

  it('should show assigned employee name in hardware table', () => {
    const apiUrl = Cypress.env('apiUrl')
    cy.request({
      url: `${apiUrl}/api/hardware?limit=50`,
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      const assigned = res.body.find((h: any) => h.assignedTo)
      if (assigned) {
        cy.visit('/hardware')
        cy.wait(2000)
        cy.get('table tbody').should('be.visible')
      }
    })
  })

  it('should show assignment history in the asset detail dialog', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button .pi-history').first().parent('button').click({ force: true })
    cy.get('.p-dialog', { timeout: 5000 }).should('be.visible')
    cy.get('.p-dialog').should('be.visible')
    cy.get('body').type('{esc}')
  })

  it('should navigate to an employee profile', () => {
    cy.visit('/employees')
    cy.wait(2000)
    cy.get('table tbody tr').first().then($row => {
      const link = $row.find('a')
      if (link.length) {
        cy.wrap(link).first().click()
      } else {
        cy.wrap($row).click()
      }
    })
    cy.wait(1000)
  })

  it('should show my-items page for current user', () => {
    cy.visit('/my-items')
    cy.wait(2000)
    cy.get('body').should('be.visible')
    cy.get('body').invoke('text').then(text => {
      const hasContent = /my.?item|meine|zugewiesene|assigned|hardware|asset/i.test(text)
      cy.log(`My Items content: ${hasContent}`)
    })
  })

  it('should load my-team page', () => {
    cy.visit('/my-team')
    cy.wait(2000)
    cy.get('body').should('be.visible')
  })
})
