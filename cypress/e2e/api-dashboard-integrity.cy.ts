describe('Dashboard Data Integrity', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string

  before(() => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((res) => {
      adminToken = res.body.accessToken
    })
  })

  it('should return dashboard data with correct structure', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.have.property('cards')
      expect(res.body).to.have.property('statusCounts')
      expect(res.body).to.have.property('summary')
      expect(res.body.cards).to.have.property('totalDevices')
      expect(res.body.summary).to.have.property('totalAssetValue')
    })
  })

  it('should have totalDevices matching the actual hardware count', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((dashRes) => {
      cy.request({
        url: `${apiUrl}/api/hardware`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((hwRes) => {
        expect(dashRes.body.cards.totalDevices).to.eq(hwRes.body.length)
      })
    })
  })

  it('should have statusCounts summing to totalDevices', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const statusSum = Object.values(res.body.statusCounts as Record<string, number>)
        .reduce((a, b) => a + b, 0)
      expect(statusSum).to.eq(res.body.cards.totalDevices)
    })
  })

  it('should have categoryBreakdown summing to totalDevices', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const catSum = (res.body.categoryBreakdown as { count: number }[])
        .reduce((a, b) => a + b.count, 0)
      expect(catSum).to.eq(res.body.cards.totalDevices)
    })
  })

  it('should not have null category names', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      for (const cat of res.body.categoryBreakdown) {
        expect(cat.category, 'Category name should not be null').to.not.be.null
        expect(cat.category).to.not.eq('null')
        expect(cat.category).to.not.eq('undefined')
      }
    })
  })

  it('should not have null status names', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      for (const [name] of Object.entries(res.body.statusCounts)) {
        expect(name).to.not.eq('unknown')
        expect(name).to.not.eq('null')
        expect(name).to.not.eq('undefined')
      }
    })
  })

  it('should display consistent KPI cards in the UI', () => {
    cy.loginAsAdmin()
    cy.visit('/dashboard')
    cy.get('.pbi-kpi-grid', { timeout: 10000 }).should('be.visible')

    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      if (res.body.cards.totalDevices > 0) {
        cy.get('.pbi-kpi-tile').then(($tiles) => {
          const values = $tiles.toArray().map((el) => el.textContent)
          const hasNonZero = values.some((v) => v && /[1-9]/.test(v))
          expect(hasNonZero, 'Dashboard should show real non-zero device data').to.be.true
        })
      }
    })
  })

  it('should display status counts correctly in the UI', () => {
    cy.loginAsAdmin()
    cy.visit('/dashboard')
    cy.get('.pbi-status-legend', { timeout: 10000 }).should('be.visible')

    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const statusEntries = Object.entries(res.body.statusCounts as Record<string, number>)
      if (statusEntries.length > 0) {
        cy.get('.pbi-status-row__count').then(($counts) => {
          const displayedCounts = $counts.toArray().map(el => parseInt(el.textContent || '0', 10))
          const apiCounts = statusEntries.map(([, count]) => count)
          for (const apiCount of apiCounts) {
            expect(displayedCounts).to.include(apiCount)
          }
        })
      }
    })
  })
})
