import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { JobBookingConflictsBanner } from './JobBookingConflictsBanner'

const rpcMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

const futureStart = '2099-01-01T08:00:00Z'
const futureMid = '2099-01-01T10:00:00Z'
const futureEnd = '2099-01-01T18:00:00Z'
const futureEndLate = '2099-01-01T20:00:00Z'

const forcedGroup = {
  group_id_1: 'g1',
  group_id_2: 'g2',
  group_name_1: 'Vocal package',
  group_name_2: 'Vocal package',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j1',
  job_id_2: 'j2',
  job_title_1: 'Job A',
  job_title_2: 'Job B',
  start_1: futureStart,
  end_1: futureEnd,
  start_2: futureMid,
  end_2: futureEndLate,
  forced_1: true,
  forced_2: true,
}

const forcedItem = {
  item_id: 'i1',
  item_name: 'SM58',
  capacity: 2,
  total_reserved: 3,
  start_at: futureStart,
  end_at: futureEnd,
  job_ids: ['j1', 'j2'],
  job_titles: ['Job A', 'Job B'],
  has_forced: true,
}

describe('JobBookingConflictsBanner', () => {
  it('lists forced group overlaps under Equipment, not a Groups heading', async () => {
    rpcMock.mockResolvedValue({
      data: {
        crew: [],
        vehicles: [],
        equipment: [forcedItem],
        groups: [forcedGroup],
      },
      error: null,
    })

    renderWithProviders(<JobBookingConflictsBanner jobId="job-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('Forced overlaps (1 group and 1 item)'),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByText('Equipment (1 group and 1 item)'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Groups \(/)).not.toBeInTheDocument()
    expect(screen.getByText(/Vocal package overlaps/)).toBeInTheDocument()
    expect(screen.getByText(/SM58 is over capacity/)).toBeInTheDocument()
  })

  it('hides conflicts whose windows are entirely in the past', async () => {
    rpcMock.mockResolvedValue({
      data: {
        crew: [],
        vehicles: [],
        equipment: [
          {
            ...forcedItem,
            start_at: '2020-01-01T08:00:00Z',
            end_at: '2020-01-01T18:00:00Z',
          },
        ],
        groups: [
          {
            ...forcedGroup,
            start_1: '2020-01-01T08:00:00Z',
            end_1: '2020-01-01T18:00:00Z',
            start_2: '2020-01-01T10:00:00Z',
            end_2: '2020-01-01T20:00:00Z',
          },
        ],
      },
      error: null,
    })

    renderWithProviders(<JobBookingConflictsBanner jobId="job-1" />)

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalled()
    })

    expect(screen.queryByText(/scheduling conflicts/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/SM58/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Vocal package/)).not.toBeInTheDocument()
  })
})
