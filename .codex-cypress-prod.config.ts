import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'https://app.asset-node.com',
    supportFile: 'cypress/support/runtime-e2e.js',
    specPattern: ['cypress/e2e/**/*.cy.ts'],
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    pageLoadTimeout: 120000,
    env: {
      apiUrl: 'https://api.asset-node.com',
    },
  },
})
