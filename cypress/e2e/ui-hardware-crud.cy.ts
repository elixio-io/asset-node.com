describe('Hardware UI CRUD', () => {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  beforeEach(() => {
    cy.loginAsAdmin()
  })

  it('should load hardware page with table and data', () => {
    cy.visit('/hardware')
    cy.get('table', { timeout: 10000 }).should('be.visible')
    cy.get('table tbody tr').should('have.length.gte', 1)
  })

  it('should show correct column headers', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('table thead th').then($headers => {
      const headers = [...$headers].map(h => h.textContent?.trim().toLowerCase() || '')
      expect(headers.some(h => h.includes('modell') || h.includes('model')), 'Model column').to.be.true
      expect(headers.some(h => h.includes('status')), 'Status column').to.be.true
      expect(headers.some(h => h.includes('aktion') || h.includes('action')), 'Actions column').to.be.true
    })
  })

  it('should open the Add Asset dialog', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button').contains(/add|hinzufügen|asset/i).click()
    cy.get('.p-dialog', { timeout: 5000 }).should('be.visible')
    cy.get('.p-dialog .p-autocomplete', { timeout: 5000 }).should('exist')
    cy.get('.p-dialog .p-select').should('have.length.gte', 3)
  })

  it('should show all required form fields in the Add dialog', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button').contains(/add|hinzufügen|asset/i).click()
    cy.get('.p-dialog', { timeout: 5000 }).should('be.visible')

    cy.get('.p-dialog .p-autocomplete').should('exist')
    cy.get('.p-dialog input[placeholder*="erien"], .p-dialog input[placeholder*="erial"]').should('exist')
    cy.get('.p-dialog .p-select').should('have.length.gte', 3)
    cy.get('.p-dialog button').contains(/add|hinzufügen|erstellen/i).should('exist')
  })

  it('should create an asset via the API and see it in the table', () => {
    const apiUrl = Cypress.env('apiUrl')
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then(loginRes => {
      const token = loginRes.body.accessToken
      cy.request({ url: `${apiUrl}/api/categories?entityType=hardware`, headers: { Authorization: `Bearer ${token}` } }).then(catRes => {
        cy.request({ url: `${apiUrl}/api/statuses`, headers: { Authorization: `Bearer ${token}` } }).then(statRes => {
          cy.request({ url: `${apiUrl}/api/manufacturers`, headers: { Authorization: `Bearer ${token}` } }).then(mfgRes => {
            cy.request({
              method: 'POST',
              url: `${apiUrl}/api/hardware`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                model: `Cypress-${uid}`,
                serialNumber: `SN-CY-${uid}`,
                assetTag: `CY-${uid}`,
                categoryId: catRes.body[0]._id,
                statusId: statRes.body[0]._id,
                manufacturerId: mfgRes.body[0]._id,
              },
            }).then(createRes => {
              expect(createRes.status).to.eq(201)
              cy.visit('/hardware')
              cy.wait(2000)
              cy.get('table').should('contain.text', `Cypress-${uid}`)
            })
          })
        })
      })
    })
  })

  it('should enable inline editing via the pencil button', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button .pi-pencil', { timeout: 10000 }).should('have.length.gte', 1)
    cy.get('button .pi-pencil').first().parent('button').click({ force: true })
    cy.get('table tbody input, table tbody .p-autocomplete, table tbody .p-select', { timeout: 5000 })
      .should('exist')
    cy.get('button').contains(/cancel|abbrechen/i).click()
  })

  it('should open the change history dialog', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button .pi-history', { timeout: 10000 }).should('have.length.gte', 1)
    cy.get('button .pi-history').first().parent('button').click({ force: true })
    cy.get('.p-dialog', { timeout: 5000 }).should('be.visible')
    cy.get('body').type('{esc}')
  })

  it('should open the delete confirmation dialog', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button .pi-trash', { timeout: 10000 }).should('have.length.gte', 1)
    cy.get('button .pi-trash').first().parent('button').click({ force: true })
    cy.get('.p-dialog', { timeout: 5000 })
      .should('be.visible')
    cy.get('.p-dialog button').contains(/cancel|abbrechen/i).click()
  })

  it('should show pagination controls', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('[class*="pagination"], [class*="paginator"]').should('exist')
  })

  it('should toggle column visibility via the column selector', () => {
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('button').contains(/spalten|columns/i).then($btn => {
      if ($btn.length) {
        cy.wrap($btn).click()
        cy.get('.p-dialog, .p-popover, [class*="overlay"]', { timeout: 5000 }).should('be.visible')
      }
    })
  })
})
