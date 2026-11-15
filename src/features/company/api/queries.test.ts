import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  patchCompanyExpansion,
  removeCompanyUser,
  setCompanyUserRole,
} from './queries'

const getUserMock = vi.fn()
const rpcMock = vi.fn()
const deleteMock = vi.fn()
const eqMock = vi.fn()
const maybeSingleMock = vi.fn()
const updateEqMock = vi.fn()
const insertMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => getUserMock(),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (table: string) => {
      if (table === 'company_users') {
        return {
          delete: () => ({
            eq: (...args: unknown[]) => {
              eqMock(...args)
              return {
                eq: (...innerArgs: unknown[]) => {
                  eqMock(...innerArgs)
                  return deleteMock()
                },
              }
            },
          }),
        }
      }
      if (table === 'company_expansions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => maybeSingleMock(),
            }),
          }),
          update: (payload: unknown) => ({
            eq: (...args: unknown[]) => updateEqMock(payload, ...args),
          }),
          insert: (payload: unknown) => insertMock(payload),
        }
      }
      return {}
    },
  },
}))

describe('company api mutations', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    rpcMock.mockReset()
    deleteMock.mockReset()
    eqMock.mockReset()
    maybeSingleMock.mockReset()
    updateEqMock.mockReset()
    insertMock.mockReset()
  })

  it('setCompanyUserRole calls RPC with actor and target', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'actor-1' } } })
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })

    const result = await setCompanyUserRole({
      companyId: 'company-1',
      userId: 'user-2',
      role: 'employee',
    })

    expect(result).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('set_company_user_role', {
      p_company_id: 'company-1',
      p_target_user_id: 'user-2',
      p_new_role: 'employee',
      p_actor_user_id: 'actor-1',
    })
  })

  it('setCompanyUserRole throws when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    await expect(
      setCompanyUserRole({
        companyId: 'company-1',
        userId: 'user-2',
        role: 'employee',
      }),
    ).rejects.toThrow(/Not authenticated|null/)
  })

  it('setCompanyUserRole maps role_not_assignable to a clear error', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'actor-1' } } })
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'role_not_assignable',
        hint: 'You cannot assign that company role.',
      },
    })

    await expect(
      setCompanyUserRole({
        companyId: 'company-1',
        userId: 'user-2',
        role: 'owner',
      }),
    ).rejects.toThrow('You cannot assign that company role.')
  })

  it('removeCompanyUser deletes company_users row', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'actor-1' } } })
    deleteMock.mockResolvedValue({ error: null })

    await removeCompanyUser({ companyId: 'company-1', userId: 'user-2' })

    expect(eqMock).toHaveBeenCalledWith('company_id', 'company-1')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-2')
  })

  it('patchCompanyExpansion updates when a row exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'exp-1' }, error: null })
    updateEqMock.mockResolvedValue({ error: null })

    await patchCompanyExpansion({
      companyId: 'company-1',
      patch: { crew_rate_per_day: 1000 },
    })

    expect(updateEqMock).toHaveBeenCalledWith(
      { crew_rate_per_day: 1000 },
      'company_id',
      'company-1',
    )
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('patchCompanyExpansion inserts when no row exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    insertMock.mockResolvedValue({ error: null })

    await patchCompanyExpansion({
      companyId: 'company-1',
      patch: { latest_feed_open_to_freelancers: true },
    })

    expect(insertMock).toHaveBeenCalledWith({
      company_id: 'company-1',
      latest_feed_open_to_freelancers: true,
    })
    expect(updateEqMock).not.toHaveBeenCalled()
  })
})
