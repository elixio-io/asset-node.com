
export type MockScenario =
  | 'HAPPY_PATH'
  | 'RATE_LIMITED'
  | 'AUTH_FAILURE'
  | 'SERVER_ERROR'
  | 'LARGE_PAYLOAD'
  | 'PARTIAL_DATA'

let currentScenario: MockScenario = (process.env.MOCK_SCENARIO as MockScenario) || 'HAPPY_PATH'

export function setScenario(scenario: MockScenario): void {
  currentScenario = scenario
  resetScenarioCounters()
  console.log(`🎭 Mock scenario set to: ${scenario}`)
}

export function getScenario(): MockScenario {
  return currentScenario
}

export function resetScenarioCounters(): void {
  ; (globalThis as any).kandji_rate_limit_count = 0
    ; (globalThis as any).intune_rate_limit_count = 0
    ; (globalThis as any).autopilot_rate_limit_count = 0
    ; (globalThis as any).jamf_rate_limit_count = 0
    ; (globalThis as any).mosyle_rate_limit_count = 0
    ; (globalThis as any).personio_rate_limit_count = 0
    ; (globalThis as any).bamboohr_rate_limit_count = 0
    ; (globalThis as any).google_workspace_rate_limit_count = 0
    ; (globalThis as any).hibob_rate_limit_count = 0
}
