import type { ExtensionGuideStep } from '../../lib/types'


export const ssoOktaSteps: ExtensionGuideStep[] = [
  { id: 'sso-okta-1', selector: 'body', title: 'Log in to Okta', description: 'Navigate to your Okta admin dashboard.', nerdMessage: 'Let\'s set up SSO with Okta! 🔒', timeout: 5000 },
  { id: 'sso-okta-2', selector: 'a[href*="applications"], [data-testid="applications"]', title: 'Go to Applications', description: 'Click "Applications" in the sidebar.', side: 'right', nerdMessage: 'Find the Applications section 📱', timeout: 10000 },
  { id: 'sso-okta-3', selector: 'button:has(span:contains("Create")), [data-testid="create-app"]', title: 'Create App Integration', description: 'Click "Create App Integration" → Select "SAML 2.0".', side: 'bottom', nerdMessage: 'Create a SAML 2.0 application 🆕', timeout: 10000 },
  { id: 'sso-okta-4', selector: 'input[name*="ssoUrl"], input[aria-label*="Single sign-on URL"]', title: 'Configure SAML Settings', description: 'Set the SSO URL and Audience URI from AssetNode settings.', side: 'bottom', nerdMessage: 'Copy the SSO URL from your AssetNode Settings → SSO section 📋', timeout: 10000 },
  { id: 'sso-okta-5', selector: 'a[href*="sign-on"], [data-testid="sign-on-tab"]', title: 'Copy IdP metadata', description: 'Copy the Identity Provider SSO URL and download the certificate.', side: 'right', nerdMessage: 'Download the certificate — you\'ll paste it in AssetNode 📜', timeout: 10000 },
  { id: 'sso-okta-6', selector: 'body', title: '🎉 Enter details in AssetNode', description: 'Go to AssetNode → Settings → SSO. Paste the IdP SSO URL, Entity ID, and certificate.', fallbackUrl: 'https://app.asset-node.com/settings#ssoSection', nerdMessage: 'Paste everything and SSO is live! 🎉', timeout: 5000 },
]

export const scimOktaSteps: ExtensionGuideStep[] = [
  { id: 'scim-okta-1', selector: 'body', title: 'Log in to Okta Admin Console', description: 'Navigate to your Okta organization admin dashboard.', nerdMessage: 'Let\'s set up SCIM provisioning with Okta! 👥', timeout: 5000 },
  { id: 'scim-okta-2', selector: 'a[href*="admin/app"], [data-testid="applications"]', title: 'Add a new application', description: 'Go to Applications → Browse App Catalog. Search for "SCIM 2.0 Test App (Header Auth)" and add it.', side: 'right', nerdMessage: 'Search for "SCIM 2.0 Test App" in the catalog 🔍', timeout: 10000 },
  { id: 'scim-okta-3', selector: 'input[name*="label"], input[aria-label*="Application label"]', title: 'Name the application', description: 'Name it "AssetNode" and click Next.', side: 'bottom', nerdMessage: 'Give it the name "AssetNode" 📝', timeout: 10000 },
  { id: 'scim-okta-4', selector: 'a[href*="provisioning"], [data-testid="provisioning-tab"]', title: 'Configure Provisioning', description: 'Go to Provisioning tab → Configure API Integration. Check "Enable API Integration".', side: 'right', nerdMessage: 'Enable the API Integration toggle 🔄', timeout: 10000 },
  { id: 'scim-okta-5', selector: 'input[name*="baseUrl"], input[aria-label*="Base URL"]', title: 'Enter SCIM credentials', description: 'Set the SCIM 2.0 Base URL and API Token from AssetNode SCIM settings.', note: 'Click "Test API Credentials" to verify the connection.', side: 'bottom', nerdMessage: 'Copy the SCIM URL and Token from AssetNode Settings 📋', timeout: 10000 },
  { id: 'scim-okta-6', selector: '[data-testid="create-users"], input[type="checkbox"]', title: 'Enable provisioning actions', description: 'Under "To App": Enable Create Users, Update User Attributes, and Deactivate Users.', side: 'bottom', nerdMessage: 'Enable all three provisioning actions ✅', timeout: 10000 },
  { id: 'scim-okta-7', selector: 'a[href*="assignments"], [data-testid="assignments-tab"]', title: 'Assign users', description: 'Go to Assignments tab and assign the users or groups you want to sync.', side: 'right', nerdMessage: 'Select which users/groups to sync to AssetNode 👥', timeout: 10000 },
  { id: 'scim-okta-8', selector: 'body', title: '🎉 SCIM is configured!', description: 'Users will begin syncing to AssetNode. Enable location/department/manager sync in AssetNode SCIM settings.', fallbackUrl: 'https://app.asset-node.com/settings#scimSection', nerdMessage: 'SCIM provisioning is live! Employees will sync automatically! 🎉', timeout: 5000 },
]


export const ssoOneloginSteps: ExtensionGuideStep[] = [
  { id: 'sso-ol-1', selector: 'body', title: 'Log in to OneLogin', description: 'Navigate to your OneLogin admin portal.', nerdMessage: 'Setting up SSO with OneLogin! 🔒', timeout: 5000 },
  { id: 'sso-ol-2', selector: 'a[href*="apps"], [data-testid="applications"]', title: 'Add a custom SAML app', description: 'Search for "SAML Custom Connector (Advanced)".', side: 'right', nerdMessage: 'Find the SAML Custom Connector 🔍', timeout: 10000 },
  { id: 'sso-ol-3', selector: 'input[name*="acs"], input[aria-label*="ACS"]', title: 'Set up SAML configuration', description: 'Enter ACS URL and SAML Audience from AssetNode SSO settings.', side: 'bottom', nerdMessage: 'Copy the ACS URL from AssetNode Settings → SSO 📋', timeout: 10000 },
  { id: 'sso-ol-4', selector: 'a[href*="sso"], [data-testid="sso-tab"]', title: 'Copy OneLogin SSO details', description: 'Copy SAML 2.0 Endpoint URL and download certificate.', side: 'right', nerdMessage: 'Download the cert and copy the endpoint URL 📜', timeout: 10000 },
  { id: 'sso-ol-5', selector: 'body', title: '🎉 Enter details in AssetNode', description: 'Go to AssetNode → Settings → SSO. Paste SSO URL, Entity ID, and certificate.', fallbackUrl: 'https://app.asset-node.com/settings#ssoSection', nerdMessage: 'Paste them in and SSO is active! 🎉', timeout: 5000 },
]

export const scimOneloginSteps: ExtensionGuideStep[] = [
  { id: 'scim-ol-1', selector: 'body', title: 'Log in to OneLogin', description: 'Navigate to your OneLogin admin portal.', nerdMessage: 'Setting up SCIM provisioning with OneLogin! 👥', timeout: 5000 },
  { id: 'scim-ol-2', selector: 'a[href*="apps"], [data-testid="applications"]', title: 'Add a new application', description: 'Click "Applications" → "Add App". Search for "SCIM Provisioner with SAML (SCIM v2 Core)".', side: 'right', nerdMessage: 'Search for "SCIM Provisioner" in the app catalog 🔍', timeout: 10000 },
  { id: 'scim-ol-3', selector: 'input[name*="name"], input[aria-label*="Display Name"]', title: 'Name the application', description: 'Name it "AssetNode SCIM" and click Save.', side: 'bottom', nerdMessage: 'Name it "AssetNode SCIM" 📝', timeout: 10000 },
  { id: 'scim-ol-4', selector: 'a[href*="configuration"], [data-testid="configuration-tab"]', title: 'Configure SCIM connection', description: 'Click "Configuration" and paste the SCIM Base URL and Bearer Token from AssetNode.', side: 'right', nerdMessage: 'Paste your SCIM URL and Token from AssetNode Settings 📋', timeout: 10000 },
  { id: 'scim-ol-5', selector: 'a[href*="provisioning"], [data-testid="provisioning-tab"]', title: 'Configure Provisioning', description: 'Enable provisioning. Set deletion to "Suspend". Uncheck Create/Delete/Update user actions.', side: 'right', nerdMessage: 'Enable provisioning but disable direct user creation 🔄', timeout: 10000 },
  { id: 'scim-ol-6', selector: 'body', title: '🎉 SCIM is configured!', description: 'Assign users to the application. They will sync to AssetNode automatically.', fallbackUrl: 'https://app.asset-node.com/settings#scimSection', nerdMessage: 'SCIM provisioning is live! 🎉', timeout: 5000 },
]


export const ssoJumpcloudSteps: ExtensionGuideStep[] = [
  { id: 'sso-jc-1', selector: 'body', title: 'Log in to JumpCloud', description: 'Navigate to console.jumpcloud.com.', nerdMessage: 'Setting up SSO with JumpCloud! 🔒', timeout: 5000 },
  { id: 'sso-jc-2', selector: 'a[href*="sso"], [data-testid="sso-applications"]', title: 'Create a new SSO application', description: 'Go to SSO Applications → Add New Application → Custom SAML App.', side: 'right', nerdMessage: 'Create a Custom SAML App 🆕', timeout: 10000 },
  { id: 'sso-jc-3', selector: 'input[name*="entityId"], input[aria-label*="SP Entity ID"]', title: 'Configure SSO settings', description: 'Set SP Entity ID and ACS URL from AssetNode settings.', side: 'bottom', nerdMessage: 'Copy the Entity ID and ACS URL from AssetNode 📋', timeout: 10000 },
  { id: 'sso-jc-4', selector: 'a[href*="certificate"], button:has(span:contains("Download"))', title: 'Download IdP certificate', description: 'Copy the IdP URL and download the certificate.', side: 'right', nerdMessage: 'Download the certificate file 📥', timeout: 10000 },
  { id: 'sso-jc-5', selector: 'body', title: '🎉 Enter details in AssetNode', description: 'Go to AssetNode → Settings → SSO. Paste IdP SSO URL, Entity ID, and certificate.', fallbackUrl: 'https://app.asset-node.com/settings#ssoSection', nerdMessage: 'Paste everything and SSO is connected! 🎉', timeout: 5000 },
]


export const ssoAzureSteps: ExtensionGuideStep[] = [
  { id: 'sso-az-1', selector: 'body', title: 'Log in to Azure Portal', description: 'Navigate to portal.azure.com.', nerdMessage: 'Let\'s set up SAML SSO with Azure AD! 🔒', timeout: 5000 },
  { id: 'sso-az-2', selector: '[data-testid="Microsoft_AAD_IAM"], [aria-label*="Enterprise applications"]', title: 'Create Enterprise Application', description: 'Go to Enterprise Applications → New Application → Create your own.', fallbackUrl: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/StartboardApplicationsJ', side: 'right', nerdMessage: 'Create an Enterprise Application first 🆕', timeout: 10000 },
  { id: 'sso-az-3', selector: 'a[aria-label*="Single sign-on"], [data-testid="single-sign-on"]', title: 'Configure Single Sign-On', description: 'Go to Single sign-on → Select "SAML".', side: 'right', nerdMessage: 'Choose SAML as the sign-on method 🔐', timeout: 10000 },
  { id: 'sso-az-4', selector: 'button[aria-label*="Edit"], [data-testid="basic-saml-edit"]', title: 'Set up Basic SAML Configuration', description: 'Set the Entity ID and Reply URL from your AssetNode SSO settings.', side: 'bottom', nerdMessage: 'Copy Entity ID and Reply URL from AssetNode 📋', timeout: 10000 },
  { id: 'sso-az-5', selector: 'a[aria-label*="Certificate"], button:has(span:contains("Download"))', title: 'Download the certificate', description: 'Download the "Certificate (Base64)".', side: 'bottom', nerdMessage: 'Download the Base64 certificate 📥', timeout: 10000 },
  { id: 'sso-az-6', selector: 'body', title: '🎉 Enter details in AssetNode', description: 'Go to AssetNode → Settings → SSO. Enter Entity ID, SSO URL, and certificate.', fallbackUrl: 'https://app.asset-node.com/settings#ssoSection', nerdMessage: 'Paste everything and SSO is live! 🎉', timeout: 5000 },
]

export const scimAzureSteps: ExtensionGuideStep[] = [
  { id: 'scim-az-1', selector: 'body', title: 'Log in to Azure Portal', description: 'Navigate to portal.azure.com.', nerdMessage: 'Let\'s set up SCIM provisioning with Azure AD! 👥', timeout: 5000 },
  { id: 'scim-az-2', selector: '[aria-label*="Enterprise applications"]', title: 'Create Enterprise Application', description: 'Go to Enterprise Applications → New Application → Create your own application. Name it "AssetNode SCIM".', fallbackUrl: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/StartboardApplicationsJ', side: 'right', nerdMessage: 'Create an Enterprise App named "AssetNode SCIM" 🆕', timeout: 10000 },
  { id: 'scim-az-3', selector: 'a[aria-label*="Provisioning"], [data-testid="provisioning"]', title: 'Open Provisioning', description: 'Click "Provisioning" in the left sidebar.', side: 'right', nerdMessage: 'Navigate to the Provisioning section ⚙️', timeout: 10000 },
  { id: 'scim-az-4', selector: 'select[aria-label*="Provisioning Mode"], [data-testid="provisioning-mode"]', title: 'Set Provisioning Mode', description: 'Change Provisioning Mode to "Automatic". Enter Tenant URL and Secret Token from AssetNode SCIM settings.', note: 'Click "Test Connection" to verify.', side: 'bottom', nerdMessage: 'Set to Automatic and paste your SCIM credentials 📋', timeout: 10000 },
  { id: 'scim-az-5', selector: '[aria-label*="Mappings"], [data-testid="attribute-mappings"]', title: 'Disable Group Provisioning', description: 'Click "Provision Microsoft Entra ID Groups" → set Enabled to "No". Only user provisioning is supported.', side: 'bottom', nerdMessage: 'Disable groups — AssetNode only uses user provisioning 🚫', timeout: 10000 },
  { id: 'scim-az-6', selector: 'a[aria-label*="Users and groups"]', title: 'Assign Users', description: 'Go to "Users and groups" → "Add user/group". Select users to synchronize.', side: 'right', nerdMessage: 'Choose which users to sync to AssetNode 👥', timeout: 10000 },
  { id: 'scim-az-7', selector: 'button[aria-label*="Start provisioning"]', title: 'Start Provisioning', description: 'Go back to Provisioning and click "Start provisioning".', note: 'The initial sync may take a few minutes.', side: 'bottom', nerdMessage: 'Hit Start and you\'re done! SCIM is live! 🎉', timeout: 10000 },
]


export const ssoGoogleSteps: ExtensionGuideStep[] = [
  { id: 'sso-gw-1', selector: 'body', title: 'Log in to Google Admin', description: 'Navigate to admin.google.com.', nerdMessage: 'Setting up Google Workspace SSO! 🔵', timeout: 5000 },
  { id: 'sso-gw-2', selector: 'a[href*="apps"], [data-testid="apps-menu"]', title: 'Navigate to SAML apps', description: 'Go to Apps → Web and mobile apps → Add custom SAML app.', side: 'right', nerdMessage: 'Find Web and mobile apps 📱', timeout: 10000 },
  { id: 'sso-gw-3', selector: '[data-testid="download-metadata"], button:has(span:contains("Download"))', title: 'Download Google IdP metadata', description: 'Download IdP metadata or copy SSO URL and certificate.', side: 'bottom', nerdMessage: 'Download the IdP metadata or cert 📥', timeout: 10000 },
  { id: 'sso-gw-4', selector: 'input[name*="acsUrl"], input[aria-label*="ACS URL"]', title: 'Configure Service Provider details', description: 'Set ACS URL and Entity ID from AssetNode settings.', side: 'bottom', nerdMessage: 'Copy ACS URL and Entity ID from AssetNode 📋', timeout: 10000 },
  { id: 'sso-gw-5', selector: 'body', title: '🎉 Enter details in AssetNode', description: 'Go to AssetNode → Settings → SSO. Paste Google SSO URL, Entity ID, and certificate.', fallbackUrl: 'https://app.asset-node.com/settings#ssoSection', nerdMessage: 'Paste everything and Google SSO is live! 🎉', timeout: 5000 },
]
