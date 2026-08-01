
import type { ExtensionMessage, PortalId } from '../lib/types'
import { PORTALS } from '../lib/portals'
import { fetchGuideSteps, reportStepProgress, reportGuideComplete } from '../lib/api'
import { getSession, setSession, clearSession, updateProgress, getAllProgress } from '../lib/storage'


chrome.runtime.onMessage.addListener((message: ExtensionMessage | { type: string; slug?: string }, sender, sendResponse) => {
  handleMessage(message as any, sender, sendResponse)
  return true
})

async function handleMessage(
  message: ExtensionMessage & { type: string; slug?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) {
  try {
    switch (message.type) {
      case 'START_GUIDE': {
        const slug = message.slug as PortalId
        const portal = PORTALS[slug]
        if (!portal) {
          sendResponse({ error: `Unknown portal: ${slug}` })
          return
        }

        const isAutopilot = (message as any).autopilot || false

        const session = {
          slug,
          currentStep: 0,
          totalSteps: 0,
          startedAt: new Date().toISOString(),
          paused: false,
          autopilot: isAutopilot,
        }
        await setSession(session)

        const allTabs = await chrome.tabs.query({})
        const matchingTab = allTabs.find(t =>
          t.url && portal.urlPatterns.some(p => t.url!.includes(p))
        )

        if (matchingTab?.id) {
          await chrome.tabs.update(matchingTab.id, { active: true })
          setTimeout(() => {
            chrome.tabs.sendMessage(matchingTab.id!, {
              type: 'START_GUIDE',
              slug,
              autopilot: isAutopilot,
            }).catch(err => {
              console.warn('[AssetNode BG] Could not reach content script:', err)
            })
          }, 500)
        } else if (portal.entryUrl) {
          await chrome.tabs.create({ url: portal.entryUrl, active: true })
        }

        sendResponse({ ok: true, portal: portal.name })
        break
      }

      case 'STOP_GUIDE': {
        await clearSession()
        sendResponse({ ok: true })
        break
      }

      case 'FETCH_STEPS': {
        const slug = message.slug as string
        const apiSteps = await fetchGuideSteps(slug)
        sendResponse({ steps: apiSteps?.steps || [] })
        break
      }

      case 'STEP_COMPLETED': {
        const { slug, stepIndex } = message as any
        if (slug && stepIndex !== undefined) {
          await reportStepProgress(slug, stepIndex, 0)
          await updateProgress({
            slug,
            completed: false,
            currentStep: stepIndex,
            totalSteps: 0,
          })
        }
        sendResponse({ ok: true })
        break
      }

      case 'GUIDE_COMPLETED': {
        const completedSlug = message.slug as PortalId
        if (completedSlug) {
          await reportGuideComplete(completedSlug)
          await updateProgress({
            slug: completedSlug,
            completed: true,
            completedAt: new Date().toISOString(),
            currentStep: 0,
            totalSteps: 0,
          })
          await clearSession()
        }
        sendResponse({ ok: true })
        break
      }

      case 'GET_SESSION': {
        const session = await getSession()
        sendResponse({ session })
        break
      }

      case 'GET_ALL_PROGRESS': {
        const progress = await getAllProgress()
        sendResponse({ progress })
        break
      }

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` })
    }
  } catch (err) {
    console.error('[AssetNode BG] Error handling message:', err)
    sendResponse({ error: String(err) })
  }
}


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return

  const session = await getSession()
  if (!session || session.paused) return

  const portal = PORTALS[session.slug]

  if (portal && portal.urlPatterns.some(p => tab.url?.includes(p))) {
    console.log(`[AssetNode BG] Portal detected: ${portal.name} on tab ${tabId} — sending START_GUIDE (autopilot: ${session.autopilot})`)

    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        type: 'START_GUIDE',
        slug: session.slug,
        autopilot: session.autopilot,
      }).catch(err => {
        console.warn(`[AssetNode BG] Could not reach content script on tab ${tabId}:`, err)
      })
    }, 1500)
  }
})


chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AssetNode BG] Extension installed! 🤓')
  } else if (details.reason === 'update') {
    console.log(`[AssetNode BG] Updated to version ${chrome.runtime.getManifest().version}`)
  }
})


try {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  console.log('[AssetNode BG] Session storage access level set for content scripts ✓')
} catch (err) {
  console.warn('[AssetNode BG] Could not set session storage access level:', err)
}

console.log('[AssetNode BG] Service worker initialized ✓')
