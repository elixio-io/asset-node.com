
import { Organization } from '../../models/Organization'
import { syncKandji, type SyncResult } from './syncKandji'
import { syncIntune } from './syncIntune'
import { syncAutopilot } from './syncAutopilot'
import { syncJamfPro, syncJamfSchool } from './syncJamf'
import { syncPersonio } from './syncPersonio'
import { syncBambooHR } from './syncBambooHR'
import { syncGoogleWorkspace } from './syncGoogleWorkspace'
import { syncHiBob } from './syncHiBob'
import { syncMosyle } from './syncMosyle'
import { workflowEventBus } from './workflowEventBus'

export interface OrchestratorResult {
  orgId: string
  timestamp: string
  results: SyncResult[]
  totalCreated: number
  totalUpdated: number
  totalErrors: number
  duration: number
}

export async function runFullSync(orgId: string): Promise<OrchestratorResult> {
  const start = Date.now()
  const results: SyncResult[] = []

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const integrations = org.settings?.integrations
  console.log('\n══════════════════════════════════════════════')
  console.log('  🔄 Integration Sync — Starting Full Sync')
  console.log('══════════════════════════════════════════════\n')


  if (integrations?.kandji?.enabled) {
    try {
      console.log('🔄 Syncing Kandji...')
      results.push(await syncKandji(orgId))
    } catch (err: any) {
      console.error(`❌ Kandji sync failed: ${err.message}`)
      results.push({ provider: 'kandji', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }

  if (integrations?.intune?.enabled) {
    try {
      console.log('🔄 Syncing Intune...')
      results.push(await syncIntune(orgId))

      console.log('🔄 Syncing Autopilot...')
      results.push(await syncAutopilot(orgId))
    } catch (err: any) {
      console.error(`❌ Intune/Autopilot sync failed: ${err.message}`)
      results.push({ provider: 'intune', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }

  if (integrations?.jamf?.enabled) {
    try {
      console.log('🔄 Syncing Jamf Pro...')
      results.push(await syncJamfPro(orgId))
    } catch (err: any) {
      console.error(`❌ Jamf Pro sync failed: ${err.message}`)
      results.push({ provider: 'jamf-pro', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }

    try {
      console.log('🔄 Syncing Jamf School...')
      results.push(await syncJamfSchool(orgId))
    } catch (err: any) {
      console.warn(`⚠️ Jamf School sync failed: ${err.message}`)
      results.push({ provider: 'jamf-school', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }


  if (integrations?.personio?.enabled) {
    try {
      console.log('🔄 Syncing Personio...')
      results.push(await syncPersonio(orgId))
    } catch (err: any) {
      console.error(`❌ Personio sync failed: ${err.message}`)
      results.push({ provider: 'personio', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }

  if (integrations?.bamboohr?.enabled) {
    try {
      console.log('🔄 Syncing BambooHR...')
      results.push(await syncBambooHR(orgId))
    } catch (err: any) {
      console.error(`❌ BambooHR sync failed: ${err.message}`)
      results.push({ provider: 'bamboohr', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }

  if (integrations?.googleWorkspace?.enabled) {
    try {
      console.log('🔄 Syncing Google Workspace...')
      results.push(await syncGoogleWorkspace(orgId))
    } catch (err: any) {
      console.error(`❌ Google Workspace sync failed: ${err.message}`)
      results.push({ provider: 'google-workspace', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }

  if (integrations?.hibob?.enabled) {
    try {
      console.log('🔄 Syncing HiBob...')
      results.push(await syncHiBob(orgId))
    } catch (err: any) {
      console.error(`❌ HiBob sync failed: ${err.message}`)
      results.push({ provider: 'hibob', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }


  if (integrations?.mosyle?.enabled) {
    try {
      console.log('🔄 Syncing Mosyle...')
      results.push(await syncMosyle(orgId))
    } catch (err: any) {
      console.error(`❌ Mosyle sync failed: ${err.message}`)
      results.push({ provider: 'mosyle', created: 0, updated: 0, errors: [err.message], duration: 0 })
    }
  }


  const duration = Date.now() - start
  const totalCreated = results.reduce((s, r) => s + r.created, 0)
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0)
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0)

  console.log('\n══════════════════════════════════════════════')
  console.log(`  ✅ Sync complete in ${duration}ms`)
  console.log(`     Created: ${totalCreated} | Updated: ${totalUpdated} | Errors: ${totalErrors}`)
  console.log('══════════════════════════════════════════════\n')



  for (const r of results) {
    const mdmProviders = ['kandji', 'intune', 'autopilot', 'jamf-pro', 'jamf-school', 'mosyle']
    const hrProviders = ['personio', 'bamboohr', 'google-workspace', 'hibob']
    const status = r.errors.length === 0
      ? 'success'
      : r.created + r.updated > 0
        ? 'partial'
        : 'failure'

    if (mdmProviders.includes(r.provider)) {
      workflowEventBus.emitWorkflowEvent('hardware.synced', {
        orgId,
        provider: r.provider,
        status,
        created: r.created,
        updated: r.updated,
        errorCount: r.errors.length
      })
    }
    if (hrProviders.includes(r.provider)) {
      workflowEventBus.emitWorkflowEvent('employee.synced', {
        orgId,
        provider: r.provider,
        status,
        created: r.created,
        updated: r.updated,
        errorCount: r.errors.length
      })
    }
  }

  return {
    orgId,
    timestamp: new Date().toISOString(),
    results,
    totalCreated,
    totalUpdated,
    totalErrors,
    duration
  }
}


let syncTimer: ReturnType<typeof setInterval> | null = null

export function startSyncTimer(orgId: string, intervalMinutes = 60): void {
  if (syncTimer) clearInterval(syncTimer)

  console.log(`⏰ Sync timer started: every ${intervalMinutes} minutes`)

  setTimeout(() => runFullSync(orgId).catch(console.error), 5000)

  syncTimer = setInterval(
    () => runFullSync(orgId).catch(console.error),
    intervalMinutes * 60 * 1000
  )
}

export function stopSyncTimer(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
    console.log('⏰ Sync timer stopped')
  }
}
