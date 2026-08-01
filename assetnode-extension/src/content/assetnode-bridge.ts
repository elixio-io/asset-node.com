

function injectMarker() {
  if (!document.getElementById('assetnode-extension-marker')) {
    const marker = document.createElement('div')
    marker.id = 'assetnode-extension-marker'
    marker.setAttribute('data-version', '1.0.0')
    marker.style.display = 'none'
    document.body.appendChild(marker)

    const meta = document.createElement('meta')
    meta.name = 'assetnode-extension'
    meta.content = '1.0.0'
    document.head.appendChild(meta)
  }

  window.postMessage({
    source: 'assetnode-extension',
    type: 'EXTENSION_READY',
    version: '1.0.0',
  }, '*')

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'assetnode-app') return

    if (!isChromeAvailable()) return

    switch (event.data.type) {
      case 'PING':
        window.postMessage({
          source: 'assetnode-extension',
          type: 'EXTENSION_READY',
          version: '1.0.0',
        }, '*')
        break

      case 'SHARE_AUTH':
        handleAuthShare(event.data.token, event.data.email)
        break

      case 'START_GUIDE':
        handleStartGuide(event.data.slug, event.data.token, event.data.autopilot)
        break

      case 'STOP_GUIDE':
        try { chrome.runtime.sendMessage({ type: 'STOP_GUIDE' }) } catch {}
        break

      case 'GET_PROGRESS':
        handleGetProgress()
        break
    }
  })
}


async function handleAuthShare(token?: string, email?: string) {
  if (!token) return
  try {
    await chrome.storage.local.set({
      'assetnode_auth': {
        token,
        email: email || 'Connected',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    window.postMessage({
      source: 'assetnode-extension',
      type: 'AUTH_RECEIVED',
    }, '*')
  } catch (err) {
    console.warn('[AssetNode Bridge] chrome.storage unavailable:', err)
  }
}



async function handleStartGuide(slug: string, token?: string, autopilot?: boolean) {
  try {
    if (token) {
      await handleAuthShare(token)
    }
    chrome.runtime.sendMessage({ type: 'START_GUIDE', slug, autopilot: autopilot || false })
  } catch (err) {
    console.warn('[AssetNode Bridge] Failed to start guide:', err)
  }
}

async function handleGetProgress() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_PROGRESS' })
    window.postMessage({
      source: 'assetnode-extension',
      type: 'PROGRESS_RESPONSE',
      progress: response,
    }, '*')
  } catch {
  }
}


function isChromeAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage
}

function init() {
  if (!isChromeAvailable()) {
    console.warn('[AssetNode Bridge] Extension context unavailable — skipping init')
    return
  }
  injectMarker()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
