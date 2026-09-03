import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { JobOverlapPair, ConflictJobButtonList } from './JobOverlapPair'
import type { ReactNode } from 'react'

vi.mock('@tanstack/react-router', () => ({
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

const formatPeriod = (start: string, end: string) => `${start}–${end}`

describe('JobOverlapPair', () => {
  it('shows both jobs as buttons', () => {
    renderWithProviders(
      <JobOverlapPair
        linkJobs
        formatPeriod={formatPeriod}
        row={{
          job_id_1: 'j1',
          job_id_2: 'j2',
          job_title_1: 'MER gameshow Ålesund',
          job_title_2: 'Other job',
          start_1: 'Fri',
          end_1: '20:00',
          start_2: 'Sat',
          end_2: '22:00',
        }}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Open job MER gameshow Ålesund' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open job Other job' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('and')).not.toBeInTheDocument()
    expect(screen.getByText('MER gameshow Ålesund')).toBeInTheDocument()
    expect(screen.getByText('Other job')).toBeInTheDocument()
  })

  it('names a personal booking instead of leaving an empty and', () => {
    renderWithProviders(
      <JobOverlapPair
        linkJobs
        formatPeriod={formatPeriod}
        row={{
          job_id_1: 'j1',
          job_id_2: null,
          job_title_1: 'MER gameshow Ålesund',
          job_title_2: null,
          start_1: 'Fri',
          end_1: '20:00',
          start_2: 'Sat',
          end_2: '22:00',
        }}
      />,
    )

    expect(screen.getByText('MER gameshow Ålesund')).toBeInTheDocument()
    expect(screen.getByText('a personal booking')).toBeInTheDocument()
    expect(screen.getByText('Sat–22:00')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Open job a personal booking' }),
    ).not.toBeInTheDocument()
  })
})

describe('ConflictJobButtonList', () => {
  it('lists more than two jobs in a horizontal scroll row', () => {
    renderWithProviders(
      <ConflictJobButtonList
        jobs={[
          { jobId: 'j1', title: 'Job A', period: 'Mon' },
          { jobId: 'j2', title: 'Job B', period: 'Tue' },
          { jobId: 'j3', title: 'Job C', period: 'Wed' },
        ]}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Open job Job A' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open job Job B' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open job Job C' }),
    ).toBeInTheDocument()
    const scroller = screen.getByTestId('conflict-job-scroll')
    expect(scroller.style.overflowX).toBe('auto')
    expect(scroller.style.overflowY).toBe('hidden')
  })
})
