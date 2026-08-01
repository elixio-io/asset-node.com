<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

const props = defineProps<{
  slug?: string
}>()

const route = useRoute()
const router = useRouter()
const guideSlug = computed(() => props.slug || '')


interface GuideStep {
  title: string
  description: string
  note?: string
  images?: string[]
}

interface GuideDefinition {
  title: string
  category: 'scim' | 'mdm' | 'sso' | 'hr'
  icon: string
  iconColor: string
  providerName: string
  intro: string
  settingsSection: string
  steps: GuideStep[]
  afterSteps: string[]
  syncInfo?: string
  imageDir?: string
}

const GUIDES: Record<string, GuideDefinition> = {
  'scim-azure-ad': {
    title: 'SCIM with Microsoft Entra ID (Azure AD)',
    category: 'scim',
    icon: 'pi pi-microsoft',
    iconColor: 'blue',
    providerName: 'Microsoft Entra ID',
    intro: 'Automatically sync employee entries with users from Microsoft Entra ID (formerly Azure AD). Any changes you make to users in Entra ID will be synchronized to AssetNode. To sync department, location and/or manager, enable the corresponding options in your AssetNode SCIM settings before you start provisioning.',
    settingsSection: 'scimSection',
    imageDir: 'sso-azure-ad',
    steps: [
      {
        title: 'Log in to Azure and open Entra ID',
        description: 'Navigate to portal.azure.com, sign in with your administrator account, and click on Microsoft Entra ID.',
        images: ['64a70c585f2502e358f8c613_scim-ad-1.webp']
      },
      {
        title: 'Create a new Enterprise Application',
        description: 'Go to the Manage tab → Enterprise Applications → New Application → Create your own application.',
        images: ['64a70c6ea6a0c18c05446146_scim-ad-2.webp']
      },
      {
        title: 'Name your application',
        description: 'Enter "AssetNode SCIM" as the name, select "Integrate any other application you don\'t find in the gallery (Non-gallery)", and click Create.',
        images: ['64a70c7ee0642a8f0fdd14ff_scim-ad-3.webp']
      },
      {
        title: 'Open Provisioning settings',
        description: 'In your newly created application, click on Provisioning in the left sidebar, then click on Provisioning again to open the configuration.',
        images: ['64a70c8df630fe0aca1a1482_scim-ad-4.webp']
      },
      {
        title: 'Set Provisioning Mode and enter credentials',
        description: 'Change the Provisioning Mode to "Automatic". In the Admin Credentials section, enter the Tenant URL and Secret Token from your AssetNode Settings → SCIM 2.0 section. Click "Test Connection" to verify the connection works, then click Save.',
        note: 'If Test Connection fails, double-check that you copied the full SCIM Endpoint URL and Bearer Token from AssetNode.'
      },
      {
        title: 'Disable Group Provisioning',
        description: 'After saving, a Mappings section will appear further down on the same page. Click on "Provision Microsoft Entra ID Groups" and set Enabled to "No". Click Save.',
        note: 'AssetNode does not use SCIM group provisioning — only user provisioning is supported.'
      },
      {
        title: 'Open User Attribute Mappings',
        description: 'Back in the Mappings section, click on "Provision Microsoft Entra ID Users" to open the user attribute mapping configuration.'
      },
      {
        title: 'Change userName to use email',
        description: 'Find the "userName" attribute row and click the Edit button. Change the Source attribute from "userPrincipalName" to "mail", then click Ok.',
        note: 'This is important: userPrincipalName may not match the employee\'s actual email address. Using "mail" ensures the correct email is synced.'
      },
      {
        title: 'Add the location attribute (optional)',
        description: 'Scroll down and click "Show advanced options", then click "Edit attribute list for customappsso". Add a new attribute with the name "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:location" as type String, then click Save.',
        note: 'Only required if you want to sync employee locations from Entra ID to AssetNode.'
      },
      {
        title: 'Map the location field (optional)',
        description: 'Click "Add New Mapping". Select the Entra ID field you want to use as the employee\'s location (e.g. "country", "officeLocation", or "city") as the Source attribute. Set the Target attribute to "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:location". Click Ok, then Save.',
        note: 'Choose whichever Entra ID field best represents the employee\'s work location for your organization.'
      },
      {
        title: 'Assign Users and Groups',
        description: 'Go back to the application overview. Click on "Users and groups" in the left sidebar, then click "Add user/group". Select all the users or groups you want to synchronize as employees to AssetNode.'
      },
      {
        title: 'Start Provisioning',
        description: 'Go back to Provisioning and click "Start provisioning". The initial synchronization will begin and may take a few minutes depending on the number of users.',
        note: 'You can monitor the provisioning status on this page. If any errors occur, check the provisioning logs for details.'
      }
    ],
    afterSteps: [
      'The synchronization runs approximately every 40 minutes. Any changes you make to users in Entra ID will be automatically reflected in AssetNode.',
      'If you change an employee\'s name, email, or job title in Entra ID, it will automatically update in AssetNode.',
      'If you remove a user from Entra ID, they are marked as "Archived" in AssetNode (not deleted) — they may still have assets checked out.',
      'To sync department and manager info, enable the corresponding options in your AssetNode SCIM settings.'
    ],
    syncInfo: 'Syncs every ~40 minutes'
  },

  'scim-okta': {
    title: 'SCIM with Okta',
    category: 'scim',
    icon: 'pi pi-shield',
    iconColor: 'blue-darken-2',
    providerName: 'Okta',
    intro: 'Automatically sync employee entries with users from Okta. Any changes in Okta will be synchronized to AssetNode in real-time.',
    settingsSection: 'scimSection',
    steps: [
      { title: 'Log in to your Okta Admin Console', description: 'Navigate to your Okta organization admin dashboard.', images: ['64a712b3034c8a3bd89b44e7_scim-okta-1.webp'] },
      { title: 'Add a new application', description: 'Go to Applications → Applications → Browse App Catalog. Search for "SCIM 2.0 Test App (Header Auth)" and add it.', images: ['64a712dde6065686c01a9275_scim-okta-2.webp', '64a712eb294d204a2d6ca7a3_scim-okta-3.webp'] },
      { title: 'Configure General Settings', description: 'Name the application "AssetNode" and click Next through the sign-on options.', images: ['64a71302a7ddb1725d31000a_scim-okta-4.webp', '64a7130d339568621e058309_scim-okta-5.webp'] },
      { title: 'Configure Provisioning', description: 'Go to the Provisioning tab → Configure API Integration. Check "Enable API Integration".', images: ['64a713171d86ff1872203ea8_scim-okta-6.webp', '64a713587b9f4ed003bd6c21_scim-okta-6b.webp'] },
      { title: 'Enter SCIM credentials', description: 'Set the SCIM 2.0 Base URL to the Endpoint URL from your AssetNode SCIM settings. Set the API Token to the Bearer Token from AssetNode.', note: 'Click "Test API Credentials" to verify the connection.', images: ['64a71371f3fe43beff6a914e_scim-okta-7.webp', '64a7137c4e005422c815eb4e_scim-okta-8.webp'] },
      { title: 'Enable provisioning actions', description: 'Under "To App": Enable Create Users, Update User Attributes, and Deactivate Users.', images: ['64a713889e2444ee6797c091_scim-okta-9.webp', '64a71393a58560516dc94340_scim-okta-10.webp'] },
      { title: 'Assign users', description: 'Go to the Assignments tab and assign the users or groups you want to sync.', images: ['64a713a506ea28df0bc03eb7_scim-okta-11.webp'] },
      { title: 'Enable additional sync options (Optional)', description: 'In AssetNode → Settings → SCIM, enable location, department, and manager sync as needed.', images: ['64d12626c91de54b2c9292aa_scim-okta-a.webp', '64d12682b499c12f9a13841c_scim-okta-b.webp'] }
    ],
    afterSteps: [
      'Synchronization takes place approximately every 40 minutes.',
      'Any changes to users in Okta will be reflected in AssetNode.',
      'If you remove a user from Okta, they are marked as "Archived" in AssetNode but not deleted.',
      'Enable location, department, and manager sync options in AssetNode\'s SCIM settings.'
    ],
    syncInfo: 'Syncs every ~40 minutes'
  },

  'scim-onelogin': {
    title: 'SCIM with OneLogin',
    category: 'scim',
    icon: 'pi pi-user',
    iconColor: 'teal',
    providerName: 'OneLogin',
    intro: 'Automatically sync employee entries with users from OneLogin. Setup your integration in only a few steps. To sync a person\'s department, location and/or manager from OneLogin to AssetNode, you need to enable the corresponding option in your AssetNode account settings in the SCIM 2.0 section before you enable provisioning.',
    settingsSection: 'scimSection',
    imageDir: 'scim-onelogin',
    steps: [
      {
        title: 'Log in to your OneLogin account',
        description: 'Navigate to your OneLogin admin portal and sign in.',
        images: ['64a7f85555a7fe9f54389cf0_scim-onelogin-1.webp']
      },
      {
        title: 'Add a new application',
        description: 'Click on "Applications", then on "Add App".',
        images: ['64a7f87c4bf853c684906e7e_scim-onelogin-2.webp']
      },
      {
        title: 'Search for the SCIM app',
        description: 'Search for "SCIM Provisioner with SAML (SCIM v2 Core)" and select it.',
        images: ['64a7f8b88a50f69e0be655e0_scim-onelogin-3.webp']
      },
      {
        title: 'Name and save the application',
        description: 'Give it a name (like "AssetNode SCIM") and click "Save". You might get an error notification after this, but you can safely ignore it.',
        images: ['64a7f8d3b047ad9e30fadfa8_scim-onelogin-4.webp']
      },
      {
        title: 'Open the Parameters tab',
        description: 'Click on "Parameters" in the left menu bar.',
        images: ['64a7f9032aef4a9c74287cad_scim-onelogin-5.webp']
      },
      {
        title: 'Add the "name" parameter',
        description: 'Click on the "+" to add a new parameter. Enter "name" in the Field Name and click "Save". Then search for "Name" in the Value dropdown, select it and click "Save".',
        images: ['64a7f92b1b256233e2aab8f9_scim-onelogin-6.webp', '64a7f946a8469f04b1e256bb_scim-onelogin-7.webp']
      },
      {
        title: 'Add the "title" parameter',
        description: 'Add another parameter with the Field Name "title". Search for "Title" in the Value dropdown, select it and click "Save".',
        images: ['64a7f9678a50f69e0be813f7_scim-onelogin-8.webp', '64a7f9912c1f680fd2ec4178_scim-onelogin-9.webp']
      },
      {
        title: 'Add the "department" parameter',
        description: 'Add another parameter with the Field Name "department". Search for "Department" in the Value dropdown, select it and click "Save".',
        images: ['64a7f9ca1b256233e2ab880e_scim-onelogin-10.webp', '64a7fa085cfc27b40ebf8fdf_scim-onelogin-11.webp']
      },
      {
        title: 'Add the "location" parameter (optional)',
        description: 'Add another parameter with the Field Name "location". Select which field in OneLogin you\'d like to map to the employee\'s location field in AssetNode (e.g. "company"). You can skip this step if you don\'t want to sync the location.',
        images: ['64d199d1df46a7344b1e1f91_scim-onelogin-12.webp', '64a7fa51f39955b6cc31950d_scim-onelogin-13.webp']
      },
      {
        title: 'Save the parameters',
        description: 'Click on "Save" in the top right corner to save all the parameter mappings.',
        images: ['64a7fa64902d4f82be068a48_scim-onelogin-14.webp']
      },
      {
        title: 'Configure SCIM connection',
        description: 'Click on "Configuration" in the left menu bar. Copy the "Endpoint URL" and the "Secret Token" from your AssetNode account settings (SCIM 2.0 section), and paste them into the "SCIM Base URL" and "SCIM Bearer Token" fields.',
        images: ['64a7fa7eb047ad9e30fc8f87_scim-onelogin-15.webp', '64a7fa900027a200a66cf04c_scim-onelogin-16.webp']
      },
      {
        title: 'Paste the SCIM JSON Template',
        description: 'Scroll down and paste the SCIM JSON Template into the "SCIM JSON Template" field.',
        images: ['64a7fac6902d4f82be06fcb6_scim-onelogin-17.webp']
      },
      {
        title: 'Enable the API connection',
        description: 'Scroll back up and click on "Enable" to activate the SCIM connection.',
        images: ['64d198b6d6587cc384570c8f_scim-onelogin-a.webp']
      },
      {
        title: 'Save the configuration',
        description: 'Click on "Save" in the top right corner.',
        images: ['64d199111e54ed9858b857fc_scim-onelogin-b.webp']
      },
      {
        title: 'Configure Provisioning',
        description: 'Click on "Provisioning" in the left menu bar. Check the "Enable Provisioning" checkbox. Un-check the "Create user", "Delete user" and "Update user" fields. Change the deletion dropdown value to "Suspend". Click "Save".',
        note: 'This ensures that user lifecycle is managed through AssetNode — OneLogin will only sync data, not create or delete employees directly.',
        images: ['64a7fadbe20b64bb34ccce6c_scim-onelogin-18.webp']
      },
      {
        title: 'Select a user to assign',
        description: 'Click on "Users" in the top menu bar and then select a user that you would like to add to the app.',
        images: ['64a7fafa7c7fc8bae4871a7f_scim-onelogin-19.webp', '64a7fb1a0027a200a66d89bc_scim-onelogin-20.webp']
      },
      {
        title: 'Add user to the application',
        description: 'Click on "Applications", then click the "+" button. Select the app you just created (AssetNode SCIM) and click "Continue". Then click "Save".',
        images: ['64a7fb32aa1a8a259350852e_scim-onelogin-21.webp', '64a7fb53e7e2208272ac6e26_scim-onelogin-22.webp', '64a7fb72315795109d112820_scim-onelogin-23.webp']
      },
      {
        title: 'Verify provisioning',
        description: 'You can now see that the user has been provisioned and added to the app. Repeat the user assignment process for all the users you\'d like to add as employees.',
        images: ['64a7fb8aaa1a8a259350e5e8_scim-onelogin-24.webp', '64a7fbabaa1a8a2593510dd7_scim-onelogin-25.webp']
      }
    ],
    afterSteps: [
      'The synchronization takes place approximately every 40 minutes. Any changes you make to users in OneLogin will be automatically reflected in AssetNode.',
      'To sync the employee\'s location, enable "Set employee location info from Identity Provider" in your AssetNode SCIM settings.',
      'To sync the employee\'s department, enable "Set employee department info from Identity Provider" in your AssetNode SCIM settings.',
      'If you remove a user from OneLogin, they are marked as "Archived" in AssetNode (not deleted) — they may still have assets checked out.'
    ],
    syncInfo: 'Syncs every ~40 minutes'
  },

  'intune': {
    title: 'Microsoft Intune Integration', category: 'mdm', icon: 'pi pi-microsoft', iconColor: 'blue', providerName: 'Microsoft Intune',
    intro: 'Automatically add devices from Intune into AssetNode as assets.',
    settingsSection: 'intuneSection',
    steps: [
      { title: 'Log in to your Azure Portal', description: 'Navigate to portal.azure.com and sign in.', images: ['649b1584e2104216889f3298_app-registration.webp'] },
      { title: 'Register a new application', description: 'Go to App registrations → New registration. Name it "AssetNode Intune".', images: ['649b1584e2104216889f3299_new registration.webp'] },
      { title: 'Note your credentials', description: 'Copy the Application (client) ID and Directory (tenant) ID.', images: ['64a2814bfa8e6bfde368252e_intune-3.webp'] },
      { title: 'Create a client secret', description: 'Go to Certificates & secrets → New client secret. Copy the Value immediately.', images: ['6903b227b731fd3519f6daec_intune-4-new.webp'] },
      { title: 'Configure API permissions', description: 'Add DeviceManagementManagedDevices.Read.All. Grant admin consent.', images: ['64a283e6d886f6640a8916f4_intune-6.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to Settings → Intune section. Enter the Tenant ID, Client ID, and Client Secret.', note: 'The first device sync will take approximately 10 minutes.', images: ['64a6be020038431349306354_intune-8.webp'] },
      { title: 'Verify sync', description: 'Check the sync status and verify devices appear in your asset list.', images: ['64a6c4c16daf003434b89282_intune-14.webp'] }
    ],
    afterSteps: ['To automatically checkout assets to employees, add employees first (via SCIM or import).', 'New devices added to Intune are automatically created as assets in AssetNode.'],
    syncInfo: 'Syncs every ~10 minutes'
  },

  'autopilot': {
    title: 'Windows Autopilot Integration', category: 'mdm', icon: 'pi pi-microsoft', iconColor: 'blue', providerName: 'Windows Autopilot',
    intro: 'Automatically add devices from Windows Autopilot into AssetNode as assets.',
    settingsSection: 'autopilotSection',
    steps: [
      { title: 'Log in to your Azure account', description: 'Navigate to portal.azure.com and sign in.', images: ['677e672b56a1b8c0bd2da1b0_autopilot_1.webp'] },
      { title: 'Register a new application', description: 'Go to App registrations → New registration.', images: ['649b1584e2104216889f3298_app-registration.webp'] },
      { title: 'Set up API permissions', description: 'Add DeviceManagementServiceConfig.Read.All.', images: ['6903b4f4f09c3bf6c7b54dc8_autopilot-4-new.webp'] },
      { title: 'Create a client secret', description: 'Go to Certificates & secrets → New client secret.', images: ['677e67df7c03c03d09f6c598_autopilot_6.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → Autopilot section.', images: ['677e683cc45e4db0e24c44b5_autopilot_9.webp'] },
      { title: 'Verify the integration', description: 'Verify that Autopilot devices appear in your asset list.', images: ['677e69214d15448bfdb2341e_autopilot_13.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'All new Autopilot devices will be automatically added as assets.'],
    syncInfo: 'Syncs periodically'
  },

  'kandji': {
    title: 'Kandji Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'amber', providerName: 'Kandji',
    intro: 'Automatically add devices from Kandji into AssetNode as assets.',
    settingsSection: 'kandjiSection',
    steps: [
      { title: 'Log in to your Kandji account', description: 'Navigate to your Kandji tenant.', images: ['64a7095730e87feb388981ca_kandji-1.webp'] },
      { title: 'Access API tokens', description: 'Navigate to Settings → Access → API Token.', images: ['64a70979d519617f8ae62c5a_kandji-3.webp'] },
      { title: 'Create an API token', description: 'Name the token "AssetNode Integration".', images: ['64a7098ea6a0c18c05409480_kandji-4.webp'] },
      { title: 'Enter details in AssetNode', description: 'Go to AssetNode Settings → MDM section.', images: ['64a709b185de4853cb52c6f8_kandji-6.webp'] },
      { title: 'Save and verify', description: 'Click Save. The first sync will take approximately 10 minutes.', images: ['64a709d4bc003bb90dcb45c1_kandji-9.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'New devices added to Kandji will automatically be added as assets.'],
    syncInfo: 'Syncs every ~10 minutes'
  },

  'jamf-pro': {
    title: 'Jamf Pro Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'grey', providerName: 'Jamf Pro',
    intro: 'Automatically add devices from Jamf Pro into AssetNode as assets.',
    settingsSection: 'jamfProSection',
    steps: [
      { title: 'Log in to your Jamf Pro account', description: 'Navigate to your Jamf Pro instance URL.', images: ['64a6c8ad523e75aed30cd60b_jamf-pro-1.webp'] },
      { title: 'Access API Settings', description: 'Under System Settings, find API Roles and Clients.', images: ['64a6c8ace1f3eed3ffedb476_jamf-pro-3.webp'] },
      { title: 'Create an API role', description: 'Create a new API role with Read permissions.', images: ['64a6c8ac3d9207c4a1bfc71f_jamf-pro-4.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → Jamf Pro section.', images: ['64a6c8afe310b4beae8154ba_jamf-pro-7.webp'] },
      { title: 'Save and enable', description: 'Click Save and Enable.', images: ['64a6c8b0c7c50d4bdb7b9fa6_jamf-pro-9.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'New devices added to Jamf Pro will automatically be added as assets.'],
    syncInfo: 'Syncs every ~10 minutes'
  },

  'jamf-school': {
    title: 'Jamf School Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'grey', providerName: 'Jamf School',
    intro: 'Automatically add devices from Jamf School into AssetNode as assets.',
    settingsSection: 'jamfSchoolSection',
    steps: [
      { title: 'Log in to your Jamf School account', description: 'Navigate to your Jamf School portal.', images: ['64a6d1f41af57cec8cb06ab8_jamf-school-1.webp'] },
      { title: 'Navigate to Organization Settings', description: 'Go to Organisation → Settings.', images: ['64a6d2d6c203d8b95a6f2699_jamf-school-2.webp'] },
      { title: 'Create an API key', description: 'Click "Add API Key" and name it "AssetNode".', images: ['64a6d34172b0c8b654e535aa_jamf-school-4.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → Jamf School section.', images: ['64a6d3f8e3dbb06c914dba72_jamf-school-6.webp'] },
      { title: 'Save and verify', description: 'Click Save and Enable.', images: ['64a6d421f0eee83abf62fd7f_jamf-school-7.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'New devices added to Jamf School will automatically be added as assets.'],
    syncInfo: 'Syncs every ~10 minutes'
  },

  'sso-azure-ad': {
    title: 'Single Sign-On with Azure Active Directory', category: 'sso', icon: 'pi pi-microsoft', iconColor: 'blue', providerName: 'Azure AD',
    intro: 'Let your team members log in to AssetNode using their Microsoft credentials.',
    settingsSection: 'ssoSection',
    steps: [
      { title: 'Log in to your Azure Portal', description: 'Navigate to portal.azure.com.', images: ['64a70c585f2502e358f8c613_scim-ad-1.webp'] },
      { title: 'Create an Enterprise Application', description: 'Go to Enterprise Applications → New Application → Create your own.', images: ['64a70c6ea6a0c18c05446146_scim-ad-2.webp'] },
      { title: 'Configure Single Sign-On', description: 'Go to Single sign-on → Select "SAML".', images: ['64a70c8df630fe0aca1a1482_scim-ad-4.webp'] },
      { title: 'Set up Basic SAML Configuration', description: 'Set the Entity ID and Reply URL from your AssetNode SSO settings.', images: ['64a70daaf2e26e962dbc241d_sso-ad-5.webp'] },
      { title: 'Download the certificate', description: 'Download the "Certificate (Base64)".', images: ['64a70ddea72fe7514bbfe926_sso-ad-7.webp'] },
      { title: 'Enter details in AssetNode', description: 'Go to Settings → SSO section. Enter Entity ID, SSO URL, and certificate.', images: ['64a70e4673220940048cddb5_sso-ad-10.webp'] },
      { title: 'Assign users', description: 'Assign users or groups to the application.', images: ['64a70e9973220940048d3eff_sso-ad-12.webp'] }
    ],
    afterSteps: ['Once SSO is active, new users get access by being assigned in Azure AD.', 'You can enable "Force SSO" to disable password-based login entirely.']
  },

  'sso-okta': {
    title: 'Single Sign-On with Okta', category: 'sso', icon: 'pi pi-shield', iconColor: 'blue', providerName: 'Okta',
    intro: 'Let your team members log in to AssetNode using their Okta credentials.',
    settingsSection: 'ssoSection',
    steps: [
      { title: 'Log in to your Okta account', description: 'Navigate to your Okta admin dashboard.', images: ['64a713ed5af3b3fb11ebd7e1_sso-okta-2.webp'] },
      { title: 'Create a new SAML application', description: 'Go to Applications → Create App Integration → Select "SAML 2.0".', images: ['64a713fc870b4648f64488e8_sso-okta-3.webp'] },
      { title: 'Configure SAML Settings', description: 'Set the SSO URL and Audience URI from AssetNode settings.', images: ['64a7145ff453b3b68033a894_sso-okta-7.webp'] },
      { title: 'Copy IdP metadata', description: 'Copy SSO URL and download certificate.', images: ['64a7149b5eadd01a5e5a31cc_sso-okta-10.webp'] },
      { title: 'Enter details in AssetNode', description: 'Paste the IdP SSO URL, Entity ID, and certificate. Click Save.', images: ['64a714d2adc125c78a977ddb_sso-okta-12.webp'] }
    ],
    afterSteps: ['Once SSO is active, giving new users access is done by assigning them in Okta.', 'Enable "Force SSO" to require all users to sign in via Okta.']
  },

  'sso-onelogin': {
    title: 'Single Sign-On with OneLogin', category: 'sso', icon: 'pi pi-user', iconColor: 'teal', providerName: 'OneLogin',
    intro: 'Let your team members log in to AssetNode using their OneLogin credentials.',
    settingsSection: 'ssoSection',
    steps: [
      { title: 'Log in to your OneLogin account', description: 'Navigate to your OneLogin admin portal.', images: ['64a8040155a7fe9f54469f16_sso-onelogin-2.webp'] },
      { title: 'Add a custom SAML application', description: 'Search for "SAML Custom Connector (Advanced)".', images: ['64a8041bfae66900b406c55f_sso-onelogin-3.webp'] },
      { title: 'Set up SAML configuration', description: 'Enter ACS URL and SAML Audience from AssetNode SSO settings.', images: ['64a8057f5cfc27b40eceb8c9_sso-onelogin-8.webp'] },
      { title: 'Copy OneLogin SSO details', description: 'Copy SAML 2.0 Endpoint URL and download certificate.', images: ['64a805d8e7e2208272bb01c8_sso-onelogin-10.webp'] },
      { title: 'Enter details in AssetNode', description: 'Paste SSO URL, Entity ID, and certificate.', images: ['64a80666165ce9ca6d9ce5ea_sso-onelogin-12.webp'] },
      { title: 'Assign users', description: 'Assign users to the AssetNode application.', images: ['64a806b212df48ce9afba178_sso-onelogin-14.webp'] }
    ],
    afterSteps: ['Once SSO is active, giving new users access is done by assigning them in OneLogin.', 'Enable "Force SSO" to require all users to sign in via OneLogin.']
  },

  'sso-jumpcloud': {
    title: 'Single Sign-On with JumpCloud', category: 'sso', icon: 'pi pi-cloud', iconColor: 'green', providerName: 'JumpCloud',
    intro: 'Let your team members log in to AssetNode using their JumpCloud credentials.',
    settingsSection: 'ssoSection',
    steps: [
      { title: 'Log in to your JumpCloud', description: 'Navigate to console.jumpcloud.com.', images: ['64a818489753adeb6f7fd541_sso-jumpcloud-1.webp'] },
      { title: 'Create a new SSO application', description: 'Go to SSO Applications → Add New Application → Custom SAML App.', images: ['64a8186755a7fe9f54602b4f_sso-jumpcloud-2.webp'] },
      { title: 'Configure SSO settings', description: 'Set SP Entity ID and ACS URL from AssetNode settings.', images: ['64a8189b0027a200a69150e4_sso-jumpcloud-4.webp'] },
      { title: 'Download IdP certificate', description: 'Copy the IdP URL and download the certificate.', images: ['64a81a317c7fc8bae4b1c290_sso-jumpcloud-7.webp'] },
      { title: 'Enter details in AssetNode', description: 'Paste IdP SSO URL, Entity ID, and certificate.', images: ['64a81a517a826a25da44aec6_sso-jumpcloud-9.webp'] }
    ],
    afterSteps: ['Once SSO is active, giving new users access is done by adding them to the bound user group.', 'Enable "Force SSO" to require all users to sign in via JumpCloud.']
  },

  'sso-google-workspace': {
    title: 'Single Sign-On with Google Workspace', category: 'sso', icon: 'pi pi-google', iconColor: 'red', providerName: 'Google Workspace',
    intro: 'Let your team members log in to AssetNode using their Google Workspace accounts.',
    settingsSection: 'ssoSection',
    steps: [
      { title: 'Log into your Google Workspace admin account', description: 'Navigate to admin.google.com.', images: ['64a81d84d6a0ef9641e79ee9_sso-google-1.webp'] },
      { title: 'Navigate to SAML apps', description: 'Go to Apps → Web and mobile apps → Add custom SAML app.', images: ['64a81d938d74c29ee61c6a70_sso-google-2.webp'] },
      { title: 'Download Google IdP metadata', description: 'Download IdP metadata or copy SSO URL and certificate.', images: ['64a81e2911a3d50157b40f05_sso-google-3.webp'] },
      { title: 'Configure Service Provider details', description: 'Set ACS URL and Entity ID from AssetNode settings.', images: ['64a81e60bc1ba74727120bcf_sso-google-6.webp'] },
      { title: 'Enter details in AssetNode', description: 'Paste Google SSO URL, Entity ID, and certificate.', images: ['64a81e8b7c58bdb6ef1f218e_sso-google-8.webp'] },
      { title: 'Enable the app for users', description: 'Turn on the app for everyone or specific organizational units.', images: ['64a81e9f8a50f69e0b180d87_sso-google-9.webp'] }
    ],
    afterSteps: ['Once SSO is active, giving new users access is done by enabling the app in Google Admin.', 'Enable "Force SSO" to require all users to sign in via Google.']
  },

  'mosyle': {
    title: 'Mosyle MDM Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'purple', providerName: 'Mosyle',
    intro: 'Automatically import Apple devices from Mosyle Manager into AssetNode as assets.',
    settingsSection: 'mosyleSection',
    steps: [
      { title: 'Log in to Mosyle Manager', description: 'Navigate to your Mosyle Manager portal and sign in with administrator credentials.' },
      { title: 'Generate an API token', description: 'Go to Organization → Integrations → API Integration. Enable API access and generate a new API token.' },
      { title: 'Copy the API token', description: 'Copy the generated API token. You will need this in the next step.', note: 'Store this token securely — it is only shown once.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → MDM section → Mosyle. Paste the API token and click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin syncing Apple devices from Mosyle. The first sync may take a few minutes.' }
    ],
    afterSteps: [
      'The first device transfer takes approximately 10 minutes.',
      'New devices enrolled in Mosyle will automatically appear as assets in AssetNode.',
      'Mosyle syncs Macs, iPhones, iPads, and Apple TVs.'
    ],
    syncInfo: 'Syncs every ~10 minutes'
  },

  'personio': {
    title: 'Personio HR Integration', category: 'hr', icon: 'pi pi-users', iconColor: 'teal', providerName: 'Personio',
    intro: 'Automatically sync employees from Personio HR into AssetNode. Active employees will be created and kept up to date.',
    settingsSection: 'personioSection',
    steps: [
      { title: 'Log in to Personio', description: 'Navigate to your Personio account at yourcompany.personio.de and sign in as an administrator.' },
      { title: 'Create API credentials', description: 'Go to Settings → Integrations → API Credentials. Click "Generate new credentials".' },
      { title: 'Set API permissions', description: 'Grant read access to "Employees" and "Employment details". These are the minimal required scopes.' },
      { title: 'Copy Client ID and Client Secret', description: 'Copy both the Client ID and Client Secret. You will need these in the next step.', note: 'The Client Secret is only shown once — store it securely.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → Personio. Enter the Client ID, Client Secret, and click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin importing your employee directory. The first sync may take a few minutes.' }
    ],
    afterSteps: [
      'Active employees from Personio will be automatically created in AssetNode.',
      'Employee department, job title, and start date are synced from employment records.',
      'If an employee is deactivated in Personio, they will be marked as inactive in AssetNode.'
    ],
    syncInfo: 'Syncs on configured interval'
  },

  'bamboohr': {
    title: 'BambooHR Integration', category: 'hr', icon: 'pi pi-users', iconColor: 'green', providerName: 'BambooHR',
    intro: 'Automatically sync your employee directory from BambooHR into AssetNode.',
    settingsSection: 'bamboohrSection',
    steps: [
      { title: 'Log in to BambooHR', description: 'Navigate to your BambooHR account at yourcompany.bamboohr.com.' },
      { title: 'Generate an API key', description: 'Click your profile icon → API Keys → Add New Key. Name it "AssetNode Integration".' },
      { title: 'Copy the API key', description: 'Copy the generated API key immediately.', note: 'The API key is only displayed once — store it securely.' },
      { title: 'Note your subdomain', description: 'Your BambooHR subdomain is the part before .bamboohr.com in your URL (e.g. "acme" for acme.bamboohr.com).' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → BambooHR. Enter the subdomain and API key, then click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will import your employee directory. The first sync may take a few minutes.' }
    ],
    afterSteps: [
      'Active employees from BambooHR will be automatically created and updated in AssetNode.',
      'Employee name, email, department, job title, and location are synced.',
      'BambooHR\'s directory API returns only active employees by default.'
    ],
    syncInfo: 'Syncs on configured interval'
  },

  'google-workspace-directory': {
    title: 'Google Workspace Directory Sync', category: 'hr', icon: 'pi pi-google', iconColor: 'red', providerName: 'Google Workspace Directory',
    intro: 'Automatically sync users from your Google Workspace directory into AssetNode as employees.',
    settingsSection: 'googleWorkspaceSection',
    steps: [
      { title: 'Open Google Cloud Console', description: 'Navigate to console.cloud.google.com and select your organization\'s project.' },
      { title: 'Enable the Admin SDK API', description: 'Go to APIs & Services → Library. Search for "Admin SDK API" and click Enable.' },
      { title: 'Create a service account', description: 'Go to IAM & Admin → Service Accounts → Create Service Account. Name it "AssetNode Directory Sync".' },
      { title: 'Create a JSON key', description: 'Click on the service account → Keys → Add Key → Create new key → JSON. Download the key file.', note: 'This file contains your private key — store it securely and never commit to version control.' },
      { title: 'Configure domain-wide delegation', description: 'In Google Admin (admin.google.com) → Security → API controls → Domain-wide delegation → Add new. Enter the service account\'s Client ID and grant scope: https://www.googleapis.com/auth/admin.directory.user.readonly' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → Google Workspace. Paste the service account email, private key from the JSON file, and your admin email (for impersonation). Click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin importing users from your Google Workspace domain.' }
    ],
    afterSteps: [
      'Users from your Google Workspace domain will be automatically synced to AssetNode.',
      'Suspended users in Google Workspace will be marked as inactive in AssetNode.',
      'Department and job title are synced from Google Workspace organization data.'
    ],
    syncInfo: 'Syncs on configured interval'
  },

  'hibob': {
    title: 'HiBob HR Integration', category: 'hr', icon: 'pi pi-users', iconColor: 'orange', providerName: 'HiBob',
    intro: 'Automatically sync employees from HiBob into AssetNode. Active employees will be created and kept up to date.',
    settingsSection: 'hibobSection',
    steps: [
      { title: 'Log in to HiBob', description: 'Navigate to app.hibob.com and sign in with your administrator account.' },
      { title: 'Create a Service User', description: 'Go to Settings → Integrations → Service Users → Add a new service user. Name it "AssetNode Integration".' },
      { title: 'Set permissions', description: 'Grant read-only access to "People" data. This is the minimum required permission.' },
      { title: 'Generate an API token', description: 'Under the service user, generate a new API token. Copy both the Service User ID and the API token.', note: 'The API token is only shown once — store it securely.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → HiBob. Enter the Service User ID and API token, then click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin importing your employee list. The first sync may take a few minutes.' }
    ],
    afterSteps: [
      'Active employees from HiBob will be automatically created in AssetNode.',
      'Employee name, email, department, job title, site, and start date are synced.',
      'The sync only imports active employees (inactive employees are excluded).'
    ],
    syncInfo: 'Syncs on configured interval'
  }
}


const guide = computed(() => GUIDES[guideSlug.value] || null)

const categoryLabel = computed(() => {
  switch (guide.value?.category) {
    case 'scim': return 'SCIM Provisioning'
    case 'mdm': return 'MDM Integration'
    case 'sso': return 'Single Sign-On'
    case 'hr': return 'HR Sync'
    default: return 'Setup Guide'
  }
})

const categorySeverity = computed(() => {
  switch (guide.value?.category) {
    case 'scim': return 'success'
    case 'mdm': return 'info'
    case 'sso': return 'warn'
    case 'hr': return 'contrast'
    default: return 'secondary'
  }
})

function imageUrl(filename: string): string {
  const dir = guide.value?.imageDir || guideSlug.value
  return `/guide-images/${dir}/${filename}`
}

function goToSettings() {
  if (guide.value) {
    const el = document.getElementById(guide.value.settingsSection)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }
}

const expandedImage = ref('')
const lightboxOpen = ref(false)

function openLightbox(img: string) { expandedImage.value = img; lightboxOpen.value = true }
function closeLightbox() { lightboxOpen.value = false }
</script>

<template>
  <div class="integration-guide-embedded">
    <Message v-if="!guide && slug" severity="warn" class="mb-4">Guide not found. Check the URL and try again.</Message>

    <template v-if="guide">
        <div class="an-card mb-4" style="padding:24px;">
          <div class="flex align-items-center gap-3 mb-3">
            <div class="guide-avatar" :style="{background: `var(--p-${guide.iconColor}-500, var(--p-primary-color))`}">
              <i :class="guide.icon" style="font-size:24px;color:#fff;"></i>
            </div>
            <div>
              <Tag :value="categoryLabel" :severity="categorySeverity" class="mb-1" />
              <h1 class="text-xl font-bold">{{ guide.title }}</h1>
            </div>
          </div>
          <p style="color:var(--an-text-muted);font-size:14px;">{{ guide.intro }}</p>
          <div class="flex gap-3 mt-4 flex-wrap">
            <Button severity="primary" icon="pi pi-cog" label="Open Settings" @click="goToSettings" />
            <Tag v-if="guide.syncInfo" :value="guide.syncInfo" severity="info" />
          </div>
        </div>

        <h2 class="text-lg font-bold mb-3">Setup Guide ({{ guide.steps.length }} steps)</h2>

        <div
          v-for="(stepItem, i) in guide.steps"
          :key="i"
          class="an-card mb-3"
          style="padding:20px;"
        >
          <div class="flex gap-3 align-items-start">
            <div class="step-number">{{ i + 1 }}</div>
            <div class="flex-grow-1">
              <div class="font-bold mb-1">{{ stepItem.title }}</div>
              <div style="color:var(--an-text-muted);font-size:14px;">{{ stepItem.description }}</div>
              <Message v-if="stepItem.note" severity="info" class="mt-3">{{ stepItem.note }}</Message>
            </div>
          </div>

          <div v-if="stepItem.images && stepItem.images.length" class="mt-3" style="margin-left:52px;">
            <div class="flex gap-3 flex-wrap">
              <div
                v-for="(img, j) in stepItem.images"
                :key="j"
                class="step-image-card"
                @click="openLightbox(imageUrl(img))"
              >
                <img :src="imageUrl(img)" :alt="`Step ${i + 1} - Image ${j + 1}`" class="step-image" loading="lazy" />
              </div>
            </div>
          </div>
        </div>

        <div class="an-card mt-4" style="padding:20px;">
          <h3 class="font-bold mb-3 flex align-items-center gap-2"><i class="pi pi-check-circle"></i> After Completing Setup</h3>
          <ul style="padding-left:20px;color:var(--an-text-muted);font-size:14px;">
            <li v-for="(note, i) in guide.afterSteps" :key="i" class="mb-1">{{ note }}</li>
          </ul>
        </div>

        <div class="text-center mt-4 mb-4">
          <Button severity="primary" size="large" icon="pi pi-cog" :label="`Configure ${guide.providerName} in Settings`" @click="goToSettings" />
        </div>
      </template>

      <Dialog v-model:visible="lightboxOpen" :style="{width:'1200px'}" modal :showHeader="false">
        <div style="position:relative;">
          <Button icon="pi pi-times" text size="small" style="position:absolute;top:8px;right:8px;z-index:1;" @click="closeLightbox" />
          <img :src="expandedImage" style="width:100%;display:block;" />
        </div>
      </Dialog>
    </div>
</template>

<style scoped>


.guide-avatar { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.step-number { width: 40px; height: 40px; border-radius: 50%; background: var(--p-primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
.step-image-card { cursor: pointer; overflow: hidden; max-width: 420px; border-radius: 8px; border: 1px solid var(--an-border-dark); transition: all 0.15s ease; }
.step-image-card:hover { border-color: var(--p-primary-color); box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2); transform: translateY(-1px); }
.step-image { width: 100%; height: auto; display: block; }
</style>
