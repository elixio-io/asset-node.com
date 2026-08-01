import type { ExtensionGuideStep } from '../../lib/types'


export const bamboohrSteps: ExtensionGuideStep[] = [
  {
    id: 'bamboohr-1-login', selector: 'body',
    title: 'Log in to BambooHR', description: 'Navigate to yourcompany.bamboohr.com.',
    nerdMessage: 'Let\'s get your BambooHR employees synced! 🌱', timeout: 5000,
  },
  {
    id: 'bamboohr-2-profile', selector: 'img.Avatar, [data-testid="avatar"], .profile-icon',
    title: 'Click your profile icon', description: 'Click your profile picture in the upper right corner.',
    side: 'bottom', nerdMessage: 'Click your avatar to access API keys 👤', timeout: 10000,
  },
  {
    id: 'bamboohr-3-api-keys', selector: 'a[href*="api"], [data-testid="api-keys"]',
    title: 'Go to API Keys', description: 'Click "API Keys" in the dropdown menu.',
    side: 'right', nerdMessage: 'Navigate to your API keys section 🔑', timeout: 10000,
  },
  {
    id: 'bamboohr-4-add-key', selector: 'button:has(span:contains("Add")), [data-testid="add-api-key"]',
    title: 'Add a new API key', description: 'Click "Add New Key" and name it "AssetNode Integration".',
    side: 'bottom', nerdMessage: 'Create a key called "AssetNode Integration" 📝', timeout: 10000,
  },
  {
    id: 'bamboohr-5-copy', selector: 'input[readonly], pre, code',
    title: 'Copy the API key', description: 'Copy the generated API key immediately.',
    note: 'The API key is only displayed once — store it securely.',
    nerdMessage: '⚠️ Copy it now! One-time display! 📋', timeout: 15000,
  },
  {
    id: 'bamboohr-6-done', selector: 'body',
    title: '🎉 Enter credentials in AssetNode',
    description: 'Go to AssetNode → Settings → HR Sync → BambooHR. Enter your subdomain and API key.',
    fallbackUrl: 'https://app.asset-node.com/settings#bamboohrSection',
    nerdMessage: 'All done! Paste everything in AssetNode! 🎉', timeout: 5000,
  },
]


export const hibobSteps: ExtensionGuideStep[] = [
  {
    id: 'hibob-1-login', selector: 'body',
    title: 'Log in to HiBob', description: 'Navigate to app.hibob.com and sign in.',
    nerdMessage: 'Let\'s connect HiBob to sync your people data! 🧑‍💼', timeout: 5000,
  },
  {
    id: 'hibob-2-settings', selector: 'a[href*="settings"], [data-testid="settings"]',
    title: 'Go to Settings', description: 'Navigate to Settings in the admin menu.',
    side: 'right', nerdMessage: 'Find the settings menu ⚙️', timeout: 10000,
  },
  {
    id: 'hibob-3-integrations', selector: 'a[href*="integrations"], [data-testid="integrations"]',
    title: 'Open Integrations', description: 'Click on "Integrations" in the settings.',
    side: 'right', nerdMessage: 'Look for the Integrations section 🔌', timeout: 10000,
  },
  {
    id: 'hibob-4-service-user', selector: 'a[href*="service-users"], [data-testid="service-users"]',
    title: 'Create a Service User', description: 'Go to Service Users → Add a new service user named "AssetNode Integration".',
    side: 'bottom', nerdMessage: 'Create a service user for AssetNode 🤖', timeout: 10000,
  },
  {
    id: 'hibob-5-generate-token', selector: 'button:has(span:contains("Generate")), [data-testid="generate-token"]',
    title: 'Generate an API token', description: 'Generate a new API token for the service user. Copy both the Service User ID and token.',
    note: 'The API token is only shown once — store it securely.',
    nerdMessage: '⚠️ Copy both the ID and token! 📋', timeout: 15000,
  },
  {
    id: 'hibob-6-done', selector: 'body',
    title: '🎉 Enter credentials in AssetNode',
    description: 'Go to AssetNode → Settings → HR Sync → HiBob. Enter the Service User ID and API token.',
    fallbackUrl: 'https://app.asset-node.com/settings#hibobSection',
    nerdMessage: 'Paste them in and your HiBob employees will sync! 🎉', timeout: 5000,
  },
]


export const googleWorkspaceSteps: ExtensionGuideStep[] = [
  {
    id: 'gws-1-console', selector: 'body',
    title: 'Open Google Cloud Console', description: 'Navigate to console.cloud.google.com and select your organization\'s project.',
    nerdMessage: 'Let\'s set up Google Workspace directory sync! 🔵', timeout: 5000,
  },
  {
    id: 'gws-2-apis', selector: 'a[href*="apis"], [data-testid="apis-services"], [aria-label*="APIs"]',
    title: 'Enable the Admin SDK API', description: 'Go to APIs & Services → Library. Search for "Admin SDK API" and click Enable.',
    side: 'right', nerdMessage: 'We need the Admin SDK API enabled 📚', timeout: 10000,
  },
  {
    id: 'gws-3-service-account', selector: 'a[href*="iam"], [data-testid="iam"], [aria-label*="IAM"]',
    title: 'Create a service account', description: 'Go to IAM & Admin → Service Accounts → Create Service Account. Name it "AssetNode Directory Sync".',
    side: 'right', nerdMessage: 'Create a service account for AssetNode 🤖', timeout: 10000,
  },
  {
    id: 'gws-4-json-key', selector: 'button:has(span:contains("Add Key")), [data-testid="add-key"]',
    title: 'Create a JSON key', description: 'Click Keys → Add Key → Create new key → JSON. Download the key file.',
    note: 'This file contains your private key — store it securely.',
    nerdMessage: '⚠️ Download the JSON key — it contains the private key! 📥', timeout: 15000,
  },
  {
    id: 'gws-5-delegation', selector: 'body',
    title: 'Configure domain-wide delegation',
    description: 'In Google Admin (admin.google.com) → Security → API controls → Domain-wide delegation. Add the service account\'s Client ID with scope: https://www.googleapis.com/auth/admin.directory.user.readonly',
    fallbackUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
    nerdMessage: 'Set up domain-wide delegation in Google Admin 🔐', timeout: 10000,
  },
  {
    id: 'gws-6-done', selector: 'body',
    title: '🎉 Enter credentials in AssetNode',
    description: 'Go to AssetNode → Settings → HR Sync → Google Workspace. Paste the service account email, private key, and admin email.',
    fallbackUrl: 'https://app.asset-node.com/settings#googleWorkspaceSection',
    nerdMessage: 'Paste everything in AssetNode! You\'re almost there! 🎉', timeout: 5000,
  },
]


export const mosyleSteps: ExtensionGuideStep[] = [
  {
    id: 'mosyle-1-login', selector: 'body',
    title: 'Log in to Mosyle Manager', description: 'Navigate to your Mosyle Manager portal.',
    nerdMessage: 'Let\'s sync your Apple devices from Mosyle! 🍎', timeout: 5000,
  },
  {
    id: 'mosyle-2-integrations', selector: 'a[href*="integrations"], [data-testid="integrations"]',
    title: 'Go to Organization → Integrations', description: 'Navigate to Organization → Integrations → API Integration.',
    side: 'right', nerdMessage: 'Find the API Integration section 🔌', timeout: 10000,
  },
  {
    id: 'mosyle-3-enable-api', selector: 'input[type="checkbox"], [data-testid="enable-api"], button:has(span:contains("Enable"))',
    title: 'Enable API access', description: 'Enable API access and generate a new API token.',
    side: 'bottom', nerdMessage: 'Toggle the API access switch! 🔄', timeout: 10000,
  },
  {
    id: 'mosyle-4-copy-token', selector: 'input[readonly], pre, code',
    title: 'Copy the API token', description: 'Copy the generated API token.',
    note: 'Store this token securely — it is only shown once.',
    nerdMessage: '⚠️ Copy the token! 📋', timeout: 15000,
  },
  {
    id: 'mosyle-5-done', selector: 'body',
    title: '🎉 Enter credentials in AssetNode',
    description: 'Go to AssetNode → Settings → MDM → Mosyle. Paste the API token and click Save.',
    fallbackUrl: 'https://app.asset-node.com/settings#mosyleSection',
    nerdMessage: 'Done! Your Mosyle devices will start syncing! 🎉', timeout: 5000,
  },
]
