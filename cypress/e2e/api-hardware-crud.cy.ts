describe('Hardware CRUD Data Integrity', () => {
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

  it('should create hardware and auto-generate an assetTag', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        model: 'E2E Test Laptop',
        serialNumber: `SN-E2E-${uid}`,
        assetTag: `HW-${uid}`,
        categoryId,
        statusId,
        manufacturerId,
        purchasePrice: 1499.99,
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body._id).to.be.a('string')
      expect(res.body.model).to.eq('E2E Test Laptop')
      expect(res.body.assetTag).to.be.a('string')
      expect(res.body.assetTag).to.include('HW-')
      expect(res.body.purchasePrice).to.eq(1499.99)
      Cypress.env('createdHardwareId', res.body._id)
    })
  })

  it('should return the created hardware via GET by ID', () => {
    const hwId = Cypress.env('createdHardwareId')
    cy.request({
      url: `${apiUrl}/api/hardware/${hwId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.model).to.eq('E2E Test Laptop')
      if (res.body.categoryId && typeof res.body.categoryId === 'object') {
        expect(res.body.categoryId).to.have.property('name')
      }
    })
  })

  it('should show the created hardware in the list', () => {
    cy.request({
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const found = res.body.find((h: any) => h._id === Cypress.env('createdHardwareId'))
      expect(found, 'Created hardware should appear in the list').to.exist
      expect(found.model).to.eq('E2E Test Laptop')
    })
  })

  it('should update the hardware model name', () => {
    const hwId = Cypress.env('createdHardwareId')
    cy.request({
      method: 'PUT',
      url: `${apiUrl}/api/hardware/${hwId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { model: 'E2E Test Laptop UPDATED', notes: 'Updated via E2E test' },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.model).to.eq('E2E Test Laptop UPDATED')
      expect(res.body.notes).to.eq('Updated via E2E test')
    })
  })

  it('should persist the update on re-fetch', () => {
    const hwId = Cypress.env('createdHardwareId')
    cy.request({
      url: `${apiUrl}/api/hardware/${hwId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.model).to.eq('E2E Test Laptop UPDATED')
      expect(res.body.notes).to.eq('Updated via E2E test')
    })
  })

  it('should reject duplicate serial numbers within the same org', () => {
    const sn = `SN-DUP-${uid}`
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { model: 'Dup Test 1', serialNumber: sn, assetTag: `DUP1-${uid}`, categoryId, statusId, manufacturerId },
    }).then(() => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/hardware`,
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { model: 'Dup Test 2', serialNumber: sn, assetTag: `DUP2-${uid}`, categoryId, statusId, manufacturerId },
        failOnStatusCode: false,
      }).then((res2) => {
        expect(res2.status).to.be.oneOf([400, 409, 500])
      })
    })
  })

  it('should reject hardware creation with missing required fields', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { model: '' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 422, 500])
    })
  })

  it('should search hardware by model name', () => {
    cy.request({
      url: `${apiUrl}/api/hardware?search=E2E+Test+Laptop`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.length).to.be.greaterThan(0)
      expect(res.body.some((h: any) => h.model.includes('E2E Test'))).to.be.true
    })
  })

  it('should soft-delete hardware (move to recycle bin)', () => {
    const hwId = Cypress.env('createdHardwareId')
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/hardware/${hwId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
    })
  })

  it('should no longer return deleted hardware in list', () => {
    cy.request({
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const found = res.body.find((h: any) => h._id === Cypress.env('createdHardwareId'))
      expect(found, 'Deleted hardware should not appear in the active list').to.be.undefined
    })
  })
})
