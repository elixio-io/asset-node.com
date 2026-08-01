describe('Assignment Lifecycle (Checkout → Return)', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let testEmployeeId: string
  let testHardwareId: string
  let assignmentId: string
  let categoryId: string
  let statusId: string
  let manufacturerId: string
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  before(() => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((loginRes) => {
      adminToken = loginRes.body.accessToken
      cy.getOrCreateTestLookups(adminToken).then(() => {
        categoryId = Cypress.env('testCategoryId')
        statusId = Cypress.env('testStatusId')
        manufacturerId = Cypress.env('testManufacturerId')
      })
    })
  })

  before(() => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Assignment',
        lastName: 'Tester',
        email: `assign-test-${Date.now()}@evinsta.com`,
      },
    }).then((res) => {
      testEmployeeId = res.body._id
    })

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        model: 'Assignment Test Device',
        serialNumber: `SN-ASSIGN-${uid}`,
        assetTag: `ASN-${uid}`,
        categoryId,
        statusId,
        manufacturerId,
      },
    }).then((res) => {
      testHardwareId = res.body._id
    })
  })

  it('should create an assignment (checkout)', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/assignments`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        employeeId: testEmployeeId,
        hardware: [testHardwareId],
        notes: 'E2E test checkout',
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.status).to.eq('active')
      assignmentId = res.body._id
    })
  })

  it('should mark hardware as assigned after checkout', () => {
    cy.request({
      url: `${apiUrl}/api/hardware/${testHardwareId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      const assignedTo = typeof res.body.assignedTo === 'object'
        ? res.body.assignedTo?._id
        : res.body.assignedTo
      expect(assignedTo).to.eq(testEmployeeId)
    })
  })

  it('should list the assignment for the employee', () => {
    cy.request({
      url: `${apiUrl}/api/assignments?employeeId=${testEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.length).to.be.greaterThan(0)
      const found = res.body.find((a: any) => a._id === assignmentId)
      expect(found).to.exist
    })
  })

  it('should request return', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/assignments/${assignmentId}/return`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { notes: 'E2E test return' },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.status).to.eq('pendingReturn')
    })
  })

  it('should reject double return request on same assignment', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/assignments/${assignmentId}/return`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {},
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 409])
    })
  })

  it('should complete the return', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/assignments/${assignmentId}/complete-return`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { returnCondition: 'good' },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.status).to.eq('returned')
    })
  })

  it('should release hardware after return', () => {
    cy.request({
      url: `${apiUrl}/api/hardware/${testHardwareId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.assignedTo).to.be.oneOf([null, undefined])
    })
  })

  it('should reject completing return on already-returned assignment', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/assignments/${assignmentId}/complete-return`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { returnCondition: 'good' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 409])
    })
  })
})
