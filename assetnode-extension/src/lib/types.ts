

export type PortalId =
  | 'intune'
  | 'autopilot'
  | 'kandji'
  | 'jamf-pro'
  | 'jamf-school'
  | 'personio'
  | 'bamboohr'
  | 'google-workspace'
  | 'hibob'
  | 'mosyle'
  | 'sso-azure-ad'
  | 'sso-okta'
  | 'sso-onelogin'
  | 'sso-jumpcloud'
  | 'sso-google-workspace'
  | 'scim-azure-ad'
  | 'scim-okta'
  | 'scim-onelogin'

export interface PortalDefinition {
  id: PortalId
  name: string
  urlPatterns: string[]
  entryUrl: string
  category: 'mdm' | 'hr' | 'sso' | 'scim'
  icon: string
}


export interface ExtensionGuideStep {
  id: string
  selector: string
  title: string
  description: string
  note?: string
  waitForSelector?: string
  timeout?: number
  fallbackUrl?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  screenshotPath?: string
  nerdMessage?: string
}


export interface AutoAction {
  type: 'click' | 'fill' | 'copy' | 'copy-clipboard' | 'wait' | 'navigate' | 'select'
  selector?: string
  value?: string
  url?: string
  credentialLabel?: string
  duration?: number
  logMessage: string
}

export interface AutoPilotStep extends ExtensionGuideStep {
  autoAction?: AutoAction | AutoAction[]
  requireConfirmation?: boolean
}

export interface CredentialReport {
  portalName: string
  collectedAt: string
  credentials: { label: string; value: string }[]
  warnings: string[]
}

export interface GuideDefinition {
  slug: PortalId
  portalName: string
  entryUrl: string
  category: 'mdm' | 'hr' | 'sso' | 'scim'
  steps: ExtensionGuideStep[]
}


export interface GuideSession {
  slug: PortalId
  currentStep: number
  totalSteps: number
  startedAt: string
  paused: boolean
  autopilot?: boolean
}

export interface GuideProgress {
  slug: PortalId
  completed: boolean
  completedAt?: string
  currentStep: number
  totalSteps: number
}


export type ExtensionMessage =
  | { type: 'START_GUIDE'; slug: PortalId; autopilot?: boolean; startAt?: number }
  | { type: 'PAUSE_GUIDE' }
  | { type: 'RESUME_GUIDE' }
  | { type: 'STOP_GUIDE' }
  | { type: 'STEP_COMPLETED'; slug: PortalId; stepIndex: number }
  | { type: 'GUIDE_COMPLETED'; slug: PortalId }
  | { type: 'GET_SESSION' }
  | { type: 'GET_ALL_PROGRESS' }
  | { type: 'FETCH_STEPS'; slug: string }
  | { type: 'SESSION_UPDATE'; session: GuideSession | null }
  | { type: 'PROGRESS_UPDATE'; progress: GuideProgress[] }
  | { type: 'PORTAL_DETECTED'; portalId: PortalId }
  | { type: 'AUTOPILOT_LOG'; message: string; status: 'info' | 'success' | 'warn' | 'error' }
  | { type: 'AUTOPILOT_REPORT'; report: CredentialReport }


export interface ApiGuideStepsResponse {
  slug: string
  portalName: string
  entryUrl: string
  steps: ExtensionGuideStep[]
}

export interface ApiGuideProgressResponse {
  guides: GuideProgress[]
}


export interface StoredAuth {
  token: string
  email: string
  orgName: string
  expiresAt: string
}
