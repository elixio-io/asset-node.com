describe('Maintenance Lifecycle & Hardware Status', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let hardwareId: string
  let maintenanceId: string
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

  it('should create test hardware', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        model: 'Maintenance Test Device',
        serialNumber: `SNMT-${uid}`,
        assetTag: `MT-${uid}`,
        categoryId,
        statusId,
        manufacturerId,
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      hardwareId = res.body._id
    })
  })

  it('should create a repair maintenance record', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/maintenance`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        hardware: hardwareId,
        type: 'repair',
        description: 'Screen replacement needed',
        performedBy: 'Technical Team',
        cost: 299.99,
        status: 'inProgress',
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.type).to.eq('repair')
      expect(res.body.status).to.eq('inProgress')
      expect(res.body.cost).to.eq(299.99)
      maintenanceId = res.body._id
    })
  })

  it('should list maintenance records for the hardware', () => {
    cy.request({
      url: `${apiUrl}/api/maintenance?hardwareId=${hardwareId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.length).to.be.greaterThan(0)
    })
  })

  it('should update maintenance to completed', () => {
    cy.request({
      method: 'PUT',
      url: `${apiUrl}/api/maintenance/${maintenanceId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: 'completed',
        completionDate: new Date().toISOString(),
        notes: 'Screen replaced successfully',
      },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.status).to.eq('completed')
    })
  })

  it('should create an inspection record', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/maintenance`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        hardware: hardwareId,
        type: 'inspection',
        description: 'Annual safety inspection',
        performedBy: 'QA Team',
        status: 'completed',
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.type).to.eq('inspection')
    })
  })

  it('should reject maintenance for non-existent hardware', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/maintenance`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        hardware: '000000000000000000000000',
        type: 'repair',
        description: 'Ghost repair',
        performedBy: 'Nobody',
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(404)
    })
  })

  it('should delete maintenance record (admin only)', () => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/maintenance/${maintenanceId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
    })
  })
})
