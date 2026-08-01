describe('Recycle Bin & Restore Flow', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let deletedHardwareId: string
  let deletedLicenseId: string
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

  it('should create and then soft-delete hardware', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        model: 'RecycleBin Test Device',
        serialNumber: `SNRB-${uid}`,
        assetTag: `RB-${uid}`,
        categoryId,
        statusId,
        manufacturerId,
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      deletedHardwareId = res.body._id

      cy.request({
        method: 'DELETE',
        url: `${apiUrl}/api/hardware/${deletedHardwareId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((delRes) => {
        expect(delRes.status).to.eq(200)
      })
    })
  })

  it('should create and then soft-delete a license', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `RecycleBin Test License ${uid}`,
        totalSeats: 5,
      },
    }).then((res) => {
      deletedLicenseId = res.body._id

      cy.request({
        method: 'DELETE',
        url: `${apiUrl}/api/licenses/${deletedLicenseId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((delRes) => {
        expect(delRes.status).to.eq(200)
      })
    })
  })

  it('should list all deleted items in recycle bin', () => {
    cy.request({
      url: `${apiUrl}/api/recycle-bin`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.have.property('hardware')
      expect(res.body.hardware).to.be.an('array')
    })
  })

  it('should show deleted hardware in the recycle bin', () => {
    cy.request({
      url: `${apiUrl}/api/recycle-bin/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const found = res.body.find((h: any) => h._id === deletedHardwareId)
      expect(found, 'Deleted hardware should be in recycle bin').to.exist
      expect(found.deletedAt).to.not.be.null
    })
  })

  it('deleted items should NOT appear in active lists', () => {
    cy.request({
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const found = res.body.find((h: any) => h._id === deletedHardwareId)
      expect(found, 'Deleted hardware should not appear in active list').to.be.undefined
    })
  })

  it('should restore hardware from recycle bin', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/recycle-bin/hardware/${deletedHardwareId}/restore`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.success).to.eq(true)
      expect(res.body.item.deletedAt).to.be.null
    })
  })

  it('restored hardware should appear in active list again', () => {
    cy.request({
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const found = res.body.find((h: any) => h._id === deletedHardwareId)
      expect(found, 'Restored hardware should reappear in active list').to.exist
    })
  })

  it('restored hardware should no longer be in recycle bin', () => {
    cy.request({
      url: `${apiUrl}/api/recycle-bin/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const found = res.body.find((h: any) => h._id === deletedHardwareId)
      expect(found, 'Restored hardware should not be in recycle bin').to.be.undefined
    })
  })

  it('should permanently delete license from recycle bin', () => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/recycle-bin/license/${deletedLicenseId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      failOnStatusCode: false,
    }).then((res) => {
      expect([200, 404]).to.include(res.status)
    })
  })

  it('should reject unknown recycle bin type', () => {
    cy.request({
      url: `${apiUrl}/api/recycle-bin/unicorns`,
      headers: { Authorization: `Bearer ${adminToken}` },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400)
    })
  })
})
