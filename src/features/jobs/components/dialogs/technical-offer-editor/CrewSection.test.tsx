import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { CrewSection } from './CrewSection'
import type { LocalCrewItem } from './types'

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

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString()
}

describe('CrewSection', () => {
  it('renders crew heading and add crew item button', () => {
    renderWithProviders(
      <CrewSection items={[]} onItemsChange={vi.fn()} companyId="company-1" />,
    )

    expect(screen.getByRole('heading', { name: 'Crew' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Add Crew Item/i }),
    ).toBeInTheDocument()
  })

  it('adds a crew item when Add Crew Item is clicked', () => {
    const onItemsChange = vi.fn()

    renderWithProviders(
      <CrewSection
        items={[]}
        onItemsChange={onItemsChange}
        companyId="company-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add Crew Item/i }))
    expect(onItemsChange).toHaveBeenCalled()
    expect(onItemsChange.mock.calls[0][0]).toHaveLength(1)
  })

  it('defaults new hourly crew to 8 hours per day on a date-only job window', () => {
    const onItemsChange = vi.fn()

    renderWithProviders(
      <CrewSection
        items={[]}
        onItemsChange={onItemsChange}
        companyId="company-1"
        jobStartAt={localIso(2026, 5, 1)}
        jobEndAt={localIso(2026, 5, 3)}
        defaultBillingUnit="hour"
        defaultRatePerHour={400}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add Crew Item/i }))
    const added = onItemsChange.mock.calls[0][0][0] as LocalCrewItem
    expect(added.billing_type).toBe('hourly')
    expect(added.hours_per_day).toBe(8)
    expect(added.daily_rate).toBe(3200)
  })

  it('defaults new hourly crew from the job start and end times', () => {
    const onItemsChange = vi.fn()

    renderWithProviders(
      <CrewSection
        items={[]}
        onItemsChange={onItemsChange}
        companyId="company-1"
        jobStartAt={localIso(2026, 5, 1, 8, 0)}
        jobEndAt={localIso(2026, 5, 1, 18, 0)}
        defaultBillingUnit="hour"
        defaultRatePerHour={500}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add Crew Item/i }))
    const added = onItemsChange.mock.calls[0][0][0] as LocalCrewItem
    expect(added.hours_per_day).toBe(10)
    expect(added.daily_rate).toBe(5000)
  })

  it('lets the user edit hours per day on an hourly crew item', () => {
    const onItemsChange = vi.fn()
    const item: LocalCrewItem = {
      id: 'c1',
      role_title: 'FOH',
      crew_count: 1,
      start_date: localIso(2026, 5, 1),
      end_date: localIso(2026, 5, 2),
      daily_rate: 4000,
      hourly_rate: 500,
      hours_per_day: 8,
      billing_type: 'hourly',
      sort_order: 0,
    }

    renderWithProviders(
      <CrewSection
        items={[item]}
        onItemsChange={onItemsChange}
        companyId="company-1"
      />,
    )

    fireEvent.click(screen.getByText('FOH'))
    expect(screen.getByText('Start and end')).toBeInTheDocument()
    const hoursField = screen.getByLabelText('Hours per Day')
    fireEvent.change(hoursField, { target: { value: '10' } })

    expect(onItemsChange).toHaveBeenCalled()
    const updated = onItemsChange.mock.calls.at(-1)?.[0][0] as LocalCrewItem
    expect(updated.hours_per_day).toBe(10)
    expect(updated.daily_rate).toBe(5000)
  })
})
