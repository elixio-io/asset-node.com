
import type { ExtensionGuideStep, AutoPilotStep, PortalId } from '../../lib/types'
import { intuneSteps } from './intune'
import { kandjiSteps } from './kandji'
import { personioSteps } from './personio'
import { jamfProSteps, jamfSchoolSteps } from './jamf'
import { bamboohrSteps, hibobSteps, googleWorkspaceSteps, mosyleSteps } from './hr-platforms'
import {
  ssoOktaSteps, scimOktaSteps,
  ssoOneloginSteps, scimOneloginSteps,
  ssoJumpcloudSteps,
  ssoAzureSteps, scimAzureSteps,
  ssoGoogleSteps,
} from './sso-scim'

export const BUNDLED_STEPS: Partial<Record<PortalId, ExtensionGuideStep[]>> = {
  intune: intuneSteps,
  autopilot: intuneSteps,
  kandji: kandjiSteps,
  'jamf-pro': jamfProSteps,
  'jamf-school': jamfSchoolSteps,
  mosyle: mosyleSteps,

  personio: personioSteps,
  bamboohr: bamboohrSteps,
  'google-workspace': googleWorkspaceSteps,
  hibob: hibobSteps,

  'sso-azure-ad': ssoAzureSteps,
  'sso-okta': ssoOktaSteps,
  'sso-onelogin': ssoOneloginSteps,
  'sso-jumpcloud': ssoJumpcloudSteps,
  'sso-google-workspace': ssoGoogleSteps,

  'scim-azure-ad': scimAzureSteps,
  'scim-okta': scimOktaSteps,
  'scim-onelogin': scimOneloginSteps,
}

export function getBundledSteps(slug: PortalId): ExtensionGuideStep[] {
  return BUNDLED_STEPS[slug] || []
}
