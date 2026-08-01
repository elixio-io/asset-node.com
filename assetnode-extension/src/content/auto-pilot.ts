
import type { AutoAction, AutoPilotStep, CredentialReport, GuideSession } from '../lib/types'


let cancelled = false
let countdownAbortController: AbortController | null = null
const collectedCredentials: { label: string; value: string }[] = []
const warnings: string[] = []
const actionLog: { message: string; status: 'info' | 'success' | 'warn' | 'error'; time: string }[] = []


let logPanel: HTMLDivElement | null = null
let countdownOverlay: HTMLDivElement | null = null

function ensureLogPanel(): HTMLDivElement {
  if (logPanel && document.body.contains(logPanel)) return logPanel

  logPanel = document.createElement('div')
  logPanel.id = 'assetnode-autopilot-log'
  logPanel.setAttribute('role', 'log')
  logPanel.setAttribute('aria-label', 'AssetNode Autopilot Log')

  const header = document.createElement('div')
  header.className = 'autopilot-log-header'

  const title = document.createElement('span')
  title.className = 'autopilot-log-title'
  title.textContent = '🤓 IT Nerd Autopilot'

  const badge = document.createElement('span')
  badge.className = 'autopilot-log-badge'
  badge.textContent = 'RUNNING'

  const minimizeBtn = document.createElement('button')
  minimizeBtn.className = 'autopilot-log-minimize'
  minimizeBtn.textContent = '─'
  minimizeBtn.addEventListener('click', () => {
    logPanel!.classList.toggle('minimized')
    minimizeBtn.textContent = logPanel!.classList.contains('minimized') ? '□' : '─'
  })

  header.appendChild(title)
  header.appendChild(badge)
  header.appendChild(minimizeBtn)

  const body = document.createElement('div')
  body.className = 'autopilot-log-body'
  body.id = 'assetnode-autopilot-log-body'

  logPanel.appendChild(header)
  logPanel.appendChild(body)
  document.body.appendChild(logPanel)

  return logPanel
}

function appendLog(message: string, status: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const now = new Date().toLocaleTimeString()
  actionLog.push({ message, status, time: now })

  const panel = ensureLogPanel()
  const body = panel.querySelector('#assetnode-autopilot-log-body')
  if (!body) return

  const entry = document.createElement('div')
  entry.className = `autopilot-log-entry autopilot-log-${status}`

  const statusIcons: Record<string, string> = {
    info: '🔵',
    success: '✅',
    warn: '⚠️',
    error: '❌',
  }

  const time = document.createElement('span')
  time.className = 'autopilot-log-time'
  time.textContent = now

  const icon = document.createElement('span')
  icon.className = 'autopilot-log-icon'
  icon.textContent = statusIcons[status] || '🔵'

  const msg = document.createElement('span')
  msg.className = 'autopilot-log-message'
  msg.textContent = message

  entry.appendChild(time)
  entry.appendChild(icon)
  entry.appendChild(msg)
  body.appendChild(entry)

  body.scrollTop = body.scrollHeight
}


function showCountdown(actionDescription: string, seconds: number): Promise<boolean> {
  return new Promise((resolve) => {
    countdownAbortController = new AbortController()

    countdownOverlay = document.createElement('div')
    countdownOverlay.id = 'assetnode-autopilot-countdown'

    const content = document.createElement('div')
    content.className = 'autopilot-countdown-content'

    const nerd = document.createElement('div')
    nerd.className = 'autopilot-countdown-nerd'
    nerd.textContent = '🤓'

    const text = document.createElement('div')
    text.className = 'autopilot-countdown-text'
    text.textContent = actionDescription

    const timer = document.createElement('div')
    timer.className = 'autopilot-countdown-timer'
    timer.id = 'assetnode-countdown-value'
    timer.textContent = String(seconds)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'autopilot-countdown-cancel'
    cancelBtn.textContent = '✋ Cancel'
    cancelBtn.addEventListener('click', () => {
      countdownAbortController?.abort()
      removeCountdown()
      resolve(false)
    })

    content.appendChild(nerd)
    content.appendChild(text)
    content.appendChild(timer)
    content.appendChild(cancelBtn)
    countdownOverlay.appendChild(content)
    document.body.appendChild(countdownOverlay)

    let remaining = seconds
    const interval = setInterval(() => {
      if (countdownAbortController?.signal.aborted || cancelled) {
        clearInterval(interval)
        removeCountdown()
        resolve(false)
        return
      }

      remaining--
      const timerEl = document.getElementById('assetnode-countdown-value')
      if (timerEl) timerEl.textContent = String(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        removeCountdown()
        resolve(true)
      }
    }, 1000)
  })
}

function removeCountdown() {
  countdownOverlay?.remove()
  countdownOverlay = null
  countdownAbortController = null
}


function findElementByText(text: string, tagFilter = 'button, a, span, div, li'): Element | null {
  const candidates = document.querySelectorAll(tagFilter)
  const lower = text.toLowerCase()
  const matches: { el: Element; textLen: number; priority: number }[] = []

  const overlayIds = ['assetnode-autopilot-log', 'assetnode-autopilot-countdown', 'assetnode-autopilot-report', 'assetnode-guide-overlay']

  for (const el of candidates) {
    if (overlayIds.some(id => el.closest(`#${id}`))) continue

    const elText = (el as HTMLElement).textContent?.trim().toLowerCase() || ''
    if (!elText.includes(lower)) continue

    const tag = el.tagName.toLowerCase()
    const role = el.getAttribute('role')
    const priority = (tag === 'button' || role === 'button' || role === 'menuitem') ? 0
                   : tag === 'a' ? 1
                   : 2

    matches.push({ el, textLen: elText.length, priority })
  }

  if (!matches.length) return null

  matches.sort((a, b) => a.priority - b.priority || a.textLen - b.textLen)
  return matches[0].el
}

function findElement(selectorString: string): Element | null {
  const selectors = selectorString.split(',').map(s => s.trim())
  for (const sel of selectors) {
    try {
      if (sel.startsWith('text:')) {
        const text = sel.slice(5)
        const el = findElementByText(text)
        if (el) return el
        continue
      }
      const el = document.querySelector(sel)
      if (el) return el
    } catch {
    }
  }
  return null
}

function waitForElement(selector: string, timeoutMs: number = 15000): Promise<Element | null> {
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


function resolveClickTarget(el: Element): Element {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role')

  if (tag === 'button' || tag === 'a' || tag === 'input' ||
      role === 'button' || role === 'menuitem' || role === 'link' || role === 'tab') {
    return el
  }

  const interactiveSelectors = [
    'button',
    'a[href]',
    'a',
    '[role="menuitem"]',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[tabindex="0"]',
  ]

  for (const sel of interactiveSelectors) {
    const child = el.querySelector(sel)
    if (child) return child
  }

  const parent = el.parentElement
  if (parent) {
    const pTag = parent.tagName.toLowerCase()
    const pRole = parent.getAttribute('role')
    if (pTag === 'button' || pTag === 'a' ||
        pRole === 'button' || pRole === 'menuitem' || pRole === 'link') {
      return parent
    }
  }

  return el
}

async function executeClick(action: AutoAction): Promise<boolean> {
  const selector = action.selector
  if (!selector) {
    appendLog('No selector for click action', 'error')
    return false
  }

  let el = await waitForElement(selector)
  if (!el) {
    appendLog(`Element not found: ${selector.substring(0, 60)}...`, 'error')
    return false
  }

  const rawTag = el.tagName.toLowerCase()
  const rawText = (el as HTMLElement).textContent?.trim().substring(0, 40) || ''
  appendLog(`Found <${rawTag}> "${rawText}"`, 'info')

  el = resolveClickTarget(el)
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role') || ''
  if (tag !== rawTag) {
    appendLog(`Resolved to <${tag}${role ? ` role="${role}"` : ''}> for clicking`, 'info')
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(500)

  const originalOutline = (el as HTMLElement).style.outline
  ;(el as HTMLElement).style.outline = '3px solid #6366f1'
  await sleep(300)

  ;(el as HTMLElement).focus()
  await sleep(100)

  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const eventOpts: MouseEventInit = {
    bubbles: true, cancelable: true, composed: true,
    clientX: cx, clientY: cy, view: window,
    button: 0, buttons: 1,
  }

  el.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, pointerId: 1 }))
  el.dispatchEvent(new MouseEvent('mousedown', eventOpts))
  await sleep(80)
  el.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, pointerId: 1 }))
  el.dispatchEvent(new MouseEvent('mouseup', eventOpts))
  await sleep(30)
  el.dispatchEvent(new MouseEvent('click', eventOpts))

  ;(el as HTMLElement).click()
  ;(el as HTMLElement).style.outline = originalOutline

  appendLog(action.logMessage, 'success')
  return true
}

async function executeFill(action: AutoAction): Promise<boolean> {
  const selector = action.selector
  const value = action.value
  if (!selector || value === undefined) {
    appendLog('Missing selector or value for fill action', 'error')
    return false
  }

  const el = await waitForElement(selector)
  if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
    appendLog(`Input not found: ${selector.substring(0, 60)}...`, 'error')
    return false
  }

  const tag = el.tagName.toLowerCase()
  appendLog(`Found <${tag}> input — filling with "${value}"`, 'info')

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(500)

  el.focus()
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
  await sleep(200)



  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype,
    'value'
  )?.set

  if (nativeSetter) {
    nativeSetter.call(el, value)
  } else {
    el.value = value
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))

  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }))
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }))
  await sleep(500)

  el.dispatchEvent(new Event('blur', { bubbles: true }))

  appendLog(action.logMessage, 'success')
  return true
}

async function executeCopy(action: AutoAction): Promise<boolean> {
  const selector = action.selector
  const label = action.credentialLabel || 'Unknown'
  if (!selector) {
    appendLog(`No selector for copy action (${label})`, 'error')
    return false
  }

  const el = await waitForElement(selector)
  if (!el) {
    appendLog(`Element not found for ${label}: ${selector.substring(0, 60)}...`, 'warn')
    warnings.push(`Could not find "${label}" — you may need to copy it manually.`)
    return false
  }

  let value = (el as HTMLElement).textContent?.trim() ||
              (el as HTMLInputElement).value?.trim() || ''

  const isTruncated = value.endsWith('...') || value.endsWith('…') || value.length === 0

  if (isTruncated) {
    appendLog(`Value appears truncated or empty — trying copy button`, 'info')



    const copyBtn = el.querySelector('button, [role="button"], .ms-Button, [aria-label*="Copy"], [aria-label*="Kopier"]')
      || el.querySelector('svg')?.closest('button')
      || el.parentElement?.querySelector('button, [role="button"]')

    if (copyBtn) {
      appendLog(`Found copy button — clicking to copy to clipboard`, 'info')
      ;(copyBtn as HTMLElement).click()
      await sleep(500)

      try {
        const clipboardValue = await navigator.clipboard.readText()
        if (clipboardValue && clipboardValue.length > 0) {
          value = clipboardValue.trim()
          appendLog(`Got value from clipboard: ${value.substring(0, 8)}...`, 'info')
        }
      } catch (e) {
        appendLog(`Clipboard read failed (expected) — trying title/data attributes`, 'info')
      }
    }

    if (isTruncated && (!value || value.endsWith('...') || value.endsWith('…'))) {
      const htmlEl = el as HTMLElement
      const fromTitle = htmlEl.getAttribute('title') || htmlEl.querySelector('[title]')?.getAttribute('title') || ''
      const fromAriaLabel = htmlEl.getAttribute('aria-label') || ''
      const fromDataValue = htmlEl.getAttribute('data-value') || htmlEl.getAttribute('data-clipboard-text') || ''

      const candidate = fromTitle || fromAriaLabel || fromDataValue
      if (candidate && candidate.length > value.length) {
        value = candidate.trim()
        appendLog(`Got value from attribute: ${value.substring(0, 8)}...`, 'info')
      }
    }

    if (!value || value.endsWith('...') || value.endsWith('…')) {
      const spans = el.querySelectorAll('span, div')
      let longest = ''
      spans.forEach(s => {
        const t = s.getAttribute('title') || s.textContent?.trim() || ''
        if (t.length > longest.length && !t.endsWith('...') && !t.endsWith('…')) {
          longest = t
        }
      })
      if (longest.length > 0) {
        value = longest
        appendLog(`Got value from child element: ${value.substring(0, 8)}...`, 'info')
      }
    }
  }

  if (!value || value.endsWith('...') || value.endsWith('…')) {
    appendLog(`Empty value for ${label}`, 'warn')
    warnings.push(`"${label}" was empty — check the portal manually.`)
    return false
  }

  collectedCredentials.push({ label, value })
  appendLog(`${action.logMessage}: ${value.substring(0, 8)}...`, 'success')
  return true
}

async function executeCopyClipboard(action: AutoAction): Promise<boolean> {
  const selector = action.selector
  const label = action.credentialLabel || 'Unknown'
  if (!selector) {
    appendLog(`No selector for copy-clipboard action (${label})`, 'error')
    return false
  }

  const el = await waitForElement(selector)
  if (!el) {
    appendLog(`Copy button not found for ${label}: ${selector.substring(0, 60)}...`, 'warn')
    warnings.push(`Could not find copy button for "${label}" — you may need to copy it manually.`)
    return false
  }

  appendLog(`Found copy button — clicking to copy ${label} to clipboard`, 'info')

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(300)
  ;(el as HTMLElement).focus()
  await sleep(100)
  ;(el as HTMLElement).click()

  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const eventOpts: MouseEventInit = {
    bubbles: true, cancelable: true, composed: true,
    clientX: cx, clientY: cy, view: window,
    button: 0, buttons: 1,
  }
  el.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, pointerId: 1 }))
  el.dispatchEvent(new MouseEvent('mousedown', eventOpts))
  await sleep(80)
  el.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, pointerId: 1 }))
  el.dispatchEvent(new MouseEvent('mouseup', eventOpts))
  await sleep(30)
  el.dispatchEvent(new MouseEvent('click', eventOpts))

  await sleep(800)

  let value = ''
  try {
    value = await navigator.clipboard.readText()
    if (value) {
      value = value.trim()
      appendLog(`Got ${label} from clipboard: ${value.substring(0, 8)}...`, 'info')
    }
  } catch (e) {
    appendLog(`Clipboard API blocked — trying fallback`, 'info')
  }

  if (!value) {
    try {
      const ta = document.createElement('textarea')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      document.execCommand('paste')
      value = ta.value.trim()
      document.body.removeChild(ta)
      if (value) {
        appendLog(`Got ${label} from paste fallback: ${value.substring(0, 8)}...`, 'info')
      }
    } catch (e) {
      appendLog(`Paste fallback also failed`, 'warn')
    }
  }

  if (!value) {
    appendLog(`Could not read clipboard for ${label}`, 'warn')
    warnings.push(`"${label}" — clipboard read failed. Copy it manually from the portal.`)
    return false
  }

  collectedCredentials.push({ label, value })
  appendLog(`${action.logMessage}: ${value.substring(0, 8)}...`, 'success')
  return true
}

async function executeWait(action: AutoAction): Promise<boolean> {
  const duration = action.duration || 2000
  appendLog(action.logMessage, 'info')
  await sleep(duration)
  return true
}

async function executeNavigate(action: AutoAction): Promise<boolean> {
  if (!action.url) {
    appendLog('No URL for navigate action', 'error')
    return false
  }
  appendLog(action.logMessage, 'info')
  window.location.href = action.url
  return true
}


export async function runAutopilot(
  steps: AutoPilotStep[],
  session: GuideSession,
  onStepComplete: (index: number) => void,
  onFinished: (report: CredentialReport) => void,
  startAt: number = 0,
): Promise<void> {
  cancelled = false
  collectedCredentials.length = 0
  warnings.length = 0
  actionLog.length = 0

  ensureLogPanel()
  const remaining = steps.length - startAt
  appendLog(`Starting autopilot from step ${startAt + 1}: ${remaining} step(s) remaining`, 'info')

  for (let i = startAt; i < steps.length; i++) {
    if (cancelled) {
      appendLog('Autopilot cancelled by user', 'warn')
      break
    }

    const step = steps[i]
    const actions = step.autoAction
      ? Array.isArray(step.autoAction) ? step.autoAction : [step.autoAction]
      : []

    session.currentStep = i
    onStepComplete(i)

    appendLog(`Step ${i + 1}/${steps.length}: ${step.title}`, 'info')

    if (!actions.length) {
      appendLog(`⏭️ No autopilot action defined — skipping`, 'warn')
      warnings.push(`Step "${step.title}" has no autopilot action and was skipped.`)
      continue
    }

    for (const action of actions) {
      if (cancelled) break

      const needsConfirmation = step.requireConfirmation !== false
      if (needsConfirmation) {
        const proceed = await showCountdown(
          `${action.logMessage}`,
          3,
        )
        if (!proceed) {
          appendLog('Action skipped by user', 'warn')
          warnings.push(`Skipped: ${action.logMessage}`)
          continue
        }
      }

      let success = false
      try {
        switch (action.type) {
          case 'click':
            success = await executeClick(action)
            break
          case 'fill':
            success = await executeFill(action)
            break
          case 'copy':
            success = await executeCopy(action)
            break
          case 'copy-clipboard':
            success = await executeCopyClipboard(action)
            break
          case 'wait':
            success = await executeWait(action)
            break
          case 'navigate':



            session.currentStep = i + 1
            onStepComplete(i + 1)
            success = await executeNavigate(action)
            if (success) {
              appendLog(`Navigate triggered — will resume at step ${i + 2}`, 'info')
              return
            }
            break
          case 'select':
            success = await executeClick(action)
            break
          default:
            appendLog(`Unknown action type: ${action.type}`, 'error')
        }
      } catch (err) {
        appendLog(`Error: ${String(err)}`, 'error')
        warnings.push(`Error on "${step.title}": ${String(err)}`)
      }

      if (!success && action.type !== 'copy' && action.type !== 'copy-clipboard') {
        appendLog(`❌ CRITICAL: "${step.title}" failed — halting autopilot`, 'error')
        warnings.push(`HALTED at "${step.title}" — action failed. Remaining steps skipped.`)
        cancelled = true
        break
      }

      await sleep(1500)
    }
  }

  const report: CredentialReport = {
    portalName: session.slug,
    collectedAt: new Date().toISOString(),
    credentials: [...collectedCredentials],
    warnings: [...warnings],
  }

  appendLog(`Autopilot complete! Collected ${report.credentials.length} credential(s)`, 'success')
  showReport(report)
  onFinished(report)
}

export function stopAutopilot() {
  cancelled = true
  countdownAbortController?.abort()
  removeCountdown()
  appendLog('Autopilot stopped', 'warn')
}

export function cleanupAutopilot() {
  cancelled = true
  removeCountdown()
  logPanel?.remove()
  logPanel = null
  document.getElementById('assetnode-autopilot-report')?.remove()
}


function showReport(report: CredentialReport) {
  const badge = logPanel?.querySelector('.autopilot-log-badge')
  if (badge) {
    badge.textContent = 'COMPLETE'
    badge.classList.add('complete')
  }

  const modal = document.createElement('div')
  modal.id = 'assetnode-autopilot-report'

  const card = document.createElement('div')
  card.className = 'autopilot-report-card'

  const header = document.createElement('div')
  header.className = 'autopilot-report-header'
  header.textContent = '🤓 Autopilot Complete!'

  const subtitle = document.createElement('div')
  subtitle.className = 'autopilot-report-subtitle'
  subtitle.textContent = 'Here are the credentials you need to paste into AssetNode:'

  card.appendChild(header)
  card.appendChild(subtitle)

  if (report.credentials.length) {
    const credList = document.createElement('div')
    credList.className = 'autopilot-report-credentials'

    for (const cred of report.credentials) {
      const row = document.createElement('div')
      row.className = 'autopilot-report-cred-row'

      const label = document.createElement('span')
      label.className = 'autopilot-report-cred-label'
      label.textContent = cred.label

      const value = document.createElement('code')
      value.className = 'autopilot-report-cred-value'
      value.textContent = cred.value

      const copyBtn = document.createElement('button')
      copyBtn.className = 'autopilot-report-copy-btn'
      copyBtn.textContent = '📋'
      copyBtn.title = `Copy ${cred.label}`
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(cred.value).then(() => {
          copyBtn.textContent = '✅'
          setTimeout(() => { copyBtn.textContent = '📋' }, 1500)
        })
      })

      row.appendChild(label)
      row.appendChild(value)
      row.appendChild(copyBtn)
      credList.appendChild(row)
    }

    card.appendChild(credList)
  } else {
    const noCreds = document.createElement('div')
    noCreds.className = 'autopilot-report-empty'
    noCreds.textContent = 'No credentials were collected. Check the log for details.'
    card.appendChild(noCreds)
  }

  if (report.warnings.length) {
    const warnSection = document.createElement('div')
    warnSection.className = 'autopilot-report-warnings'

    const warnTitle = document.createElement('div')
    warnTitle.className = 'autopilot-report-warn-title'
    warnTitle.textContent = '⚠️ Warnings'

    warnSection.appendChild(warnTitle)
    for (const w of report.warnings) {
      const warnItem = document.createElement('div')
      warnItem.className = 'autopilot-report-warn-item'
      warnItem.textContent = w
      warnSection.appendChild(warnItem)
    }

    card.appendChild(warnSection)
  }

  const closeBtn = document.createElement('button')
  closeBtn.className = 'autopilot-report-close'
  closeBtn.textContent = 'Done'
  closeBtn.addEventListener('click', () => modal.remove())
  card.appendChild(closeBtn)

  modal.appendChild(card)
  document.body.appendChild(modal)
}


function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
