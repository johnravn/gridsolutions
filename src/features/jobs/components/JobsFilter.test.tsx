import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { renderWithProviders } from '@test/render'
import JobsFilter, { ALL_STATUSES, DEFAULT_STATUS_FILTER } from './JobsFilter'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const noop = () => undefined

function renderFilter(
  overrides: Partial<ComponentProps<typeof JobsFilter>> = {},
) {
  const onShowMyJobsOnlyChange = vi.fn()
  const onPeriodChange = vi.fn()
  const onStatusFilterChange = vi.fn()
  const onShowOnlyArchivedChange = vi.fn()
  const onShowJobsInRecurringSeriesChange = vi.fn()
  renderWithProviders(
    <JobsFilter
      statusFilter={[...DEFAULT_STATUS_FILTER]}
      onStatusFilterChange={onStatusFilterChange}
      showOnlyArchived={false}
      onShowOnlyArchivedChange={onShowOnlyArchivedChange}
      showJobsInRecurringSeries={false}
      onShowJobsInRecurringSeriesChange={onShowJobsInRecurringSeriesChange}
      showMyJobsOnly={false}
      onShowMyJobsOnlyChange={onShowMyJobsOnlyChange}
      canFilterMyJobs
      dateFrom=""
      dateTo=""
      onPeriodChange={onPeriodChange}
      {...overrides}
    />,
  )
  return {
    onShowMyJobsOnlyChange,
    onPeriodChange,
    onStatusFilterChange,
    onShowOnlyArchivedChange,
    onShowJobsInRecurringSeriesChange,
  }
}

describe('JobsFilter', () => {
  it('toggles My jobs for staff', async () => {
    const user = userEvent.setup()
    const { onShowMyJobsOnlyChange } = renderFilter()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('switch', { name: 'My jobs' }))
    expect(onShowMyJobsOnlyChange).toHaveBeenCalledWith(true)
  })

  it('hides My jobs for freelancers', async () => {
    const user = userEvent.setup()
    renderFilter({ canFilterMyJobs: false, onShowMyJobsOnlyChange: noop })

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(
      screen.queryByRole('switch', { name: 'My jobs' }),
    ).not.toBeInTheDocument()
  })

  it('applies a date preset', async () => {
    const user = userEvent.setup()
    const { onPeriodChange } = renderFilter()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'This week' }))
    expect(onPeriodChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
  })

  it('applies the past preset with no start date', async () => {
    const user = userEvent.setup()
    const { onPeriodChange } = renderFilter()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Past' }))
    expect(onPeriodChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '',
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
  })

  it('applies the current year when Year is chosen', async () => {
    const user = userEvent.setup()
    const { onPeriodChange } = renderFilter()
    const year = new Date().getFullYear()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect(onPeriodChange).toHaveBeenCalledWith({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    })
    expect(screen.getByRole('combobox', { name: 'Filter year' })).toBeVisible()
  })

  it('resets dates, my jobs, series, and statuses', async () => {
    const user = userEvent.setup()
    const {
      onShowMyJobsOnlyChange,
      onPeriodChange,
      onStatusFilterChange,
      onShowOnlyArchivedChange,
      onShowJobsInRecurringSeriesChange,
    } = renderFilter({
      showMyJobsOnly: true,
      showOnlyArchived: true,
      showJobsInRecurringSeries: true,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-07',
    })

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onShowMyJobsOnlyChange).toHaveBeenCalledWith(false)
    expect(onShowOnlyArchivedChange).toHaveBeenCalledWith(false)
    expect(onShowJobsInRecurringSeriesChange).toHaveBeenCalledWith(false)
    expect(onPeriodChange).toHaveBeenCalledWith({ startDate: '', endDate: '' })
    expect(onStatusFilterChange).toHaveBeenCalledWith([
      ...DEFAULT_STATUS_FILTER,
    ])
  })

  it('selects all statuses from the All shortcut', async () => {
    const user = userEvent.setup()
    const { onStatusFilterChange } = renderFilter()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(onStatusFilterChange).toHaveBeenCalledWith([...ALL_STATUSES])
    expect(screen.queryByText(/Active only/i)).not.toBeInTheDocument()
  })
})
