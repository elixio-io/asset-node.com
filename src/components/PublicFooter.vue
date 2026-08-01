<script setup lang="ts">
import AssetNodeLogo from './illustrations/AssetNodeLogo.vue'
import AnimatedBrand from './illustrations/AnimatedBrand.vue'
</script>

<template>
  <footer class="public-footer">
    <div class="public-footer-inner">
      <div class="footer-grid">
        <div class="footer-col footer-col--brand">
          <div class="flex align-items-center gap-2 mb-3">
            <AssetNodeLogo :size="24" style="color: var(--an-primary);" />
            <span class="font-mono font-bold tracking-tight text-lg"><AnimatedBrand /></span>
          </div>
          <p class="footer-description">
            {{ $t('footer.description') }}
          </p>
          <div class="footer-socials">
            <a href="https://www.linkedin.com/company/112231163/" target="_blank" rel="noopener" aria-label="LinkedIn">
              <i class="pi pi-linkedin"></i>
            </a>
            <a href="https://www.youtube.com/@AssetNode" target="_blank" rel="noopener" aria-label="YouTube">
              <i class="pi pi-youtube"></i>
            </a>
          </div>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">{{ $t('footer.product') }}</h4>
          <ul class="footer-links">
            <li><a href="#features">{{ $t('footer.features') }}</a></li>
            <li><router-link to="/pricing">{{ $t('footer.pricing') }}</router-link></li>
            <li><router-link to="/integrations">{{ $t('footer.integrations') }}</router-link></li>
            <li><router-link to="/api-docs">{{ $t('footer.apiDocs') }}</router-link></li>
            <li><router-link to="/changelog">{{ $t('footer.changelog') }}</router-link></li>
            <li><router-link to="/faq">{{ $t('footer.faq') }}</router-link></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">{{ $t('footer.company') }}</h4>
          <ul class="footer-links">
            <li><router-link to="/about">{{ $t('footer.aboutUs') }}</router-link></li>
            <li><router-link to="/blog">{{ $t('footer.blog') }}</router-link></li>
            <li><router-link to="/careers">{{ $t('footer.careers') }}</router-link></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">{{ $t('footer.legal') }}</h4>
          <ul class="footer-links">
            <li><router-link to="/privacy-policy">{{ $t('footer.privacyPolicy') }}</router-link></li>
            <li><router-link to="/terms">{{ $t('footer.terms') }}</router-link></li>
            <li><router-link to="/imprint">{{ $t('footer.imprint') }}</router-link></li>
            <li><router-link to="/privacy">{{ $t('footer.dataProtection') }}</router-link></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="public-footer-bottom">
      <span class="footer-copyright">© {{ new Date().getFullYear() }} AssetNode. {{ $t('footer.allRightsReserved') }}</span>
      <span class="footer-legal-links">
        <router-link to="/privacy-policy">{{ $t('footer.privacy') }}</router-link>
        <span class="footer-sep">·</span>
        <router-link to="/terms">{{ $t('footer.termsShort') }}</router-link>
        <span class="footer-sep">·</span>
        <router-link to="/imprint">{{ $t('footer.imprint') }}</router-link>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  border-top: 1px solid var(--an-border-dark);
  padding: 64px 24px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.public-footer-inner {
  margin-bottom: 48px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 48px;
}

@media (max-width: 768px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  .footer-col--brand {
    grid-column: 1 / -1;
  }
}

.footer-description {
  font-size: 14px;
  line-height: 1.6;
  color: var(--an-text-subtle);
  max-width: 320px;
  margin-bottom: 20px;
}

.footer-socials {
  display: flex;
  gap: 16px;
}

.footer-socials a {
  color: var(--an-text-muted);
  font-size: 18px;
  transition: color var(--transition-fast);
}

.footer-socials a:hover {
  color: var(--an-text-primary);
}

.footer-heading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--an-text-primary);
  margin-bottom: 16px;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links li {
  margin-bottom: 10px;
}

.footer-links a {
  font-size: 14px;
  color: var(--an-text-subtle);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.footer-links a:hover {
  color: var(--an-text-primary);
}

.public-footer-bottom {
  border-top: 1px solid var(--an-border-dark);
  padding-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-copyright {
  font-size: 12px;
  color: var(--an-text-muted);
}

.footer-legal-links {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-legal-links a {
  color: var(--an-text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.footer-legal-links a:hover {
  color: var(--an-text-primary);
}

.footer-sep {
  color: var(--an-text-muted);
  opacity: 0.5;
}
</style>
