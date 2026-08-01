
describe('Error Handling — Authentication Guards', () => {
  it('should redirect to sign-in for /hardware without auth', () => {
    cy.clearAllSessionStorage()
    cy.clearAllLocalStorage()
    cy.visit('/hardware')
    cy.url({ timeout: 5000 }).should('include', 'sign-in')
  })

  it('should redirect to sign-in for /dashboard without auth', () => {
    cy.clearAllSessionStorage()
    cy.clearAllLocalStorage()
    cy.visit('/dashboard')
    cy.url({ timeout: 5000 }).should('include', 'sign-in')
  })

  it('should redirect to sign-in for /settings without auth', () => {
    cy.clearAllSessionStorage()
    cy.clearAllLocalStorage()
    cy.visit('/settings')
    cy.url({ timeout: 5000 }).should('include', 'sign-in')
  })

  it('should redirect to sign-in for /billing without auth', () => {
    cy.clearAllSessionStorage()
    cy.clearAllLocalStorage()
    cy.visit('/billing')
    cy.url({ timeout: 5000 }).should('include', 'sign-in')
  })
})

describe('Error Handling — Invalid Routes', () => {
  beforeEach(() => cy.loginAsAdmin())

  it('should handle non-existent route gracefully', () => {
    cy.visit('/this-page-does-not-exist-at-all', { failOnStatusCode: false })
    cy.wait(2000)
    cy.get('body').should('be.visible')
  })
})

describe('Error Handling — Session Persistence', () => {
  it('should persist session after page reload', () => {
    cy.loginAsAdmin()
    cy.visit('/dashboard')
    cy.wait(2000)
    cy.url().should('include', 'dashboard')
    cy.reload()
    cy.wait(2000)
    cy.url().should('not.include', 'sign-in')
  })
})

describe('Error Handling — API Error Resilience', () => {
  beforeEach(() => cy.loginAsAdmin())

  it('should not white-screen when hardware API returns 500', () => {
    cy.intercept('GET', '**/api/hardware*', { statusCode: 500, body: { error: 'Internal Server Error' } }).as('hardwareError')
    cy.visit('/hardware')
    cy.wait(2000)
    cy.get('body').should('be.visible')
    cy.get('body').invoke('text').should('not.be.empty')
  })

  it('should not white-screen when employees API returns 500', () => {
    cy.intercept('GET', '**/api/employees*', { statusCode: 500, body: { error: 'Internal Server Error' } }).as('employeesError')
    cy.visit('/employees')
    cy.wait(2000)
    cy.get('body').should('be.visible')
    cy.get('body').invoke('text').should('not.be.empty')
  })
})
