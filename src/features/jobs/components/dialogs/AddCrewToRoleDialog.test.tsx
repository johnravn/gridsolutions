import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider'
import AddCrewToRoleDialog from './AddCrewToRoleDialog'

const { thenable } = vi.hoisted(() => {
  function thenable(data: unknown) {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = self
    chain.eq = self
    chain.in = self
    chain.not = self
    chain.or = self
    chain.is = self
    chain.order = self
    chain.limit = self
    chain.insert = self
    chain.maybeSingle = async () => ({ data, error: null })
    chain.then = (
      resolve: (value: { data: unknown; error: null }) => unknown,
    ) => Promise.resolve(resolve({ data, error: null }))
    return chain
  }
  return { thenable }
})

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'profiles') {
        return thenable([
          {
            user_id: 'u-bob',
            display_name: 'Bob Other',
            email: 'bob@example.com',
          },
        ])
      }
      return thenable([])
    },
  },
}))

vi.mock('@shared/auth/useAuthz', () => ({
  useAuthz: () => ({
    companyRole: 'freelancer',
    isGlobalSuperuser: false,
    userId: 'auth-1',
  }),
}))

vi.mock('../../api/queries', () => ({
  jobDetailQuery: ({ jobId }: { jobId: string }) => ({
    queryKey: ['jobs-detail', jobId],
    queryFn: async () => ({ customer_id: 'cust-1' }),
  }),
}))

vi.mock('../../api/recentCustomerCrewQuery', () => ({
  recentCustomerCrewQuery: () => ({
    queryKey: ['jobs', 'recent-customer-crew', 'co-1', 'cust-1'],
    queryFn: async () => [
      {
        user_id: 'u-alice',
        display_name: 'Alice Usual',
        email: 'alice@example.com',
      },
    ],
  }),
}))

vi.mock('@features/conflicts/api/overlapChecks', () => ({
  findCrewOverlaps: vi.fn(),
  getTimePeriodWindow: vi.fn(),
}))

vi.mock('@features/conflicts/components/ForceBookingDialog', () => ({
  ForceBookingDialog: () => null,
}))

describe('AddCrewToRoleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows last-used crew for the customer above the full list', async () => {
    renderWithProviders(
      <AppToastProvider>
        <AddCrewToRoleDialog
          open
          onOpenChange={vi.fn()}
          jobId="job-1"
          timePeriodId="role-1"
          companyId="co-1"
        />
      </AppToastProvider>,
    )

    expect(
      await screen.findByText('Last used for this customer'),
    ).toBeInTheDocument()
    expect(screen.getByText('Alice Usual')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('All crew')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Other')).toBeInTheDocument()
  })
})
