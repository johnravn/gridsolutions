import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import TimeEntriesTable from './TimeEntriesTable'
import type { TimeEntryWithProfile } from '../api/timeEntries'

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
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
      scrollToIndex: vi.fn(),
    }
  },
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
      }),
    },
  },
}))

function entry(
  overrides: Partial<TimeEntryWithProfile> = {},
): TimeEntryWithProfile {
  return {
    id: 'entry-1',
    company_id: 'co-1',
    user_id: 'user-1',
    title: 'Logging',
    job_id: null,
    job_number: null,
    note: null,
    start_at: '2026-08-30T08:00:00.000Z',
    end_at: '2026-08-30T09:00:00.000Z',
    created_at: '2026-08-30T08:00:00.000Z',
    updated_at: '2026-08-30T08:00:00.000Z',
    profile: null,
    ...overrides,
  }
}

describe('TimeEntriesTable', () => {
  it('renders entry titles without leading-trim so descenders are not clipped', () => {
    renderWithProviders(
      <TimeEntriesTable
        entries={[entry({ title: 'Logging' })]}
        isLoading={false}
        showEmployeeColumn={false}
      />,
    )

    const title = screen.getByText('Logging')
    expect(title).toBeInTheDocument()
    expect(title.tagName).toBe('DIV')
    expect(title.className).not.toMatch(/rt-r-lt/)
    expect(title.className).toMatch(/rt-truncate/)
  })
})
