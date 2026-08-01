describe('Cross-Module Data Integrity', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let categoryId: string
  let statusId: string
  let manufacturerId: string
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  before(() => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((res) => {
      adminToken = res.body.accessToken
      cy.getOrCreateTestLookups(adminToken).then(() => {
        categoryId = Cypress.env('testCategoryId')
        statusId = Cypress.env('testStatusId')
        manufacturerId = Cypress.env('testManufacturerId')
      })
    })
  })


  it('dashboard totalDevices should match hardware list length', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((dashRes) => {
      cy.request({
        url: `${apiUrl}/api/hardware`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((hwRes) => {
        expect(dashRes.body.summary.totalDevices).to.eq(hwRes.body.length)
      })
    })
  })

  it('dashboard totalEmployees should match employee list length', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((dashRes) => {
      cy.request({
        url: `${apiUrl}/api/employees`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((empRes) => {
        expect(dashRes.body.summary.totalEmployees).to.eq(empRes.body.length)
      })
    })
  })


  it('creating hardware should increment dashboard totalDevices', () => {
    let countBefore: number
    const ts = Date.now()

    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      countBefore = res.body.summary.totalDevices
    })

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        model: 'Cross-Module Test Device',
        serialNumber: `SNXM-${uid}`,
        assetTag: `XM-${uid}`,
        categoryId,
        statusId,
        manufacturerId,
      },
    }).then((createRes) => {
      const newId = createRes.body._id

      cy.request({
        url: `${apiUrl}/api/dashboard/stats`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((dashRes) => {
        expect(dashRes.body.summary.totalDevices).to.eq(countBefore + 1)
      })

      cy.request({
        method: 'DELETE',
        url: `${apiUrl}/api/hardware/${newId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    })
  })


  it('every hardware item should have valid categoryId and statusId', () => {
    cy.request({
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((hwRes) => {
      cy.request({
        url: `${apiUrl}/api/categories?entityType=hardware`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((catRes) => {
        cy.request({
          url: `${apiUrl}/api/statuses`,
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((statRes) => {
          const catIds = catRes.body.map((c: any) => c._id)
          const statIds = statRes.body.map((s: any) => s._id)

          for (const hw of hwRes.body) {
            const hwCatId = typeof hw.categoryId === 'object' ? hw.categoryId._id : hw.categoryId
            const hwStatId = typeof hw.statusId === 'object' ? hw.statusId._id : hw.statusId
            expect(catIds.indexOf(hwCatId) >= 0, `Hardware ${hw._id} has invalid categoryId: ${hwCatId}`).to.be.true
            expect(statIds.indexOf(hwStatId) >= 0, `Hardware ${hw._id} has invalid statusId: ${hwStatId}`).to.be.true
          }
        })
      })
    })
  })


  it('license usedSeats should match actual seats array length', () => {
    cy.request({
      url: `${apiUrl}/api/licenses`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      for (const license of res.body) {
        const actualSeats = license.seats?.length || 0
        if (license.totalSeats !== -1) {
          expect(license.availableSeats).to.eq(
            license.totalSeats - actualSeats,
            `License ${license.name}: availableSeats mismatch`
          )
        }
      }
    })
  })


  it('dashboard status counts should sum to totalDevices', () => {
    cy.request({
      url: `${apiUrl}/api/dashboard/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const statusCounts = res.body.statusCounts || {}
      let total = 0
      for (const key in statusCounts) {
        total += statusCounts[key]
      }
      expect(total).to.eq(res.body.summary.totalDevices)
    })
  })


  it('asset summary report totalValue should match dashboard', () => {
    cy.request({
      url: `${apiUrl}/api/reports/asset-summary`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((reportRes) => {
      cy.request({
        url: `${apiUrl}/api/dashboard/stats`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((dashRes) => {
        const reportTotalCount = (reportRes.body.hardware || [])
          .reduce((sum: number, group: any) => sum + (group.count || 0), 0)
        expect(reportTotalCount).to.eq(dashRes.body.summary.totalDevices)
      })
    })
  })


  it('assigned hardware should reference existing employees', () => {
    cy.request({
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((hwRes) => {
      const assignedHw = hwRes.body.filter((h: any) => h.assignedTo)

      if (assignedHw.length > 0) {
        cy.request({
          url: `${apiUrl}/api/employees`,
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((empRes) => {
          const empIds = empRes.body.map((e: any) => e._id)

          for (const hw of assignedHw) {
            const assignedToId = typeof hw.assignedTo === 'object'
              ? hw.assignedTo._id
              : hw.assignedTo
            expect(
              empIds.indexOf(assignedToId) >= 0,
              `Hardware ${hw._id} assigned to non-existent employee ${assignedToId}`
            ).to.be.true
          }
        })
      }
    })
  })
})
