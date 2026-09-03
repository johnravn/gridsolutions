import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { ConflictScrollCard } from './conflictScrollCards'
import { buildConflictCards } from '@features/conflicts/utils/conflictItems'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
} from '@features/conflicts/api/queries'
import type { ReactNode } from 'react'

vi.mock('@shared/auth/useAuthz', () => ({
  useAuthz: () => ({
    caps: new Set(['visit:conflicts']),
    loading: false,
  }),
}))

const navigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({
    children,
    search,
    ...props
  }: {
    children: ReactNode
    search?: { jobId?: string }
  }) => (
    <a href={`/jobs?jobId=${search?.jobId ?? ''}`} {...props}>
      {children}
    </a>
  ),
}))

const crew: CrewConflictRow = {
  user_id: 'u1',
  user_display_name: 'Anna',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j1',
  job_id_2: 'j2',
  job_title_1: 'Job A',
  job_title_2: 'Job B',
  start_1: '2026-01-01T08:00:00.000Z',
  end_1: '2026-01-01T18:00:00.000Z',
  start_2: '2026-01-01T10:00:00.000Z',
  end_2: '2026-01-01T20:00:00.000Z',
  forced_1: false,
  forced_2: false,
}

describe('ConflictScrollCard', () => {
  it('shows clickable jobs and opens the Conflicts page', () => {
    navigate.mockClear()
    const item = buildConflictCards([crew], [], [], [])[0]
    if (!item) throw new Error('expected conflict card')
    renderWithProviders(<ConflictScrollCard item={item} />)

    expect(screen.getByText('Unresolved · Crew')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open job Job A' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open job Job B' }),
    ).toBeInTheDocument()

    screen.getByRole('link', { name: 'Open conflict Anna' }).click()
    expect(navigate).toHaveBeenCalledWith({
      to: '/conflicts',
      search: { conflictId: item.key },
    })
  })

  it('scrolls job chips horizontally when there are more than two', () => {
    const equipment: EquipmentConflictRow = {
      item_id: 'item-1',
      item_name: 'Mic',
      capacity: 8,
      total_reserved: 12,
      start_at: '2026-01-01T08:00:00.000Z',
      end_at: '2026-01-01T12:00:00.000Z',
      job_ids: ['j1', 'j2', 'j3'],
      job_titles: ['Job A', 'Job B', 'Job C'],
      has_forced: false,
    }
    const item = buildConflictCards([], [], [equipment], [])[0]
    if (!item) throw new Error('expected conflict card')
    renderWithProviders(<ConflictScrollCard item={item} />)

    const scroller = screen.getByTestId('conflict-job-scroll')
    expect(scroller.style.overflowX).toBe('auto')
    expect(scroller.style.overflowY).toBe('hidden')
    expect(
      screen.getByRole('link', { name: 'Open job Job A' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open job Job C' }),
    ).toBeInTheDocument()
  })

  it('labels group conflicts as equipment', () => {
    const group: GroupConflictRow = {
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
      start_1: '2026-01-01T08:00:00.000Z',
      end_1: '2026-01-01T18:00:00.000Z',
      start_2: '2026-01-01T10:00:00.000Z',
      end_2: '2026-01-01T20:00:00.000Z',
      forced_1: false,
      forced_2: false,
    }
    const item = buildConflictCards([], [], [], [group])[0]
    if (!item) throw new Error('expected conflict card')
    renderWithProviders(<ConflictScrollCard item={item} />)

    expect(screen.getByText('Unresolved · Equipment')).toBeInTheDocument()
    expect(screen.queryByText(/Group/)).not.toBeInTheDocument()
    expect(screen.getByText('Vocal package')).toBeInTheDocument()
  })
})
