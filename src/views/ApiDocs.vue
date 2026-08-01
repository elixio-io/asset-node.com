<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
import { onMounted } from 'vue'

const themeStore = useThemeStore()

const endpoints = [
  { method: 'GET', path: '/api/hardware', desc: 'List all hardware assets with filters, pagination, and search.' },
  { method: 'POST', path: '/api/hardware', desc: 'Register a new hardware asset.' },
  { method: 'GET', path: '/api/hardware/:id', desc: 'Get detailed information about a specific asset.' },
  { method: 'PATCH', path: '/api/hardware/:id', desc: 'Update fields on an existing hardware asset.' },
  { method: 'GET', path: '/api/employees', desc: 'List employees with department and status filters.' },
  { method: 'POST', path: '/api/employees', desc: 'Create a new employee record.' },
  { method: 'POST', path: '/api/assignments', desc: 'Create a new hardware assignment to an employee.' },
  { method: 'POST', path: '/api/assignments/:id/return', desc: 'Initiate a return for an active assignment.' },
  { method: 'GET', path: '/api/licenses', desc: 'List software licenses with seat tracking.' },
  { method: 'GET', path: '/api/audit-log', desc: 'Query the full audit trail with time-range filters.' },
  { method: 'POST', path: '/api/webhooks', desc: 'Register webhook endpoints for asset events.' },
  { method: 'GET', path: '/api/reports/depreciation', desc: 'Generate depreciation reports for tax and compliance.' },
  { method: 'GET', path: '/api/dashboard', desc: 'Get KPI overview: total assets, assignments, alerts.' },
]

const errorCodes = [
  { code: '400', desc: 'Bad Request — invalid parameters or missing required fields' },
  { code: '401', desc: 'Unauthorized — missing or expired access token' },
  { code: '403', desc: 'Forbidden — insufficient permissions for this resource' },
  { code: '404', desc: 'Not Found — resource does not exist or belongs to another tenant' },
  { code: '429', desc: 'Too Many Requests — rate limit exceeded, retry after header' },
  { code: '500', desc: 'Internal Server Error — please try again later' },
]

onMounted(() => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: 'AssetNode REST API',
    description: 'RESTful API for IT asset management. Manage hardware, employees, assignments, licenses, and audit trails programmatically.',
    url: 'https://asset-node.com/api-docs',
    provider: {
      '@type': 'Organization',
      name: 'AssetNode',
      url: 'https://asset-node.com'
    },
    documentation: 'https://asset-node.com/api-docs',
    termsOfService: 'https://asset-node.com/terms',
  }
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(jsonLd)
  script.id = 'api-jsonld'
  const existing = document.getElementById('api-jsonld')
  if (existing) existing.remove()
  document.head.appendChild(script)
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="legal-content" style="max-width: 900px;">
      <div class="legal-header">
        <h1>API Documentation</h1>
        <p class="legal-updated">RESTful API · JSON responses · Bearer token auth</p>
      </div>

      <section>
        <h2>Authentication</h2>
        <p>All API requests require a Bearer token in the <code>Authorization</code> header. Obtain tokens via the <code>/api/auth/login</code> endpoint. Access tokens expire after 15 minutes; use the refresh token to obtain new ones.</p>
        <div class="code-block">
          <code>Authorization: Bearer &lt;your_access_token&gt;</code>
        </div>
      </section>

      <section>
        <h2>Base URL</h2>
        <div class="code-block">
          <code>https://asset-node.com/api</code>
        </div>
      </section>

      <section>
        <h2>Rate Limits</h2>
        <p>API requests are rate-limited to <strong>60 requests per minute</strong> per authenticated user. Authentication endpoints have stricter limits (5–10 req/min). When exceeded, the API returns <code>429 Too Many Requests</code>.</p>
      </section>

      <section>
        <h2>Key Endpoints</h2>
        <div class="endpoint-list">
          <div v-for="ep in endpoints" :key="ep.path" class="endpoint-row">
            <span class="endpoint-method" :class="`method-${ep.method.toLowerCase()}`">{{ ep.method }}</span>
            <code class="endpoint-path">{{ ep.path }}</code>
            <span class="endpoint-desc">{{ ep.desc }}</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Pagination</h2>
        <p>List endpoints support <code>?page=1&limit=50</code> query parameters. Responses include <code>total</code>, <code>page</code>, and <code>pages</code> fields for client-side pagination.</p>
      </section>

      <section>
        <h2>Webhooks</h2>
        <p>Subscribe to real-time events (asset created, assignment changed, maintenance due) by registering webhook URLs. Payloads are signed with HMAC-SHA256 for verification.</p>
      </section>

      <section>
        <h2>Example: List Hardware</h2>
        <div class="code-block">
          <code>curl -H "Authorization: Bearer $TOKEN" \
  https://asset-node.com/api/hardware?page=1&limit=10&category=laptop</code>
        </div>
        <p>Response (200 OK):</p>
        <div class="code-block">
          <code>{
  "data": [{ "_id": "...", "model": "MacBook Pro 16\"", "category": "laptop", ... }],
  "total": 42,
  "page": 1,
  "pages": 5
}</code>
        </div>
      </section>

      <section>
        <h2>Error Codes</h2>
        <div class="endpoint-list">
          <div v-for="err in errorCodes" :key="err.code" class="endpoint-row">
            <span class="endpoint-method" :class="parseInt(err.code) >= 500 ? 'method-delete' : parseInt(err.code) >= 400 ? 'method-patch' : 'method-get'">{{ err.code }}</span>
            <span class="endpoint-desc">{{ err.desc }}</span>
          </div>
        </div>
      </section>

      <section>
        <h2>SDKs & Tools</h2>
        <p>Official client libraries are coming soon. In the meantime, use any HTTP client — the API follows REST conventions with standard JSON request/response bodies.</p>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>





.legal-header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
.legal-updated { color: var(--an-text-muted); font-size: 14px; }
.legal-content section { margin-bottom: 40px; }
.legal-content h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; }
.legal-content p { line-height: 1.7; color: var(--an-text-subtle); margin-bottom: 12px; }
.legal-content code { background: var(--an-surface-elevated); padding: 2px 6px; border-radius: 4px; font-size: 13px; color: var(--an-cobalt); }

.code-block { background: var(--an-surface-dark); border: 1px solid var(--an-border-dark); border-radius: 8px; padding: 14px 18px; margin: 12px 0; }
.code-block code { background: none; padding: 0; font-size: 14px; color: var(--an-emerald); }

.endpoint-list { display: flex; flex-direction: column; gap: 8px; }
.endpoint-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--an-border-dark); border-radius: 8px; background: var(--an-surface-dark); flex-wrap: wrap; }
.endpoint-method { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.05em; }
.method-get { background: rgba(16,185,129,0.15); color: #10b981; }
.method-post { background: rgba(59,130,246,0.15); color: var(--an-cobalt); }
.method-patch { background: rgba(245,158,11,0.15); color: #f59e0b; }
.method-delete { background: rgba(239,68,68,0.15); color: #ef4444; }
.endpoint-path { font-size: 13px; color: var(--an-text-primary); background: none; padding: 0; min-width: 220px; }
.endpoint-desc { font-size: 13px; color: var(--an-text-subtle); }


.legal-footer a { color: var(--an-primary); text-decoration: none; }



.legal-page--light .code-block { background: white; border-color: #e5e7eb; }
.legal-page--light .endpoint-row { background: white; border-color: #e5e7eb; }

</style>
