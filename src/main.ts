import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n from './i18n'

import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'

// PrimeVue component imports for global registration
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Toast from 'primevue/toast'
import Checkbox from 'primevue/checkbox'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import FileUpload from 'primevue/fileupload'
import Steps from 'primevue/steps'

import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
// PrimeVue core styles required by v4
import 'primevue/resources/primevue.min.css'

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
// Note: PrimeVue v4 introduced changes to theme handling (SASS-based themes).
// This app uses @primevue/themes Aura preset. If you see styling regressions, you may need
// to switch to the CSS theme import or rebuild SASS according to the migration guide:
// https://primefaces.org/primevue/migration-v4
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

// Global component registration to simplify templates and incremental migration.
app.component('Button', Button)
app.component('InputText', InputText)
app.component('InputNumber', InputNumber)
app.component('Select', Select)
app.component('Textarea', Textarea)
app.component('Dialog', Dialog)
app.component('Tag', Tag)
app.component('Message', Message)
app.component('Toast', Toast)
app.component('Checkbox', Checkbox)
app.component('MultiSelect', MultiSelect)
app.component('DatePicker', DatePicker)
app.component('FileUpload', FileUpload)
app.component('Steps', Steps)

if (prefersDark) {
  document.documentElement.classList.add('p-dark')
}

app.mount('#app')
