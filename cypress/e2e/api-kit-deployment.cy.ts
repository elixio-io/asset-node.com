describe('Kit CRUD & Deployment', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let kitId: string
  let clonedKitId: string
  let categoryId: string
  let statusId: string
  let manufacturerId: string
  let employeeId: string
  let deployHardwareId: string
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


  it('should create a kit', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/kits`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `E2E Test Kit ${Date.now()}`,
        items: [
          { itemType: 'hardware', category: 'laptop', quantity: 1 },
        ],
        notes: 'Created by E2E test',
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.name).to.include('E2E Test Kit')
      expect(res.body.items).to.have.length(1)
      kitId = res.body._id
    })
  })

  it('should reject duplicate kit names', () => {
    cy.request({
      url: `${apiUrl}/api/kits/${kitId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((getRes) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/kits`,
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name: getRes.body.name,
          items: [],
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(409)
      })
    })
  })

  it('should update kit items', () => {
    cy.request({
      method: 'PATCH',
      url: `${apiUrl}/api/kits/${kitId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        items: [
          { itemType: 'hardware', category: 'laptop', quantity: 1 },
          { itemType: 'peripheral', quantity: 2 },
        ],
        notes: 'Updated by E2E test',
      },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.items).to.have.length(2)
      expect(res.body.notes).to.eq('Updated by E2E test')
    })
  })


  it('should clone a kit with auto-generated name', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/kits/${kitId}/clone`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.name).to.include('(Copy)')
      expect(res.body.items).to.have.length(2)
      clonedKitId = res.body._id
    })
  })


  it('should create hardware and employee for deploy test', () => {
    const ts = Date.now()
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'KitDeploy',
        lastName: 'Tester',
        email: `kit-dep-${ts}@evinsta.com`,
      },
    }).then((r) => { employeeId = r.body._id })

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        model: 'Kit Deploy Laptop',
        serialNumber: `SNKIT-${uid}`,
        assetTag: `KIT-${uid}`,
        categoryId,
        statusId,
        manufacturerId,
      },
    }).then((r) => { deployHardwareId = r.body._id })
  })

  it('should deploy kit to employee', () => {
    cy.request({
      method: 'PATCH',
      url: `${apiUrl}/api/kits/${kitId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        items: [
          { itemType: 'hardware', referenceId: deployHardwareId, quantity: 1 },
        ],
      },
    }).then(() => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/kits/${kitId}/deploy`,
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { employeeId },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status === 400) {
          throw new Error(
            `Kit deploy bug: Route filters hardware by old status field ` +
            `instead of statusId. Details: ${JSON.stringify(res.body)}`
          )
        }
        expect(res.status).to.eq(200)
        expect(res.body.success).to.eq(true)
        expect(res.body.hardwareAssigned).to.eq(1)
      })
    })
  })


  it('should delete the test kits', () => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/kits/${kitId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
    })

    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/kits/${clonedKitId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
    })
  })
})
