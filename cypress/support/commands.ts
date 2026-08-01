import 'cypress'


Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      const apiUrl = Cypress.env('apiUrl')
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/auth/login`,
        body: { email, password },
        failOnStatusCode: true,
      }).then((response) => {
        const { accessToken, refreshToken } = response.body
        window.localStorage.setItem('hw_access_token', accessToken)
        window.localStorage.setItem('hw_refresh_token', refreshToken)
      })
    },
    {
      validate() {
        cy.window().its('localStorage').invoke('getItem', 'hw_access_token').should('exist')
      },
    }
  )
})

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin@evinsta.com', 'password123')
})

Cypress.Commands.add('loginAsManager', () => {
  cy.login('sarah@evinsta.com', 'password123')
})

Cypress.Commands.add('loginAsEmployee', () => {
  cy.login('tom@evinsta.com', 'password123')
})

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`)
})

Cypress.Commands.add('getOrCreateTestLookups', (token: string) => {
  const apiUrl = Cypress.env('apiUrl')
  const headers = { Authorization: `Bearer ${token}` }

  cy.request({ url: `${apiUrl}/api/categories?entityType=hardware`, headers }).then((res) => {
    if (res.body.length > 0) {
      Cypress.env('testCategoryId', res.body[0]._id)
    } else {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/categories`,
        headers,
        body: { name: 'E2E Test Category', entityType: 'hardware' },
      }).then((createRes) => {
        Cypress.env('testCategoryId', createRes.body._id)
      })
    }
  })

  cy.request({ url: `${apiUrl}/api/manufacturers`, headers }).then((res) => {
    if (res.body.length > 0) {
      Cypress.env('testManufacturerId', res.body[0]._id)
    } else {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/manufacturers`,
        headers,
        body: { name: 'E2E Test Manufacturer' },
      }).then((createRes) => {
        Cypress.env('testManufacturerId', createRes.body._id)
      })
    }
  })

  cy.request({ url: `${apiUrl}/api/statuses`, headers }).then((res) => {
    const deployable = res.body.find((s: any) => s.type === 'deployable')
    Cypress.env('testStatusId', deployable?._id || res.body[0]._id)
  })
})


declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>

      loginAsAdmin(): Chainable<void>

      loginAsManager(): Chainable<void>

      loginAsEmployee(): Chainable<void>

      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>

      getOrCreateTestLookups(token: string): Chainable<void>
    }
  }
}

export { }
