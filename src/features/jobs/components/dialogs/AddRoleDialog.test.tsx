import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@test/render'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider'
import { findCrewOverlaps } from '@features/conflicts/api/overlapChecks'
import AddRoleDialog from './AddRoleDialog'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const { insertTimePeriod, insertCrew } = vi.hoisted(() => ({
  insertTimePeriod: vi.fn(),
  insertCrew: vi.fn(),
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'time_periods') {
        return {
          insert: (payload: unknown) => {
            insertTimePeriod(payload)
            return {
              select: () => ({
                single: async () => ({ data: { id: 'tp-new' }, error: null }),
              }),
            }
          },
        }
      }
      if (table === 'reserved_crew') {
        return {
          insert: (payload: unknown) => {
            insertCrew(payload)
            return Promise.resolve({ error: null })
          },
        }
      }
      return {
        insert: () => Promise.resolve({ error: null }),
      }
    },
  },
}))

vi.mock('@shared/auth/useAuthz', () => ({
  useAuthz: () => ({
    userId: 'auth-1',
  }),
}))

vi.mock('@features/jobs/api/queries', () => ({
  jobDetailQuery: ({ jobId }: { jobId: string }) => ({
    queryKey: ['jobs-detail', jobId],
    queryFn: async () => ({
      company_id: 'co-1',
      start_at: '2026-08-30T08:00:00',
      end_at: '2026-08-30T18:00:00',
    }),
  }),
}))

vi.mock('@features/conflicts/api/overlapChecks', () => ({
  findCrewOverlaps: vi.fn(),
}))

vi.mock('@features/conflicts/components/ForceBookingDialog', () => ({
  ForceBookingDialog: () => null,
}))

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

function renderDialog(onOpenChange = vi.fn()) {
  return renderWithProviders(
    <AppToastProvider>
      <AddRoleDialog open onOpenChange={onOpenChange} jobId="job-1" />
    </AppToastProvider>,
  )
}

async function fillTitleAndWaitForPeriod(
  user: ReturnType<typeof userEvent.setup>,
) {
  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Select period' }),
    ).not.toBeInTheDocument()
  })
  await user.type(
    screen.getByPlaceholderText('e.g. FOH, Monitor, Loader'),
    'FOH',
  )
}

describe('AddRoleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findCrewOverlaps).mockResolvedValue(new Map())
  })

  it('shows a Confirm myself option', async () => {
    renderDialog()

    expect(
      await screen.findByRole('checkbox', { name: /Confirm myself/i }),
    ).toBeInTheDocument()
  })

  it('creates an open role without assigning anyone', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)

    await fillTitleAndWaitForPeriod(user)
    await user.click(screen.getByRole('button', { name: 'Add role' }))

    await waitFor(() => {
      expect(insertTimePeriod).toHaveBeenCalled()
    })
    expect(insertTimePeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: 'job-1',
        company_id: 'co-1',
        title: 'FOH',
        category: 'crew',
        needed_count: 1,
      }),
    )
    expect(insertCrew).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('confirms the logged-in user on the role when Confirm myself is checked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)

    await fillTitleAndWaitForPeriod(user)
    await user.click(screen.getByRole('checkbox', { name: /Confirm myself/i }))
    await user.click(
      screen.getByRole('button', { name: 'Add and confirm myself' }),
    )

    await waitFor(() => {
      expect(insertCrew).toHaveBeenCalled()
    })
    expect(insertCrew).toHaveBeenCalledWith(
      expect.objectContaining({
        time_period_id: 'tp-new',
        user_id: 'auth-1',
        status: 'confirmed',
        notes: null,
      }),
    )
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
