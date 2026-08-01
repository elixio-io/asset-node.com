describe('Billing Page Deep Validation', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/billing')
    cy.wait(2500)
  })

  describe('Plan Display', () => {
    it('should display current plan name', () => {
      cy.get('body').invoke('text').then(text => {
        const hasPlanName = /free|starter|professional|pro|enterprise/i.test(text)
        expect(hasPlanName, 'Should display a plan name').to.be.true
      })
    })

    it('should display plan status', () => {
      cy.get('body').invoke('text').then(text => {
        const hasStatus = /active|aktiv|trial|trialing|canceled|gekündigt|free/i.test(text)
        expect(hasStatus, 'Should display billing status').to.be.true
      })
    })
  })

  describe('Usage Display', () => {
    it('should show asset usage', () => {
      cy.get('body').invoke('text').then(text => {
        const hasAssetUsage = /asset|gerät|hardware/i.test(text)
        expect(hasAssetUsage, 'Should show asset usage').to.be.true
      })
    })

    it('should show user/seat usage', () => {
      cy.get('body').invoke('text').then(text => {
        const hasUserUsage = /user|benutzer|seat|platz/i.test(text)
        expect(hasUserUsage, 'Should show user usage').to.be.true
      })
    })
  })

  describe('Plan Comparison', () => {
    it('should display multiple plan options', () => {
      cy.get('body').invoke('text').then(text => {
        let planCount = 0
        if (/free/i.test(text)) planCount++
        if (/starter/i.test(text)) planCount++
        if (/pro/i.test(text)) planCount++
        if (/enterprise/i.test(text)) planCount++
        expect(planCount, 'Should show at least 2 plan options').to.be.at.least(2)
      })
    })
  })

  describe('Navigation Integration', () => {
    it('billing page should be accessible from navbar', () => {
      cy.visit('/dashboard')
      cy.wait(1500)
      cy.get('a[href*="billing"], [class*="menu"] *').filter(':contains("Billing")').first()
        .should('exist')
    })

    it('should not show 404 content', () => {
      cy.get('body').invoke('text').then(text => {
        expect(text.toLowerCase()).to.not.include('page not found')
        expect(text.toLowerCase()).to.not.include('404')
      })
    })
  })
})
