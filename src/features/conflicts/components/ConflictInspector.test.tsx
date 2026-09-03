import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import ConflictInspector from './ConflictInspector'
import { buildConflictCards } from '../utils/conflictItems'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
} from '../api/queries'
import type { ReactNode } from 'react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    search,
    ...props
  }: {
    children: ReactNode
    search?: { jobId?: string; tab?: string }
  }) => (
    <a
      href={`/jobs?jobId=${search?.jobId ?? ''}&tab=${search?.tab ?? ''}`}
      {...props}
    >
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

describe('ConflictInspector', () => {
  it('shows both jobs, overlap hours, and clickable booking links', () => {
    const item = buildConflictCards([crew], [], [], [])[0]
    renderWithProviders(<ConflictInspector item={item ?? null} />)

    expect(screen.getByText('Unresolved · Crew')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Job A')).toBeInTheDocument()
    expect(screen.getByText('Job B')).toBeInTheDocument()
    expect(screen.getByText('8 hours')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Job A' })).toHaveAttribute(
      'href',
      '/jobs?jobId=j1&tab=bookings',
    )
    expect(screen.getByRole('link', { name: 'Open Job B' })).toHaveAttribute(
      'href',
      '/jobs?jobId=j2&tab=bookings',
    )
    expect(
      screen.queryByRole('link', { name: 'Open job Job A' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^Open Job A$/)).not.toBeInTheDocument()
  })

  it('names a personal booking and only links jobs that exist', () => {
    const item = buildConflictCards(
      [{ ...crew, job_id_2: null, job_title_2: null }],
      [],
      [],
      [],
    )[0]
    renderWithProviders(<ConflictInspector item={item ?? null} />)

    expect(screen.getByText('a personal booking')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Job A' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Open a personal booking' }),
    ).not.toBeInTheDocument()
  })

  it('lists every equipment job as a bookings-tab link', () => {
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
    renderWithProviders(<ConflictInspector item={item ?? null} />)

    expect(screen.getByText('12 reserved / 8 available')).toBeInTheDocument()
    expect(screen.getByText('Job A')).toBeInTheDocument()
    expect(screen.getByText('Job B')).toBeInTheDocument()
    expect(screen.getByText('Job C')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Job C' })).toHaveAttribute(
      'href',
      '/jobs?jobId=j3&tab=bookings',
    )
    expect(screen.queryByText(/^Open Job C$/)).not.toBeInTheDocument()
  })

  it('labels group conflicts as equipment and links their jobs', () => {
    const item = buildConflictCards([], [], [], [group])[0]
    renderWithProviders(<ConflictInspector item={item ?? null} />)

    expect(screen.getByText('Unresolved · Equipment')).toBeInTheDocument()
    expect(screen.queryByText(/Group/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Job A' })).toHaveAttribute(
      'href',
      '/jobs?jobId=j1&tab=bookings',
    )
  })

  it('asks the user to select a conflict when none is chosen', () => {
    renderWithProviders(<ConflictInspector item={null} />)
    expect(
      screen.getByText('Select a conflict to see details.'),
    ).toBeInTheDocument()
  })
})
