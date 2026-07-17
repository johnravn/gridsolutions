import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import DateTimeRangePicker from './DateTimeRangePicker'
import { atHour, atTime, endOfDay, startOfDay } from './dateTimeUtils'

describe('DateTimeRangePicker', () => {
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

  function openPicker() {
    fireEvent.click(screen.getByRole('button', { name: 'Select period' }))
  }

  function clickDay(localDate: string) {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: localDate,
      }),
    )
  }

  function switchPhase(phase: 'Dates' | 'Hours' | 'Minutes') {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: phase }),
    )
  }

  it('shows empty placeholder', () => {
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: 'Select period' }),
    ).toBeInTheDocument()
  })

  it('selects a single date with full-day defaults on one click', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-10'),
    })
  })

  it('shows same-day selection in trigger after one date click', () => {
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={vi.fn()} />,
    )
    openPicker()
    clickDay('2026-06-10')

    expect(screen.getAllByText('10. jun 2026')).toHaveLength(2)
    expect(screen.queryByText('Select end date')).toBeNull()
  })

  it('selects date range with full-day defaults', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    clickDay('2026-06-15')

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-15'),
    })
  })

  it('swaps dates when end is before start', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-20')
    clickDay('2026-06-10')

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-20'),
    })
  })

  it('selects hours on a single date with range-style clicks', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    fireEvent.click(dialog.getByRole('button', { name: '17' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 9),
      endAt: atHour('2026-06-10', 17),
    })
  })

  it('selects minutes on a single date', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    fireEvent.click(dialog.getByRole('button', { name: '17' }))

    switchPhase('Minutes')
    fireEvent.click(dialog.getByRole('button', { name: 'Start minute :15' }))
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(dialog.getByRole('button', { name: 'End minute :45' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atTime('2026-06-10', 9, 15),
      endAt: atTime('2026-06-10', 17, 45),
    })
  })

  it('swaps hours when end is before start on same day', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '14' }))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 9),
      endAt: atHour('2026-06-10', 14),
    })
  })

  it('bumps end time when same start and end hour would be zero duration', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atTime('2026-06-10', 9, 0),
      endAt: atTime('2026-06-10', 9, 5),
    })
  })

  it('does not allow selecting an end minute that equals start on same hour', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    switchPhase('Minutes')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'End 09:05 10. jun 2026',
      }),
    )

    expect(
      dialog.getByRole('button', { name: 'End minute :00' }),
    ).toBeDisabled()

    const callsBefore = onChange.mock.calls.length
    fireEvent.click(dialog.getByRole('button', { name: 'End minute :00' }))
    expect(onChange.mock.calls.length).toBe(callsBefore)
  })

  it('displays selected range in trigger', () => {
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={vi.fn()}
        locale="en"
      />,
    )
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('10. jun 2026')).toBeInTheDocument()
    expect(screen.getByText('15. jun 2026')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('17:00')).toBeInTheDocument()
  })

  it('updates closed trigger when controlled props are prefilled after mount', () => {
    const { rerender } = renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={vi.fn()} locale="en" />,
    )
    expect(screen.getByText('Select period')).toBeInTheDocument()

    rerender(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={vi.fn()}
        locale="en"
      />,
    )

    expect(screen.queryByText('Select period')).not.toBeInTheDocument()
    expect(screen.getByText('10. jun 2026')).toBeInTheDocument()
    expect(screen.getByText('15. jun 2026')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('17:00')).toBeInTheDocument()
  })

  it('shows all day when no hours selected', () => {
    renderWithProviders(
      <DateTimeRangePicker
        startAt={startOfDay('2026-06-10')}
        endAt={endOfDay('2026-06-15')}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getAllByText('All day')).toHaveLength(2)
  })

  it('supports per-minute precision when minuteStep is 1', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt=""
        endAt=""
        onChange={onChange}
        minuteStep={1}
      />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    fireEvent.click(dialog.getByRole('button', { name: '10' }))
    switchPhase('Minutes')
    fireEvent.click(dialog.getByRole('button', { name: 'Start minute :07' }))
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(dialog.getByRole('button', { name: 'End minute :23' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atTime('2026-06-10', 9, 7),
      endAt: atTime('2026-06-10', 10, 23),
    })
  })

  it('advances to end-day hour tab after picking start hour on multi-day range', async () => {
    function Harness() {
      const [startAt, setStartAt] = React.useState('')
      const [endAt, setEndAt] = React.useState('')
      return (
        <DateTimeRangePicker
          startAt={startAt}
          endAt={endAt}
          onChange={({ startAt: s, endAt: e }) => {
            setStartAt(s)
            setEndAt(e)
          }}
        />
      )
    }

    renderWithProviders(<Harness />)
    openPicker()
    clickDay('2026-06-10')
    clickDay('2026-06-15')
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'Start hour 09:00' }))

    expect(
      screen.getByRole('button', {
        name: 'Start 10. jun 2026 09:00',
        pressed: true,
      }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(
      dialog.getByRole('button', { name: 'End hour 00:00' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'End 15. jun 2026 All day',
        pressed: true,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2026-06-10' })).toBeNull()
  })

  it('advances to end minute tab after picking start minute on multi-day range', () => {
    function Harness() {
      const [startAt, setStartAt] = React.useState('')
      const [endAt, setEndAt] = React.useState('')
      return (
        <DateTimeRangePicker
          startAt={startAt}
          endAt={endAt}
          onChange={({ startAt: s, endAt: e }) => {
            setStartAt(s)
            setEndAt(e)
          }}
        />
      )
    }

    renderWithProviders(<Harness />)
    openPicker()
    clickDay('2026-06-10')
    clickDay('2026-06-15')
    switchPhase('Hours')
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'Start hour 09:00' }))
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(dialog.getByRole('button', { name: 'End hour 17:00' }))
    switchPhase('Minutes')

    fireEvent.click(dialog.getByRole('button', { name: 'Start minute :15' }))

    expect(
      screen.getByRole('button', {
        name: 'Start 10. jun 2026 09:15',
        pressed: true,
      }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(
      dialog.getByRole('button', { name: 'End minute :00' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'End 15. jun 2026 17:00',
        pressed: true,
      }),
    ).toBeInTheDocument()
  })
})
