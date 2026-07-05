import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeCompanyUser, setCompanyUserRole } from './queries'

const getUserMock = vi.fn()
const rpcMock = vi.fn()
const deleteMock = vi.fn()
const eqMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => getUserMock(),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
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
    }),
  },
}))

describe('company api mutations', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    rpcMock.mockReset()
    deleteMock.mockReset()
    eqMock.mockReset()
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

  it('removeCompanyUser deletes company_users row', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'actor-1' } } })
    deleteMock.mockResolvedValue({ error: null })

    await removeCompanyUser({ companyId: 'company-1', userId: 'user-2' })

    expect(eqMock).toHaveBeenCalledWith('company_id', 'company-1')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-2')
  })
})
