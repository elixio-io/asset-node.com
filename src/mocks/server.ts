
import { setupServer } from 'msw/node'
import { kandjiHandlers } from './handlers/kandji'
import { intuneHandlers } from './handlers/intune'
import { autopilotHandlers } from './handlers/autopilot'
import { jamfHandlers } from './handlers/jamf'
import { mosyleHandlers } from './handlers/mosyle'
import { personioHandlers } from './handlers/personio'
import { bamboohrHandlers } from './handlers/bamboohr'
import { googleWorkspaceHandlers } from './handlers/googleWorkspace'
import { hibobHandlers } from './handlers/hibob'

const allHandlers = [
  ...kandjiHandlers,
  ...intuneHandlers,
  ...autopilotHandlers,
  ...jamfHandlers,
  ...mosyleHandlers,
  ...personioHandlers,
  ...bamboohrHandlers,
  ...googleWorkspaceHandlers,
  ...hibobHandlers
]

export const mockServer = setupServer(...allHandlers)

export function startMockServer(): void {
  mockServer.listen({
    onUnhandledRequest: 'bypass'
  })
  console.log('🎭 MSW mock server started — external API calls will be intercepted')
  console.log(`   Scenario: ${process.env.MOCK_SCENARIO || 'HAPPY_PATH'}`)
  console.log(`   Handlers: Kandji, Intune, Autopilot, Jamf, Mosyle, Personio, BambooHR, Google Workspace, HiBob`)
}

export function stopMockServer(): void {
  mockServer.close()
  console.log('🎭 MSW mock server stopped')
}
