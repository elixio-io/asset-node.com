
import type { PortalDefinition, PortalId } from './types'

export const PORTALS: Record<PortalId, PortalDefinition> = {
  intune: {
    id: 'intune',
    name: 'Microsoft Intune',
    urlPatterns: ['portal.azure.com'],
    entryUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    category: 'mdm',
    icon: 'pi pi-microsoft',
  },
  autopilot: {
    id: 'autopilot',
    name: 'Windows Autopilot',
    urlPatterns: ['portal.azure.com'],
    entryUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    category: 'mdm',
    icon: 'pi pi-microsoft',
  },
  kandji: {
    id: 'kandji',
    name: 'Kandji',
    urlPatterns: ['admin.kandji.io', '.kandji.io'],
    entryUrl: 'https://admin.kandji.io',
    category: 'mdm',
    icon: 'pi pi-apple',
  },
  'jamf-pro': {
    id: 'jamf-pro',
    name: 'Jamf Pro',
    urlPatterns: ['.jamfcloud.com'],
    entryUrl: '',
    category: 'mdm',
    icon: 'pi pi-apple',
  },
  'jamf-school': {
    id: 'jamf-school',
    name: 'Jamf School',
    urlPatterns: ['.jamfcloud.com'],
    entryUrl: '',
    category: 'mdm',
    icon: 'pi pi-apple',
  },
  mosyle: {
    id: 'mosyle',
    name: 'Mosyle',
    urlPatterns: ['.mosyle.com'],
    entryUrl: 'https://manager.mosyle.com',
    category: 'mdm',
    icon: 'pi pi-apple',
  },

  personio: {
    id: 'personio',
    name: 'Personio',
    urlPatterns: ['.personio.de'],
    entryUrl: '',
    category: 'hr',
    icon: 'pi pi-users',
  },
  bamboohr: {
    id: 'bamboohr',
    name: 'BambooHR',
    urlPatterns: ['.bamboohr.com'],
    entryUrl: '',
    category: 'hr',
    icon: 'pi pi-users',
  },
  'google-workspace': {
    id: 'google-workspace',
    name: 'Google Workspace Directory',
    urlPatterns: ['console.cloud.google.com', 'admin.google.com'],
    entryUrl: 'https://console.cloud.google.com',
    category: 'hr',
    icon: 'pi pi-google',
  },
  hibob: {
    id: 'hibob',
    name: 'HiBob',
    urlPatterns: ['app.hibob.com'],
    entryUrl: 'https://app.hibob.com',
    category: 'hr',
    icon: 'pi pi-users',
  },

  'sso-azure-ad': {
    id: 'sso-azure-ad',
    name: 'Azure AD SSO',
    urlPatterns: ['portal.azure.com'],
    entryUrl: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps',
    category: 'sso',
    icon: 'pi pi-microsoft',
  },
  'sso-okta': {
    id: 'sso-okta',
    name: 'Okta SSO',
    urlPatterns: ['.okta.com'],
    entryUrl: '',
    category: 'sso',
    icon: 'pi pi-shield',
  },
  'sso-onelogin': {
    id: 'sso-onelogin',
    name: 'OneLogin SSO',
    urlPatterns: ['.onelogin.com'],
    entryUrl: '',
    category: 'sso',
    icon: 'pi pi-user',
  },
  'sso-jumpcloud': {
    id: 'sso-jumpcloud',
    name: 'JumpCloud SSO',
    urlPatterns: ['console.jumpcloud.com'],
    entryUrl: 'https://console.jumpcloud.com',
    category: 'sso',
    icon: 'pi pi-cloud',
  },
  'sso-google-workspace': {
    id: 'sso-google-workspace',
    name: 'Google Workspace SSO',
    urlPatterns: ['admin.google.com'],
    entryUrl: 'https://admin.google.com',
    category: 'sso',
    icon: 'pi pi-google',
  },

  'scim-azure-ad': {
    id: 'scim-azure-ad',
    name: 'Azure AD SCIM',
    urlPatterns: ['portal.azure.com'],
    entryUrl: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/StartboardApplicationsJ/category~/EnterpriseDashboard',
    category: 'scim',
    icon: 'pi pi-microsoft',
  },
  'scim-okta': {
    id: 'scim-okta',
    name: 'Okta SCIM',
    urlPatterns: ['.okta.com'],
    entryUrl: '',
    category: 'scim',
    icon: 'pi pi-shield',
  },
  'scim-onelogin': {
    id: 'scim-onelogin',
    name: 'OneLogin SCIM',
    urlPatterns: ['.onelogin.com'],
    entryUrl: '',
    category: 'scim',
    icon: 'pi pi-user',
  },
}

export function detectPortal(url: string): PortalId[] {
  const matches: PortalId[] = []
  for (const [id, portal] of Object.entries(PORTALS)) {
    if (portal.urlPatterns.some(pattern => url.includes(pattern))) {
      matches.push(id as PortalId)
    }
  }
  return matches
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'mdm': return 'MDM Integration'
    case 'hr': return 'HR Sync'
    case 'sso': return 'Single Sign-On'
    case 'scim': return 'SCIM Provisioning'
    default: return 'Setup Guide'
  }
}
