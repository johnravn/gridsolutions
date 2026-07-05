import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuthz } from './useAuthz'

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => getUserMock(),
    },
    from: (table: string) => fromMock(table),
  },
}))

vi.mock('@shared/companies/CompanyProvider', () => ({
  useCompany: () => ({ companyId: 'company-1' }),
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
    getUserMock.mockReset()
    fromMock.mockReset()
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
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

    expect(result.current.caps.size).toBe(0)
  })
})
