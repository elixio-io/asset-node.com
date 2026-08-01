import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'


export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-i18n': 'vue-i18n/dist/vue-i18n.esm-bundler.js'
    }
  },
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  server: {
    port: 5173,
    allowedHosts: ['.asset-node.com'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/composables/**', 'src/lib/**', 'src/stores/**'],
    },
  },
})
