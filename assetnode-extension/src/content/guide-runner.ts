
import 'driver.js/dist/driver.css'
import './auto-pilot-overlay.css'
import { driver, type DriveStep, type Config } from 'driver.js'
import type { ExtensionGuideStep, AutoPilotStep, GuideSession, PortalId, ExtensionMessage, CredentialReport } from '../lib/types'
import { getBundledSteps } from './selectors'
import { runAutopilot, stopAutopilot, cleanupAutopilot } from './auto-pilot'


let activeDriver: ReturnType<typeof driver> | null = null
let currentSession: GuideSession | null = null
let currentSteps: ExtensionGuideStep[] = []
let autopilotRunning = false


async function init() {
  chrome.runtime.onMessage.addListener(handleMessage)

  const stored = await chrome.storage.session.get('assetnode_guide_session').catch(() => ({} as Record<string, unknown>))
  const session = (stored as Record<string, unknown>)['assetnode_guide_session'] as GuideSession | undefined

  if (session && !session.paused) {
    currentSession = session
    console.log(`[AssetNode Guide] Resuming session: ${session.slug}, step ${session.currentStep}, autopilot: ${session.autopilot}`)
    if (session.autopilot) {
      autopilotRunning = true
      await loadAndRunAutopilot(session.slug, session.currentStep)
    } else {
      await loadAndRunGuide(session.slug, session.currentStep)
    }
  } else {
    console.log('[AssetNode Guide] No active session found, waiting for START_GUIDE message')
  }
}


function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) {
  switch (message.type) {
    case 'START_GUIDE':
      if (autopilotRunning && currentSession?.slug === message.slug && message.autopilot && message.startAt === undefined) {
        console.log(`[AssetNode Guide] IGNORED duplicate START_GUIDE — autopilot already running for ${message.slug}`)
        sendResponse({ ok: true, ignored: true })
        break
      }
      console.log(`[AssetNode Guide] Received START_GUIDE: slug=${message.slug}, autopilot=${message.autopilot}, startAt=${message.startAt ?? 'default'}`)
      startGuide(message.slug, message.autopilot, message.startAt)
      sendResponse({ ok: true })
      break

    case 'PAUSE_GUIDE':
      pauseGuide()
      sendResponse({ ok: true })
      break

    case 'RESUME_GUIDE':
      resumeGuide()
      sendResponse({ ok: true })
      break

    case 'STOP_GUIDE':
      stopGuide()
      sendResponse({ ok: true })
      break

    case 'GET_SESSION':
      sendResponse({ session: currentSession })
      break
  }

  return true
}


async function startGuide(slug: PortalId, autopilot = false, startAt?: number) {
  console.log(`[AssetNode Guide] startGuide called: slug=${slug}, autopilot=${autopilot}, startAt=${startAt ?? 'default'}`)
  stopGuide()

  currentSession = {
    slug,
    currentStep: startAt ?? 0,
    totalSteps: 0,
    startedAt: new Date().toISOString(),
    paused: false,
    autopilot,
  }

  if (autopilot) {
    autopilotRunning = true
    await loadAndRunAutopilot(slug, currentSession.currentStep)
  } else {
    await loadAndRunGuide(slug, currentSession.currentStep)
  }
}

async function loadAndRunGuide(slug: PortalId, startAt: number) {
  let steps: ExtensionGuideStep[] = []

  try {
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_STEPS', slug })
    if (response?.steps?.length) {
      steps = response.steps
      console.log(`[AssetNode Guide] Loaded ${steps.length} steps from API for ${slug}`)
    }
  } catch {
    console.log(`[AssetNode Guide] API unavailable, using bundled steps for ${slug}`)
  }

  if (!steps.length) {
    steps = getBundledSteps(slug)
  }

  if (!steps.length) {
    console.error(`[AssetNode Guide] No steps found for ${slug}`)
    return
  }

  currentSteps = steps
  if (currentSession) {
    currentSession.totalSteps = steps.length
    currentSession.currentStep = startAt
    await saveSession()
  }

  runDriverSteps(steps, startAt)
}

async function loadAndRunAutopilot(slug: PortalId, startAt: number = 0) {
  console.log(`[AssetNode Autopilot] loadAndRunAutopilot called: slug=${slug}, startAt=${startAt}`)
  let steps: AutoPilotStep[] = []

  try {
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_STEPS', slug })
    if (response?.steps?.length) {
      steps = response.steps as AutoPilotStep[]
      console.log(`[AssetNode Autopilot] Loaded ${steps.length} steps from API for ${slug}`)
    } else {
      console.log(`[AssetNode Autopilot] API returned no steps for ${slug}`)
    }
  } catch (err) {
    console.log(`[AssetNode Autopilot] API unavailable: ${err}, using bundled steps for ${slug}`)
  }

  if (!steps.length) {
    steps = getBundledSteps(slug) as AutoPilotStep[]
    console.log(`[AssetNode Autopilot] Bundled steps for ${slug}: ${steps.length} found`)
  }

  if (!steps.length) {
    console.error(`[AssetNode Autopilot] No steps found for ${slug} — cannot run autopilot`)
    return
  }

  currentSteps = steps
  if (currentSession) {
    currentSession.totalSteps = steps.length
    currentSession.autopilot = true
    await saveSession()
    console.log(`[AssetNode Autopilot] Session updated: totalSteps=${steps.length}, starting from ${startAt}`)
  }

  console.log(`[AssetNode Autopilot] Calling runAutopilot with ${steps.length} steps, startAt=${startAt}`)
  await runAutopilot(
    steps,
    currentSession!,
    async (index: number) => {
      if (currentSession) {
        currentSession.currentStep = index
        await saveSession()
        chrome.runtime.sendMessage({
          type: 'STEP_COMPLETED',
          slug: currentSession.slug,
          stepIndex: index,
        }).catch(() => {})
      }
    },
    (report: CredentialReport) => {
      if (currentSession) {
        chrome.runtime.sendMessage({
          type: 'GUIDE_COMPLETED',
          slug: currentSession.slug,
        }).catch(() => {})
      }
      console.log('[AssetNode Autopilot] Report:', report)
    },
    startAt,
  )
}

function runDriverSteps(steps: ExtensionGuideStep[], startAt: number) {
  const driverSteps: DriveStep[] = steps.map((step, index) => ({
    element: findElement(step.selector) ? step.selector.split(',')[0].trim() : undefined,
    popover: {
      title: step.title,
      description: buildDescription(step),
      side: step.side || 'bottom',
      align: step.align || 'center',
    },
  }))

  activeDriver = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    steps: driverSteps,
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    stagePadding: 8,
    stageRadius: 8,
    allowClose: true,
    popoverClass: 'assetnode-guide-popover',
    progressText: '{{current}} of {{total}}',

    onPopoverRender: (popover: any) => {
      const footerBtns = popover.footerButtons
      if (footerBtns) {
        const autopilotBtn = document.createElement('button')
        autopilotBtn.textContent = '⚡ Autopilot'
        autopilotBtn.title = 'Switch to autopilot from this step'
        autopilotBtn.style.cssText = `
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-left: 4px;
          transition: all 0.15s ease;
        `
        autopilotBtn.addEventListener('mouseenter', () => {
          autopilotBtn.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.5)'
        })
        autopilotBtn.addEventListener('mouseleave', () => {
          autopilotBtn.style.boxShadow = 'none'
        })
        autopilotBtn.addEventListener('click', () => {
          const currentIdx = activeDriver?.getActiveIndex() ?? 0
          console.log(`[AssetNode Guide] Switching to autopilot from step ${currentIdx}`)
          if (activeDriver) {
            activeDriver.destroy()
            activeDriver = null
          }
          if (currentSession) {
            loadAndRunAutopilot(currentSession.slug, currentIdx)
          }
        })
        footerBtns.appendChild(autopilotBtn)
      }
    },

    onNextClick: () => {
      if (activeDriver) {
        const idx = activeDriver.getActiveIndex()
        if (idx !== undefined) {
          onStepAdvance(idx + 1)
        }
        activeDriver.moveNext()
      }
    },

    onPrevClick: () => {
      if (activeDriver) {
        activeDriver.movePrevious()
      }
    },

    onDestroyStarted: () => {
      onGuideFinished()
    },

    onDestroyed: () => {
      activeDriver = null
    },
  } as Config)

  activeDriver.drive(startAt)
}


function buildDescription(step: ExtensionGuideStep): string {
  let desc = step.description
  if (step.note) {
    desc += `\n\n💡 ${step.note}`
  }
  if (step.nerdMessage) {
    desc += `\n\n🤓 ${step.nerdMessage}`
  }
  return desc
}

function findElement(selectorString: string): Element | null {
  const selectors = selectorString.split(',').map(s => s.trim())
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      if (el) return el
    } catch {
    }
  }
  return null
}

function waitForElement(selector: string, timeoutMs: number = 10000): Promise<Element | null> {
  return new Promise(resolve => {
    const el = findElement(selector)
    if (el) return resolve(el)

    const observer = new MutationObserver(() => {
      const found = findElement(selector)
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeoutMs)
  })
}


function onStepAdvance(stepIndex: number) {
  if (!currentSession) return

  currentSession.currentStep = stepIndex
  saveSession()

  chrome.runtime.sendMessage({
    type: 'STEP_COMPLETED',
    slug: currentSession.slug,
    stepIndex,
  }).catch(() => {
  })
}

function onGuideFinished() {
  if (!currentSession) return

  const isComplete = currentSession.currentStep >= currentSession.totalSteps - 1

  if (isComplete) {
    chrome.runtime.sendMessage({
      type: 'GUIDE_COMPLETED',
      slug: currentSession.slug,
    }).catch(() => {})
  }

  currentSession = null
  currentSteps = []
  clearSession()
}


function pauseGuide() {
  if (activeDriver) {
    activeDriver.destroy()
    activeDriver = null
  }
  if (currentSession) {
    currentSession.paused = true
    saveSession()
  }
}

async function resumeGuide() {
  if (currentSession?.paused) {
    currentSession.paused = false
    await loadAndRunGuide(currentSession.slug, currentSession.currentStep)
  }
}

function stopGuide() {
  if (activeDriver) {
    activeDriver.destroy()
    activeDriver = null
  }
  if (currentSession?.autopilot) {
    stopAutopilot()
    cleanupAutopilot()
  }
  autopilotRunning = false
  currentSession = null
  currentSteps = []
  clearSession()
}


async function saveSession() {
  if (currentSession) {
    await chrome.storage.session.set({ 'assetnode_guide_session': currentSession }).catch(() =>
      chrome.storage.local.set({ 'assetnode_guide_session': currentSession })
    )
  }
}

async function clearSession() {
  await chrome.storage.session.remove('assetnode_guide_session').catch(() =>
    chrome.storage.local.remove('assetnode_guide_session')
  )
}


init().catch(err => {
  console.error('[AssetNode Guide] Failed to initialize:', err)
})
