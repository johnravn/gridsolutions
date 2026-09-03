import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuthz } from './useAuthz'

const { getSessionMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
    from: (table: string) => fromMock(table),
  },
}))

const companyState = { companyId: 'company-1' as string | null, loading: false }

vi.mock('@shared/companies/CompanyProvider', () => ({
  useCompany: () => companyState,
}))

function buildFromChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useAuthz', () => {
  beforeEach(() => {
    getSessionMock.mockReset()
    fromMock.mockReset()
    companyState.companyId = 'company-1'
    companyState.loading = false
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    })
  })

  it('returns owner capabilities for company owner', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return buildFromChain({ data: { superuser: false }, error: null })
      }
      if (table === 'company_users') {
        return buildFromChain({ data: { role: 'owner' }, error: null })
      }
      return buildFromChain({ data: null, error: null })
    })

    const { result } = renderHook(() => useAuthz(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.companyRole).toBe('owner')
    })
    expect(result.current.caps.has('visit:jobs')).toBe(true)
    expect(result.current.userId).toBe('user-1')
  })

  it('grants visit:latest to freelancer when company expansion is enabled', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return buildFromChain({ data: { superuser: false }, error: null })
      }
      if (table === 'company_users') {
        return buildFromChain({ data: { role: 'freelancer' }, error: null })
      }
      if (table === 'company_expansions') {
        return buildFromChain({
          data: { latest_feed_open_to_freelancers: true },
          error: null,
        })
      }
      return buildFromChain({ data: null, error: null })
    })

    const { result } = renderHook(() => useAuthz(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.companyRole).toBe('freelancer')
    })
    expect(result.current.caps.has('visit:latest')).toBe(true)
  })

  it('returns empty caps while loading', async () => {
    fromMock.mockImplementation(() =>
      buildFromChain({ data: null, error: null }),
    )

    const { result } = renderHook(() => useAuthz(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.caps.size).toBe(0)
  })

  it('stays loading while company membership is unresolved', async () => {
    companyState.companyId = null
    companyState.loading = true
    fromMock.mockImplementation(() =>
      buildFromChain({ data: null, error: null }),
    )

    const { result } = renderHook(() => useAuthz(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(getSessionMock).toHaveBeenCalled()
    })
    expect(fromMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.caps.size).toBe(0)
  })
})
