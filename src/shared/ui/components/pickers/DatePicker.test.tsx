import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import DatePicker from './DatePicker'

function localToIso(local: string) {
  return new Date(local).toISOString()
}

describe('DatePicker', () => {
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

  it('shows placeholder when empty', () => {
    renderWithProviders(<DatePicker value="" onChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Select date' }),
    ).toBeInTheDocument()
  })

  it('formats selected date', () => {
    renderWithProviders(
      <DatePicker
        value="2026-05-15T00:00:00.000Z"
        onChange={vi.fn()}
        locale="nb"
      />,
    )
    expect(
      screen.getByRole('button', { name: '15. mai 2026' }),
    ).toBeInTheDocument()
  })

  it('selects date and closes popover', () => {
    const onChange = vi.fn()
    renderWithProviders(<DatePicker value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select date' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '2026-06-15',
      }),
    )
    expect(onChange).toHaveBeenCalledWith(localToIso('2026-06-15T00:00'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not crash on invalid ISO', () => {
    expect(() =>
      renderWithProviders(<DatePicker value="not-a-date" onChange={vi.fn()} />),
    ).not.toThrow()
    expect(
      screen.getByRole('button', { name: 'Select date' }),
    ).toBeInTheDocument()
  })
})
