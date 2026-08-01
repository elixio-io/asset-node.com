
import './commands'

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Navigation cancelled') || err.message.includes('Redirected when going from')) {
    return false
  }
  return true
})
