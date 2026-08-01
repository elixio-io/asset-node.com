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
        <h1>Privacy Policy</h1>
        <p class="legal-updated">Last updated: July 31, 2026</p>
      </div>

      <section>
        <h2>1. Introduction</h2>
        <p>AssetNode is operated by Elixio UG (haftungsbeschränkt) ("we", "us", or "our"), a company registered in Bonn, Germany. We are committed to protecting the privacy and security of your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our IT asset management platform.</p>
        <p>This policy applies to all users of AssetNode, including administrators, managers, and employees whose organizations use our platform.</p>
      </section>

      <section>
        <h2>2. Data Controller</h2>
        <p>The data controller responsible for processing your personal data is:</p>
        <address>
          Elixio UG (haftungsbeschränkt)<br>
          Schützenstraße 6<br>
          53111 Bonn, Germany<br>
          Registered at Amtsgericht Bonn, HRB 30869<br>
          Represented by: Alexander Felix von Hohnhorst<br>
          Email: alexander.vonhohnhorst@elixio.io
        </address>
      </section>

      <section>
        <h2>3. Data We Collect</h2>
        <h3>3.1 Account Data</h3>
        <p>When you create an account, we collect your name, email address, organization name, and role within your organization.</p>
        <h3>3.2 Asset Data</h3>
        <p>Our platform processes information about hardware assets, including serial numbers, device models, manufacturers, purchase dates, warranty information, and assignment history.</p>
        <h3>3.3 Employee Data</h3>
        <p>Organizations may store employee information including names, email addresses, departments, job titles, and device assignments.</p>
        <h3>3.4 Usage Data</h3>
        <p>We automatically collect information about how you interact with our platform, including IP addresses, browser type, pages visited, and features used.</p>
        <h3>3.5 Integration Data</h3>
        <p>When you connect third-party services (e.g., Kandji, Intune, Jamf), we process data received from these integrations as configured by your organization.</p>
      </section>

      <section>
        <h2>4. Legal Basis for Processing (GDPR Art. 6)</h2>
        <ul>
          <li><strong>Contract Performance (Art. 6(1)(b)):</strong> Processing necessary to provide our services as agreed in our Terms of Service.</li>
          <li><strong>Legitimate Interest (Art. 6(1)(f)):</strong> Analytics, security monitoring, and service improvement.</li>
          <li><strong>Legal Obligation (Art. 6(1)(c)):</strong> Compliance with tax, accounting, and other legal requirements.</li>
          <li><strong>Consent (Art. 6(1)(a)):</strong> Marketing communications and optional cookies, where applicable.</li>
        </ul>
      </section>

      <section>
        <h2>5. Cookies &amp; Tracking Technologies (§ 25 TDDDG)</h2>
        <p>The storage of information on your device and access to stored information is governed by § 25 of the Telekommunikation-Digitale-Dienste-Datenschutzgesetz (TDDDG).</p>
        <h3>5.1 Technically Necessary Cookies</h3>
        <p>AssetNode uses only cookies that are strictly necessary for the operation of the platform, such as session and authentication cookies. These are exempt from consent requirements under § 25 Abs. 2 Nr. 2 TDDDG, as they are required to provide the service you explicitly requested.</p>
        <h3>5.2 No Tracking or Analytics Cookies</h3>
        <p>We do not currently use any tracking, analytics, or marketing cookies. Should this change in the future, we will update this policy and obtain your consent in accordance with § 25 Abs. 1 TDDDG and Art. 6(1)(a) GDPR before placing any non-essential cookies.</p>
      </section>

      <section>
        <h2>6. Data Retention</h2>
        <p>We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected. Account data is retained for the duration of your subscription. Audit logs are retained as needed for compliance purposes. You may request deletion of your data at any time — see section 7 for details.</p>
      </section>

      <section>
        <h2>7. Your Rights (GDPR Art. 15–22)</h2>
        <p>As a data subject in the EU/EEA, you have the right to:</p>
        <ul>
          <li><strong>Access</strong> your personal data (Art. 15)</li>
          <li><strong>Rectify</strong> inaccurate data (Art. 16)</li>
          <li><strong>Erase</strong> your data ("right to be forgotten") (Art. 17)</li>
          <li><strong>Restrict processing</strong> (Art. 18)</li>
          <li><strong>Data portability</strong> — receive your data in a machine-readable format (Art. 20)</li>
          <li><strong>Object</strong> to processing based on legitimate interest (Art. 21)</li>
        </ul>
        <p>To exercise your rights, see our <router-link to="/imprint">Impressum</router-link> for contact details. We will respond within 30 days.</p>
      </section>

      <section>
        <h2>8. Data Security</h2>
        <p>We implement security measures including TLS encryption in transit, role-based access controls, and regular security reviews.</p>
      </section>

      <section>
        <h2>9. Sub-processors</h2>
        <p>We use the following sub-processors:</p>
        <ul>
          <li><strong>Hetzner Cloud</strong> (Germany) — application infrastructure and database hosting</li>
          <li><strong>Cloudflare</strong> (US-headquartered, EU data processing) — CDN, DNS, and DDoS protection</li>
          <li><strong>Brevo</strong> (EU) — transactional email</li>
        </ul>
      </section>

      <section>
        <h2>10. International Transfers</h2>
        <p>All primary data processing occurs within the European Union. Where data transfers outside the EEA are necessary, we rely on Standard Contractual Clauses (SCCs) as approved by the European Commission.</p>
      </section>

      <section>
        <h2>11. Changes to This Policy</h2>
        <p>We may update this policy periodically. Material changes will be communicated via email or in-app notification at least 30 days before taking effect.</p>
      </section>

      <section>
        <h2>12. Supervisory Authority</h2>
        <p>You have the right to lodge a complaint with the State Commissioner for Data Protection and Freedom of Information North Rhine-Westphalia (Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen) or your local supervisory authority.</p>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

