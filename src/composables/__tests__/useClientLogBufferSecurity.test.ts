import { beforeEach, describe, expect, it } from 'vitest'
import { clearLog, pushLog, snapshotLog } from '../useClientLogBuffer'

describe('client support log privacy', () => {
  beforeEach(() => clearLog())

  it('drops query strings, fragments, bearer credentials and secret assignments', () => {
    pushLog('route', '/invite?token=invite-secret#accept → /dashboard')
    pushLog('api', 'GET https://api.example.com/callback?code=oauth-code&state=oauth-state → 401')
    pushLog('error', 'Authorization: Bearer opaque-credential')
    pushLog('error', 'request failed', { file: 'https://app.example.com/reset?token=file-secret' })

    const snapshot = snapshotLog()
    expect(snapshot).not.toContain('invite-secret')
    expect(snapshot).not.toContain('oauth-code')
    expect(snapshot).not.toContain('oauth-state')
    expect(snapshot).not.toContain('opaque-credential')
    expect(snapshot).not.toContain('file-secret')
    expect(snapshot).toContain('/invite')
  })
})
