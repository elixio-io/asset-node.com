describe('Employee Lifecycle & Validation', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let createdEmployeeId: string

  before(() => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((res) => {
      adminToken = res.body.accessToken
    })
  })

  it('should create an employee with all fields', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'E2E',
        lastName: 'TestEmployee',
        email: `e2e-${Date.now()}@evinsta.com`,
        jobTitle: 'Test Engineer',
        phone: '+49 170 1234567',
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.firstName).to.eq('E2E')
      expect(res.body.lastName).to.eq('TestEmployee')
      expect(res.body.isActive).to.eq(true)
      expect(res.body._id).to.be.a('string')
      createdEmployeeId = res.body._id
    })
  })

  it('should reject employee creation with invalid email', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Bad',
        lastName: 'Email',
        email: 'not-an-email',
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 422, 500])
    })
  })

  it('should prevent employee from being their own manager', () => {
    cy.request({
      method: 'PUT',
      url: `${apiUrl}/api/employees/${createdEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { managerId: createdEmployeeId },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400)
    })
  })

  it('should update employee jobTitle', () => {
    cy.request({
      method: 'PUT',
      url: `${apiUrl}/api/employees/${createdEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { jobTitle: 'Senior Test Engineer' },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.jobTitle).to.eq('Senior Test Engineer')
    })
  })

  it('should persist update on re-fetch', () => {
    cy.request({
      url: `${apiUrl}/api/employees/${createdEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.jobTitle).to.eq('Senior Test Engineer')
    })
  })

  it('should search employees by name', () => {
    cy.request({
      url: `${apiUrl}/api/employees?search=E2E`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.length).to.be.greaterThan(0)
      expect(res.body.some((e: any) => e.firstName === 'E2E')).to.be.true
    })
  })

  it('should show fullName computed field', () => {
    cy.request({
      url: `${apiUrl}/api/employees/${createdEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.fullName).to.eq('E2E TestEmployee')
    })
  })

  it('should deactivate (soft-delete) the employee', () => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/employees/${createdEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
    })
  })

  it('should show deactivated employee as inactive', () => {
    cy.request({
      url: `${apiUrl}/api/employees/${createdEmployeeId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status === 200) {
        expect(res.body.isActive).to.eq(false)
      } else {
        expect(res.status).to.eq(404)
      }
    })
  })
})
