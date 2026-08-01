import { ref, nextTick, createApp, type App } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { driver, type DriveStep, type Config } from 'driver.js'
import 'driver.js/dist/driver.css'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'
import SpeechBubble from '../components/illustrations/SpeechBubble.vue'
import type { SpeechBubbleProps } from '../components/illustrations/SpeechBubble.vue'


export interface TourStepDef {
  element?: string
  message: string
  characterAnimation?: 'none' | 'waving' | 'floating'
  displayText?: string[]
  displayObject?: 'monitor' | 'whiteboard' | 'none'
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  navigateTo?: string
  roles?: string[]
  preAction?: () => void
}


const dashboardSteps: TourStepDef[] = [
  {
    message: "Hey! 👋 I'm your IT Nerd. Let me show you around AssetNode — your new hardware management HQ!",
    characterAnimation: 'waving',
    displayObject: 'whiteboard',
    displayText: ['Welcome to', 'AssetNode! 🚀'],
  },
  {
    element: '.pbi-kpi-grid',
    message: "These are your KPIs — a live snapshot of your entire fleet. Devices, value, utilization — all at a glance.",
    characterAnimation: 'floating',
    displayObject: 'monitor',
    displayText: ['{...fleet}', '→ KPIs'],
    side: 'bottom',
    align: 'center',
  },
  {
    element: '.pbi-main-grid .pbi-col-left .pbi-card:first-child',
    message: "This chart shows your asset distribution by status. Click any segment to filter the hardware list.",
    characterAnimation: 'none',
    displayObject: 'monitor',
    displayText: ['{status:', ' breakdown}'],
    side: 'right',
    align: 'start',
  },
  {
    element: '.pbi-main-grid .pbi-col-right .pbi-card:first-child',
    message: "Red means action needed 🔴 — overdue returns, expired warranties. I'll keep an eye on things for you.",
    characterAnimation: 'none',
    displayObject: 'monitor',
    displayText: ['{alerts:', ' active: true}'],
    side: 'left',
    align: 'start',
  },
  {
    element: '.pbi-main-grid .pbi-col-right .pbi-card:last-child',
    message: "Everything your team does shows up in this timeline — creates, updates, assignments — all in real-time.",
    characterAnimation: 'floating',
    displayObject: 'monitor',
    displayText: ['audit[]', '→ timeline'],
    side: 'left',
    align: 'start',
  },
]

const hardwareSteps: TourStepDef[] = [
  {
    message: "Welcome to the Hardware module! This is where all your devices live. Let me give you the tour. 💻",
    characterAnimation: 'waving',
    displayObject: 'whiteboard',
    displayText: ['Hardware', 'Module 💻'],
    navigateTo: '/hardware',
  },
  {
    element: '[data-tour="hardware-add"],.p-toolbar .p-button-primary,[id*="add"]',
    message: "Click here to register a new device. Fill in serial, model, and you're set!",
    characterAnimation: 'none',
    displayObject: 'monitor',
    displayText: ['new Asset()', '→ save()'],
    side: 'bottom',
    align: 'start',
  },
  {
    element: '[data-tour="hardware-search"],.global-search-input,input[placeholder*="Search"],input[placeholder*="search"]',
    message: "Search across all fields — serial numbers, models, tags, manufacturers. Super fast. 🔍",
    characterAnimation: 'floating',
    displayObject: 'monitor',
    displayText: ['grep -r', '"MacBook"'],
    side: 'bottom',
    align: 'start',
  },
]

const employeesSteps: TourStepDef[] = [
  {
    message: "This is your People directory. Assign hardware directly to team members from here. 👥",
    characterAnimation: 'waving',
    displayObject: 'whiteboard',
    displayText: ['Employees', 'Module 👥'],
    navigateTo: '/employees',
  },
  {
    element: '[data-tour="employees-add"],.p-toolbar .p-button-primary,[id*="add"]',
    message: "Add employees manually, or sync them automatically from your HR system or SCIM provider.",
    characterAnimation: 'none',
    displayObject: 'monitor',
    displayText: ['import', '{staff}'],
    side: 'bottom',
    align: 'start',
  },
]

const settingsSteps: TourStepDef[] = [
  {
    element: '[data-tour="settings-content"]',
    message: "Welcome to Mission Control 🛸 — this is where you configure everything: org settings, user management, notifications, and more!",
    characterAnimation: 'waving',
    displayObject: 'whiteboard',
    displayText: ['Settings ⚙️', 'Admin Only'],
    navigateTo: '/settings',
    side: 'left',
    align: 'start',
    roles: ['admin', 'superAdmin'],
  },
  {
    element: '[data-tour="settings-integrations"]',
    message: "Click Integrations to connect your MDM, HR, and identity tools. Let's take a look! 🔗",
    characterAnimation: 'floating',
    displayObject: 'monitor',
    displayText: ['MDM.sync()', '→ fleet[]'],
    side: 'right',
    align: 'center',
    roles: ['admin', 'superAdmin'],
  },
  {
    element: '[data-tour="integrations-grid"]',
    message: "Here are all available integrations — Intune, Jamf, Kandji, Personio, BambooHR and more. Each one has a step-by-step setup guide to get you connected in minutes! 📖",
    characterAnimation: 'none',
    displayObject: 'monitor',
    displayText: ['guides/', '→ setup[]'],
    side: 'top',
    align: 'center',
    roles: ['admin', 'superAdmin'],
    preAction: () => {
      const intTab = document.querySelector('[data-tour="settings-integrations"]') as HTMLElement
      if (intTab) intTab.click()
    },
  },
  {
    message: "That's the tour! You're all set. If you need me again, hit the ❓ button in the sidebar. Happy managing! 🎉",
    characterAnimation: 'waving',
    displayObject: 'whiteboard',
    displayText: ['All done! 🎉', "Let's go!"],
  },
]


export function useOnboardingTour() {
  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()
  const isTourActive = ref(false)
  const CACHE_KEY = 'an-onboarding-completed'

  const mountedApps: App[] = []

  function filterByRole(steps: TourStepDef[]): TourStepDef[] {
    const userRole = authStore.user?.role
    if (!userRole) return []
    return steps.filter(s => {
      if (!s.roles || s.roles.length === 0) return true
      if (userRole === 'superAdmin') return true
      return s.roles.includes(userRole)
    })
  }

  function buildTourSteps(): TourStepDef[] {
    const userRole = authStore.user?.role || 'employee'
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin'

    const allSteps = [
      ...filterByRole(dashboardSteps),
      ...filterByRole(hardwareSteps),
      ...filterByRole(employeesSteps),
      ...(isAdmin ? filterByRole(settingsSteps) : [filterByRole(settingsSteps).pop()!].filter(Boolean)),
    ]

    return allSteps
  }

  function cleanupMountedApps() {
    for (const app of mountedApps) {
      try { app.unmount() } catch {  }
    }
    mountedApps.length = 0
  }

  function mountSpeechBubble(step: TourStepDef, container: HTMLElement) {
    const props: SpeechBubbleProps = {
      message: step.message,
      characterAnimation: step.characterAnimation || 'none',
      characterSize: 70,
      position: 'right',
      variant: 'tour',
      displayObject: step.displayObject || 'none',
      displayText: step.displayText || [],
      animateDisplay: false,
      showHat: true,
      showGlasses: true,
      glassesStyle: 'cool',
      showChain: true,
      showWatch: true,
    }

    const app = createApp(SpeechBubble, props as any)
    app.mount(container)
    mountedApps.push(app)
  }

  function toDriverSteps(steps: TourStepDef[]): DriveStep[] {
    return steps.map((step) => ({
      element: step.element,
      popover: {
        title: ' ',
        description: ' ',
        side: step.side || 'bottom',
        align: step.align || 'center',
        onPopoverRender: (popover: any) => {
          const titleEl = popover.title as HTMLElement
          if (titleEl) {
            titleEl.style.display = 'none'
          }

          const descriptionEl = popover.description as HTMLElement
          if (descriptionEl) {
            descriptionEl.innerHTML = ''
            descriptionEl.style.padding = '8px'
            descriptionEl.style.maxWidth = '440px'
            mountSpeechBubble(step, descriptionEl)
          }
        },
      },
    }))
  }

  function createDriverConfig(
    steps: TourStepDef[],
    driverSteps: DriveStep[],
    totalSteps: number,
    onComplete: () => void,
  ): Config {
    let isNavigating = false

    const config: Config = {
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      stagePadding: 8,
      stageRadius: 8,
      allowClose: true,
      disableActiveInteraction: false,
      popoverClass: 'an-tour-popover',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Finish 🎉',
      progressText: `{{current}} of ${totalSteps}`,
      steps: driverSteps,
      onDestroyStarted: () => {
        if (!isNavigating) {
          onComplete()
        }
      },
    }

    return config
  }

  async function driveSteps(allSteps: TourStepDef[], startIndex: number, totalSteps: number): Promise<void> {
    const steps = allSteps.slice(startIndex)
    if (steps.length === 0) {
      await completeTour()
      return
    }

    return new Promise<void>((resolve) => {
      let isNavigating = false

      if (steps[0]?.preAction) {
        steps[0].preAction()
      }

      const driverSteps = toDriverSteps(steps)

      const driverInstance = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        stagePadding: 8,
        stageRadius: 8,
        allowClose: true,
        disableActiveInteraction: false,
        popoverClass: 'an-tour-popover',
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Finish 🎉',
        progressText: `{{current}} of ${totalSteps}`,
        steps: driverSteps,
        onNextClick: async () => {
          const currentLocalIdx = driverInstance.getActiveIndex() ?? 0
          const nextLocalIdx = currentLocalIdx + 1
          const nextStep = steps[nextLocalIdx]

          if (nextStep?.navigateTo && route.path !== nextStep.navigateTo) {
            isNavigating = true
            cleanupMountedApps()
            driverInstance.destroy()

            await router.push(nextStep.navigateTo)
            await nextTick()
            await new Promise(r => setTimeout(r, 600))

            const globalNextIdx = startIndex + nextLocalIdx
            await driveSteps(allSteps, globalNextIdx, totalSteps)
            resolve()
            return
          }

          if (nextStep?.preAction) {
            nextStep.preAction()
            await new Promise(r => setTimeout(r, 300))
          }

          driverInstance.moveNext()
        },
        onDestroyStarted: () => {
          cleanupMountedApps()
          driverInstance.destroy()

          if (!isNavigating) {
            completeTour()
          }
          resolve()
        },
      } as Config)

      driverInstance.drive()
    })
  }

  async function startTour() {
    if (isTourActive.value) return

    const steps = buildTourSteps()
    if (steps.length === 0) return

    isTourActive.value = true

    const firstStep = steps[0]
    if (firstStep?.navigateTo && route.path !== firstStep.navigateTo) {
      await router.push(firstStep.navigateTo)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    await driveSteps(steps, 0, steps.length)
    isTourActive.value = false
  }

  async function completeTour() {
    isTourActive.value = false
    localStorage.setItem(CACHE_KEY, 'true')

    if (authStore.user) {
      authStore.user.onboardingCompleted = true
    }

    try {
      await api.patch('/auth/onboarding', { completed: true })
    } catch (err) {
      console.error('[OnboardingTour] Failed to persist completion:', err)
    }
  }

  async function resetTour() {
    localStorage.removeItem(CACHE_KEY)

    if (authStore.user) {
      authStore.user.onboardingCompleted = false
    }

    try {
      await api.delete('/auth/onboarding')
    } catch (err) {
      console.error('[OnboardingTour] Failed to reset:', err)
    }

    if (route.path !== '/dashboard') {
      await router.push('/dashboard')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    await startTour()
  }

  function shouldAutoStart(): boolean {
    if (localStorage.getItem(CACHE_KEY) === 'true') return false

    if (authStore.user?.onboardingCompleted) return false

    return true
  }

  return {
    isTourActive,
    startTour,
    resetTour,
    shouldAutoStart,
  }
}
