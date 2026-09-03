import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@test/render'
import ConflictsList from './ConflictsList'
import { buildConflictCards } from '../utils/conflictItems'
import type { CrewConflictRow, VehicleConflictRow } from '../api/queries'

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number
    estimateSize: () => number
  }) => {
    const size = estimateSize()
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          start: index * size,
          size,
          key: String(index),
        })),
      getTotalSize: () => count * size,
    }
  },
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

const vehicle: VehicleConflictRow = {
  vehicle_id: 'v1',
  vehicle_name: 'Van',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j3',
  job_id_2: 'j4',
  job_title_1: 'Job C',
  job_title_2: 'Job D',
  start_1: '2026-01-01T08:00:00.000Z',
  end_1: '2026-01-01T18:00:00.000Z',
  start_2: '2026-01-01T10:00:00.000Z',
  end_2: '2026-01-01T20:00:00.000Z',
  forced_1: false,
  forced_2: false,
}

describe('ConflictsList', () => {
  it('shows an empty state', () => {
    renderWithProviders(
      <ConflictsList
        items={[]}
        selectedId={null}
        onSelect={() => undefined}
        loading={false}
      />,
    )
    expect(screen.getByText('No booking conflicts.')).toBeInTheDocument()
    expect(screen.queryByText('1 conflict')).not.toBeInTheDocument()
  })

  it('selects a conflict row and shows the filtered count', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const items = buildConflictCards([crew], [], [], [])
    renderWithProviders(
      <ConflictsList
        items={items}
        selectedId={null}
        onSelect={onSelect}
        loading={false}
      />,
    )

    expect(screen.getByText('Unresolved · Crew')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Job A and Job B')).toBeInTheDocument()
    expect(screen.getByText('1 conflict')).toBeInTheDocument()
    await user.click(screen.getByText('Anna'))
    expect(onSelect).toHaveBeenCalledWith(items[0]?.key)
  })

  it('shows a project-lead badge when a job is in the PL set', () => {
    const items = buildConflictCards([crew], [vehicle], [], [])
    renderWithProviders(
      <ConflictsList
        items={items}
        selectedId={null}
        onSelect={() => undefined}
        loading={false}
        projectLeadJobIds={['j1']}
      />,
    )

    expect(screen.getByText('2 conflicts')).toBeInTheDocument()
    expect(screen.getByText('Project lead')).toBeInTheDocument()
    expect(
      screen.getByText('Anna').closest('[role="button"]'),
    ).toHaveTextContent('Project lead')
    expect(
      screen.getByText('Van').closest('[role="button"]'),
    ).not.toHaveTextContent('Project lead')
  })
})
