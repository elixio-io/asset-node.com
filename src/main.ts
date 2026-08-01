import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n from './i18n'

import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

import App from './App.vue'
import './style.css'
import { installClientLogCapture } from './composables/useClientLogBuffer'



installClientLogCapture()

const savedTheme = localStorage.getItem('hw-manager-theme') || 'dark'
const prefersDark = savedTheme === 'light' ? false : savedTheme === 'system'
  ? window.matchMedia('(prefers-color-scheme: dark)').matches
  : true

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.p-dark',
      cssLayer: false
    }
  },
  ripple: true
})
app.use(ToastService)
app.use(ConfirmationService)
app.directive('tooltip', Tooltip)

if (prefersDark) {
  document.documentElement.classList.add('p-dark')
}

app.mount('#app')
