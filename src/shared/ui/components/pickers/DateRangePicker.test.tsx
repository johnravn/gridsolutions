import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import DateRangePicker from './DateRangePicker'

describe('DateRangePicker', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'UTC'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('selects a period with two clicks and closes', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateRangePicker startDate="" endDate="" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Select period' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '2026-06-10' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: '2026-06-15' }))
    expect(onChange).toHaveBeenCalledWith({
      startDate: '2026-06-10',
      endDate: '2026-06-15',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('allows a single-day period', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateRangePicker startDate="" endDate="" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Select period' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '2026-06-12' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '2026-06-12' }))
    expect(onChange).toHaveBeenCalledWith({
      startDate: '2026-06-12',
      endDate: '2026-06-12',
    })
  })

  it('formats an active period on the trigger', () => {
    renderWithProviders(
      <DateRangePicker
        startDate="2026-05-10"
        endDate="2026-05-15"
        onChange={vi.fn()}
        locale="en"
      />,
    )
    expect(
      screen.getByRole('button', { name: '10. may 2026 – 15. may 2026' }),
    ).toBeInTheDocument()
  })

  it('shows a clearable period chip in iconButton mode', () => {
    const onClear = vi.fn()
    renderWithProviders(
      <DateRangePicker
        startDate="2026-05-10"
        endDate="2026-05-15"
        onChange={vi.fn()}
        onClear={onClear}
        iconButton
        locale="en"
      />,
    )
    expect(
      screen.getByRole('button', { name: '10. may 2026 – 15. may 2026' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear period filter' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
