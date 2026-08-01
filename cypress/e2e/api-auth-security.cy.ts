describe('API Authentication & Security', () => {
  const apiUrl = Cypress.env('apiUrl')


  it('should reject requests with no token', () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/hardware`,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401)
    })
  })

  it('should reject requests with a garbage token', () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: 'Bearer this.is.garbage' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403])
    })
  })

  it('should reject requests with an expired/invalid JWT structure', () => {
    const fakeJwt = btoa('{"alg":"HS256"}') + '.' + btoa('{"userId":"abc","role":"admin"}') + '.invalidsig'
    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/hardware`,
      headers: { Authorization: `Bearer ${fakeJwt}` },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403])
    })
  })

  it('should issue valid tokens on login', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.have.property('accessToken')
      expect(res.body).to.have.property('refreshToken')
      expect(res.body.accessToken).to.be.a('string').and.have.length.greaterThan(20)
      expect(res.body.refreshToken).to.be.a('string').and.have.length.greaterThan(20)
    })
  })

  it('should reject login with wrong password', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'wrongwrongwrong' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 401])
    })
  })

  it('should reject login with non-existent email', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'doesnotexist@evinsta.com', password: 'password123' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 401])
    })
  })

  it('should refresh tokens successfully', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((loginRes) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/auth/refresh`,
        body: { refreshToken: loginRes.body.refreshToken },
      }).then((refreshRes) => {
        expect(refreshRes.status).to.eq(200)
        expect(refreshRes.body.accessToken).to.be.a('string')
        cy.request({
          method: 'GET',
          url: `${apiUrl}/api/hardware`,
          headers: { Authorization: `Bearer ${refreshRes.body.accessToken}` },
        }).then((hwRes) => {
          expect(hwRes.status).to.eq(200)
          expect(hwRes.body).to.be.an('array')
        })
      })
    })
  })

  it('should reject refresh with invalid refresh token', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/refresh`,
      body: { refreshToken: 'completely-invalid-token' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403])
    })
  })


  it('should return current user data on /me', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'admin@evinsta.com', password: 'password123' },
    }).then((loginRes) => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/auth/me`,
        headers: { Authorization: `Bearer ${loginRes.body.accessToken}` },
      }).then((meRes) => {
        expect(meRes.status).to.eq(200)
        expect(meRes.body.email).to.eq('admin@evinsta.com')
        expect(meRes.body.role).to.eq('admin')
        expect(meRes.body).to.not.have.property('password')
        expect(meRes.body).to.not.have.property('passwordHash')
        expect(meRes.body).to.not.have.property('refreshToken')
      })
    })
  })


  it('should deny employee role from creating hardware', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'tom@evinsta.com', password: 'password123' },
    }).then((loginRes) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/hardware`,
        headers: { Authorization: `Bearer ${loginRes.body.accessToken}` },
        body: {
          model: 'Hacked Laptop',
          categoryId: '000000000000000000000000',
          manufacturerId: '000000000000000000000000',
          statusId: '000000000000000000000000',
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403)
      })
    })
  })

  it('should deny employee role from deleting employees', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/login`,
      body: { email: 'tom@evinsta.com', password: 'password123' },
    }).then((loginRes) => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/employees`,
        headers: { Authorization: `Bearer ${loginRes.body.accessToken}` },
      }).then((listRes) => {
        expect(listRes.body.length).to.be.greaterThan(0)
        const firstId = listRes.body[0]._id
        cy.request({
          method: 'DELETE',
          url: `${apiUrl}/api/employees/${firstId}`,
          headers: { Authorization: `Bearer ${loginRes.body.accessToken}` },
          failOnStatusCode: false,
        }).then((delRes) => {
          expect(delRes.status).to.eq(403)
        })
      })
    })
  })
})
