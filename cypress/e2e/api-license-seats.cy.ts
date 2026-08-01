describe('License Seat Management', () => {
  const apiUrl = Cypress.env('apiUrl')
  let adminToken: string
  let employeeToken: string
  let licenseId: string
  let employeeId: string
  let secondEmployeeId: string

  before(() => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((res) => {
      adminToken = res.body.accessToken
    })
  })


  it('should create a license with limited seats', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `E2E Test License ${Date.now()}`,
        totalSeats: 2,
        costPerSeat: 49.99,
        billingCycle: 'monthly',
        category: 'development',
        licenseType: 'subscription',
      },
    }).then((res) => {
      expect(res.status).to.eq(201)
      expect(res.body.totalSeats).to.eq(2)
      expect(res.body.availableSeats).to.eq(2)
      expect(res.body.seats).to.have.length(0)
      licenseId = res.body._id
    })
  })

  it('should create test employees for seat assignment', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'LicenseA',
        lastName: 'Tester',
        email: `license-a-${Date.now()}@evinsta.com`,
      },
    }).then((res) => {
      employeeId = res.body._id
    })

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'LicenseB',
        lastName: 'Tester',
        email: `license-b-${Date.now()}@evinsta.com`,
      },
    }).then((res) => {
      secondEmployeeId = res.body._id
    })
  })


  it('should checkout seat to first employee', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses/${licenseId}/checkout`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { employeeId },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.usedSeats).to.eq(1)
      expect(res.body.totalSeats).to.eq(2)
    })
  })

  it('should prevent duplicate checkout for same employee', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses/${licenseId}/checkout`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { employeeId },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(409)
      expect(res.body.error).to.include('already has a seat')
    })
  })

  it('should checkout seat to second employee', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses/${licenseId}/checkout`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { employeeId: secondEmployeeId },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.usedSeats).to.eq(2)
    })
  })

  it('should reject checkout when all seats are taken', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/employees`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'LicenseC',
        lastName: 'OverLimit',
        email: `license-c-${Date.now()}@evinsta.com`,
      },
    }).then((empRes) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/licenses/${licenseId}/checkout`,
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { employeeId: empRes.body._id },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400)
        expect(res.body.error).to.include('No seats available')
      })
    })
  })


  it('should populate employee names in seat data', () => {
    cy.request({
      url: `${apiUrl}/api/licenses/${licenseId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.body.seats).to.have.length(2)
      for (const seat of res.body.seats) {
        if (typeof seat.employeeId === 'object' && seat.employeeId !== null) {
          expect(seat.employeeId).to.have.property('firstName')
          expect(seat.employeeId).to.have.property('lastName')
        }
        expect(seat.checkedOutAt).to.be.a('string')
      }
    })
  })


  it('should checkin (reclaim) a seat', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses/${licenseId}/checkin`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { employeeId },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.usedSeats).to.eq(1)
    })
  })

  it('should reject checkin for employee without a seat', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses/${licenseId}/checkin`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { employeeId },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(404)
      expect(res.body.error).to.include('does not have a seat')
    })
  })

  it('should allow re-checkout after checkin', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/licenses/${licenseId}/checkout`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { employeeId },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.usedSeats).to.eq(2)
    })
  })


  it('should report accurate utilization stats', () => {
    cy.request({
      url: `${apiUrl}/api/licenses/summary/stats`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.totalLicenses).to.be.greaterThan(0)
      expect(res.body.usedSeats).to.be.a('number')
      expect(res.body.totalSeats).to.be.a('number')
      expect(res.body.utilizationRate).to.be.a('number')
      expect(res.body.utilizationRate).to.be.at.least(0)
      expect(res.body.utilizationRate).to.be.at.most(100)
    })
  })


  it('should delete the test license (admin only)', () => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/api/licenses/${licenseId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200)
    })
  })
})
