
describe('Form Validation — Login', () => {
  beforeEach(() => cy.visit('/sign-in'))

  it('should show Login page with email and password fields', () => {
    cy.get('input[type="email"], input[placeholder*="mail"], input[name="email"]').should('exist')
    cy.get('input[type="password"]').should('exist')
  })

  it('should not submit with empty fields', () => {
    cy.get('button[type="submit"], button').contains(/anmelden|login|sign in/i).click()
    cy.url().should('include', 'sign-in')
  })

  it('should not submit with only email', () => {
    cy.get('input[type="email"], input[placeholder*="mail"], input[name="email"]').type('test@example.com')
    cy.get('button[type="submit"], button').contains(/anmelden|login|sign in/i).click()
    cy.url().should('include', 'sign-in')
  })

  it('should show error for wrong credentials', () => {
    cy.get('input[type="email"], input[placeholder*="mail"], input[name="email"]').type('wrong@example.com')
    cy.get('input[type="password"]').type('wrongpassword')
    cy.get('button[type="submit"], button').contains(/anmelden|login|sign in/i).click()
    cy.contains(/fehlgeschlagen|ungültig|invalid|failed|error/i, { timeout: 5000 }).should('be.visible')
  })
})

describe('Form Validation — Registration', () => {
  beforeEach(() => cy.visit('/sign-up'))

  it('should show registration form with required fields', () => {
    cy.get('input[type="email"], input[placeholder*="mail"]').should('exist')
    cy.get('input[type="password"]').should('have.length.at.least', 1)
  })

  it('should not submit with empty form', () => {
    cy.get('button[type="submit"]').first().click({ force: true })
    cy.url().should('include', 'sign-up')
  })
})

describe('Form Validation — Hardware Create', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/hardware')
    cy.wait(2000)
  })

  it('should show hardware table and add button', () => {
    cy.get('body').should('be.visible')
    cy.get('button').contains(/hinzufügen|asset|add|neu/i).should('exist')
  })

  it('should open create dialog', () => {
    cy.get('button').contains(/hinzufügen|asset|add|neu/i).first().click()
    cy.get('.p-dialog, [role="dialog"]', { timeout: 5000 }).should('be.visible')
  })

  it('should have cancel option in create dialog', () => {
    cy.get('button').contains(/hinzufügen|asset|add|neu/i).first().click()
    cy.get('.p-dialog, [role="dialog"]', { timeout: 5000 }).should('be.visible')
    cy.get('.p-dialog button, [role="dialog"] button').contains(/abbrechen|cancel|schließen|close/i).should('exist')
  })

  it('should close dialog on cancel', () => {
    cy.get('button').contains(/hinzufügen|asset|add|neu/i).first().click()
    cy.get('.p-dialog, [role="dialog"]', { timeout: 5000 }).should('be.visible')
    cy.get('.p-dialog button, [role="dialog"] button').contains(/abbrechen|cancel|schließen|close/i).click()
    cy.get('.p-dialog, [role="dialog"]').should('not.exist')
  })
})

describe('Form Validation — Employee Create', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/employees')
    cy.wait(2000)
  })

  it('should show employees table and add button', () => {
    cy.get('body').should('be.visible')
    cy.get('button').contains(/hinzufügen|mitarbeiter|add|employee/i).should('exist')
  })

  it('should open employee create dialog', () => {
    cy.get('button').contains(/hinzufügen|mitarbeiter|add|employee/i).first().click()
    cy.get('.p-dialog, [role="dialog"]', { timeout: 5000 }).should('be.visible')
  })

  it('should have required input fields in employee create dialog', () => {
    cy.get('button').contains(/hinzufügen|mitarbeiter|add|employee/i).first().click()
    cy.get('.p-dialog, [role="dialog"]', { timeout: 5000 }).should('be.visible')
    cy.get('.p-dialog input, [role="dialog"] input').should('have.length.at.least', 2)
  })
})
