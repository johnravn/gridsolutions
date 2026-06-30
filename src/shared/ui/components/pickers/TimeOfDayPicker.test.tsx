import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import TimeOfDayPicker from './TimeOfDayPicker'
import { atHour } from './dateTimeUtils'

describe('TimeOfDayPicker', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'UTC'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
  })

  it('shows placeholder when empty', () => {
    renderWithProviders(<TimeOfDayPicker value={null} onChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Select time' }),
    ).toBeInTheDocument()
  })

  it('selects hour and closes', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TimeOfDayPicker
        value={null}
        onChange={onChange}
        referenceDate="2026-06-15"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Select time' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Hour 14:00',
      }),
    )
    expect(onChange).toHaveBeenCalledWith(atHour('2026-06-15', 14))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('displays selected hour', () => {
    renderWithProviders(
      <TimeOfDayPicker value={atHour('2026-06-15', 9)} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument()
  })
})
