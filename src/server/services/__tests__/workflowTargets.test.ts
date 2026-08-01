import mongoose from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import { requireTenantWorkflowTargets } from '../workflowTargets'

function fakeModel(foundIds: string[]) {
  const lean = vi.fn(async () => foundIds.map(_id => ({ _id })))
  const select = vi.fn(() => ({ lean }))
  const find = vi.fn(() => ({ select }))
  return { model: { find } as any, find, select, lean }
}

describe('tenant-scoped workflow targets', () => {
  it('accepts assignment hardwareIds and includes the tenant in its proof query', async () => {
    const first = new mongoose.Types.ObjectId().toString()
    const second = new mongoose.Types.ObjectId().toString()
    const fake = fakeModel([first, second])

    await expect(requireTenantWorkflowTargets(fake.model, 'hardware', 'org-a', {
      hardwareIds: [first, second, first]
    })).resolves.toEqual([first, second])
    expect(fake.find).toHaveBeenCalledWith({
      _id: { $in: [first, second] },
      orgId: 'org-a',
      deletedAt: null
    })
  })

  it('rejects the entire action when one supplied target is cross-tenant or missing', async () => {
    const allowed = new mongoose.Types.ObjectId().toString()
    const foreign = new mongoose.Types.ObjectId().toString()
    const fake = fakeModel([allowed])

    await expect(requireTenantWorkflowTargets(fake.model, 'hardware', 'org-a', {
      assetIds: [allowed, foreign]
    })).rejects.toThrow('not found in this organization')
  })

  it('never reuses hardware identifiers for another entity', async () => {
    const hardwareId = new mongoose.Types.ObjectId().toString()
    const fake = fakeModel([])

    await expect(requireTenantWorkflowTargets(fake.model, 'license', 'org-a', { hardwareId }))
      .resolves.toEqual([])
    expect(fake.find).not.toHaveBeenCalled()
  })

  it('rejects malformed explicit identifiers before querying', async () => {
    const fake = fakeModel([])
    await expect(requireTenantWorkflowTargets(fake.model, 'employee', 'org-a', { employeeId: 'not-an-id' }))
      .rejects.toThrow('Invalid employee target')
    expect(fake.find).not.toHaveBeenCalled()
  })
})
