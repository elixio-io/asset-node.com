<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'

const themeStore = useThemeStore()
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="legal-content">
      <div class="legal-header">
        <h1>Terms of Service</h1>
        <p class="legal-updated">Last updated: July 31, 2026</p>
      </div>

      <section>
        <h2>1. Agreement to Terms</h2>
        <p>By accessing or using the AssetNode platform ("Service"), operated by Elixio UG (haftungsbeschränkt), Schützenstraße 6, 53111 Bonn, Germany, registered at Amtsgericht Bonn under HRB 30869 ("we", "us", or "our"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.</p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>AssetNode provides a cloud-based IT asset management platform that enables organizations to track, manage, and optimize their hardware assets, software licenses, and employee assignments throughout the complete asset lifecycle.</p>
      </section>

      <section>
        <h2>3. Account Registration</h2>
        <p>To use the Service, you must create an account with accurate and complete information. You are responsible for maintaining the security of your credentials and for all activities under your account. You must notify us immediately of any unauthorized access.</p>
      </section>

      <section>
        <h2>4. Subscription Plans</h2>
        <h3>4.1 Free Plan</h3>
        <p>The free plan includes up to 50 assets, 5 users, and basic reporting. No credit card is required.</p>
        <h3>4.2 Professional Plan</h3>
        <p>The Professional plan includes unlimited assets, up to 25 users, advanced reporting, and API access. Pricing is as listed on our website.</p>
        <h3>4.3 Enterprise Plan</h3>
        <p>The Enterprise plan includes unlimited assets and users, SSO/SAML integration, dedicated support, custom SLAs, and on-premise deployment options. Contact sales for pricing.</p>
      </section>

      <section>
        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
          <li>Attempt to gain unauthorized access to any part of the Service</li>
          <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
          <li>Use the Service to store or transmit malicious code</li>
          <li>Exceed documented API rate limits or abuse platform resources</li>
          <li>Resell or sublicense access to the Service without prior written consent</li>
        </ul>
      </section>

      <section>
        <h2>6. Data Ownership</h2>
        <p>You retain full ownership of all data you input into the Service ("Customer Data"). We do not claim any intellectual property rights over Customer Data. You grant us a limited license to process Customer Data solely to provide and improve the Service.</p>
      </section>

      <section>
        <h2>7. Data Processing Agreement</h2>
        <p>For organizations subject to GDPR, our Data Processing Agreement (DPA) is incorporated by reference into these Terms. The DPA details our obligations as a data processor, including sub-processor management, data breach notification, and cross-border transfer safeguards.</p>
      </section>

      <section>
        <h2>8. Service Availability</h2>
        <p>We aim to provide reliable service availability. Planned maintenance will be communicated in advance where possible. We are not liable for downtime caused by force majeure events, third-party services, or customer infrastructure.</p>
      </section>

      <section>
        <h2>9. Intellectual Property</h2>
        <p>The Service, including all software, designs, logos, and documentation, is the intellectual property of Elixio UG (haftungsbeschränkt). These Terms do not grant you any rights to our trademarks or branding.</p>
      </section>

      <section>
        <h2>10. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, the total liability of Elixio UG (haftungsbeschränkt) under these Terms shall not exceed the fees paid by you in the 12 months preceding the claim. We are not liable for indirect, incidental, special, consequential, or punitive damages.</p>
      </section>

      <section>
        <h2>11. Termination</h2>
        <p>Either party may terminate these Terms with 30 days' written notice. Upon termination, you may export your data within 30 days. After that period, we will delete your data in accordance with our Privacy Policy.</p>
      </section>

      <section>
        <h2>12. Governing Law</h2>
        <p>These Terms are governed by the laws of the Federal Republic of Germany. Any disputes shall be resolved exclusively in the courts of Bonn, Germany.</p>
      </section>

      <section>
        <h2>13. Changes to Terms</h2>
        <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2>14. Contact</h2>
        <p>For questions about these Terms, see our <router-link to="/imprint">Impressum</router-link> for contact details.</p>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

