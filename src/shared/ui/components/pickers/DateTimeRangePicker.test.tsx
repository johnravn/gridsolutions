import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import DateTimeRangePicker from './DateTimeRangePicker'
import { atHour, atTime, endOfDay, startOfDay } from './dateTimeUtils'

describe('DateTimeRangePicker', () => {
  const originalTz = process.env.TZ

  function setWideViewport(wide: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('min-width: 769px') ? wide : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }

  beforeEach(() => {
    process.env.TZ = 'UTC'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
    Element.prototype.scrollIntoView = vi.fn()
    setWideViewport(true)
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
    // Next pick is end (SAS alternate) — hint advances after the start click.
    expect(screen.getByText('Select end date')).toBeInTheDocument()
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
      <DateTimeRangePicker
        startAt=""
        endAt=""
        onChange={vi.fn()}
        locale="en"
      />,
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

  function clickStartField() {
    fireEvent.click(
      screen.getByRole('button', {
        name: /^Start (?:\d|All day)/,
      }),
    )
  }

  function clickEndField() {
    fireEvent.click(
      screen.getByRole('button', {
        name: /^End (?:\d|All day|Open-ended)/,
      }),
    )
  }

  it('opens from a closed trigger when Start is clicked and targets start date', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={onChange}
      />,
    )

    clickStartField()

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Select start date')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Start 10. jun 2026 09:00',
        pressed: true,
      }),
    ).toBeInTheDocument()

    fireEvent.click(dialog.getByRole('button', { name: '2026-06-08' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-08', 9),
      endAt: atHour('2026-06-15', 17),
    })
  })

  it('opens from a closed trigger when End is clicked and targets end date', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={onChange}
      />,
    )

    clickEndField()

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Select end date')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'End 15. jun 2026 17:00',
        pressed: true,
      }),
    ).toBeInTheDocument()

    fireEvent.click(dialog.getByRole('button', { name: '2026-06-20' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 9),
      endAt: atHour('2026-06-20', 17),
    })
  })

  it('alternates start then end without re-clicking the trigger (SAS-style)', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Select start date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-10' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-10'),
    })

    expect(dialog.getByText('Select end date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-15' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-15'),
    })

    // Third click starts a new cycle on start
    expect(dialog.getByText('Select start date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-20' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-20'),
      endAt: endOfDay('2026-06-20'),
    })
  })

  it('after pinning Start and picking, next calendar click sets End', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={onChange}
      />,
    )

    clickStartField()
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-08' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-08', 9),
      endAt: atHour('2026-06-15', 17),
    })

    expect(dialog.getByText('Select end date')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /End 15\. jun 2026/,
        pressed: true,
      }),
    ).toBeInTheDocument()

    fireEvent.click(dialog.getByRole('button', { name: '2026-06-18' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-08', 9),
      endAt: atHour('2026-06-18', 17),
    })
  })

  it('lets the user change only the end hour after targeting End then Hours', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-10', 17)}
        onChange={onChange}
      />,
    )
    clickEndField()
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('button', { name: 'End hour 17:00' }),
    ).toBeInTheDocument()

    fireEvent.click(dialog.getByRole('button', { name: 'End hour 18:00' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 9),
      endAt: atHour('2026-06-10', 18),
    })
  })

  it('lets the user set only the end hour on an all-day range', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={startOfDay('2026-06-10')}
        endAt={endOfDay('2026-06-10')}
        onChange={onChange}
      />,
    )
    clickEndField()
    switchPhase('Hours')

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'End hour 17:00' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: atHour('2026-06-10', 17),
    })
  })

  it('changes only the end date in dateOnly mode when End is targeted', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        dateOnly
        startAt={startOfDay('2026-06-10')}
        endAt={endOfDay('2026-06-15')}
        onChange={onChange}
      />,
    )
    clickEndField()

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-20' }))

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-20'),
    })
  })

  it('keeps an optional end empty until the user picks one', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        dateOnly
        optionalEnd
        startAt={startOfDay('2026-06-10')}
        endAt=""
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Open-ended')).toBeInTheDocument()

    clickEndField()
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '2026-06-20',
      }),
    )

    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-20'),
    })
  })

  it('renders an inline one-line trigger', () => {
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atTime('2026-06-10', 8, 0)}
        endAt={atTime('2026-06-12', 18, 0)}
        onChange={vi.fn()}
        inline
      />,
    )

    const trigger = screen.getByRole('group', { name: 'Select period' })
    expect(trigger).toHaveTextContent('Start')
    expect(trigger).toHaveTextContent('End')
    expect(trigger).toHaveTextContent('10. jun 2026')
    expect(trigger).toHaveTextContent('12. jun 2026')
    expect(trigger).toHaveStyle({ height: 'var(--space-6)' })
    expect(screen.getByRole('button', { name: /^Start / })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^End / })).toBeInTheDocument()
  })

  it('keeps the stacked trigger on small screens when inline is set', () => {
    setWideViewport(false)
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atTime('2026-06-10', 8, 0)}
        endAt={atTime('2026-06-12', 18, 0)}
        onChange={vi.fn()}
        inline
      />,
    )

    const trigger = screen.getByRole('group', { name: 'Select period' })
    expect(trigger).toHaveStyle({ minHeight: '78px' })
    expect(trigger).not.toHaveStyle({ height: 'var(--space-6)' })
  })

  it('dateOnly unpinned alternate sets start then end', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker dateOnly startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-10' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-10'),
    })
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-14' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-14'),
    })
  })

  it('dateOnly pin Start then next click sets End', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        dateOnly
        startAt={startOfDay('2026-06-10')}
        endAt={endOfDay('2026-06-15')}
        onChange={onChange}
      />,
    )
    clickStartField()
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-08' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-08'),
      endAt: endOfDay('2026-06-15'),
    })
    expect(dialog.getByText('Select end date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-20' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-08'),
      endAt: endOfDay('2026-06-20'),
    })
  })

  it('optionalEnd alternate leaves end open until second click', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        dateOnly
        optionalEnd
        startAt=""
        endAt=""
        onChange={onChange}
      />,
    )
    openPicker()
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-10' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: '',
    })
    expect(screen.getByText('Open-ended')).toBeInTheDocument()
    expect(dialog.getByText('Select end date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-18' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-10'),
      endAt: endOfDay('2026-06-18'),
    })
  })

  it('inline trigger pin End then alternate sets Start on next click', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        inline
        startAt={atHour('2026-06-10', 8)}
        endAt={atHour('2026-06-12', 18)}
        onChange={onChange}
      />,
    )
    clickEndField()
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Select end date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-14' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 8),
      endAt: atHour('2026-06-14', 18),
    })
    expect(dialog.getByText('Select start date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-09' }))
    // Unpinned cycle start resets the period to the new start day.
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: startOfDay('2026-06-09'),
      endAt: endOfDay('2026-06-09'),
    })
  })

  it('re-pinning Start while open keeps refining start until pick advances', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={onChange}
      />,
    )
    clickStartField()
    const dialog = within(screen.getByRole('dialog'))
    // Still pinned: click Start again (noop retarget), then pick
    clickStartField()
    expect(dialog.getByText('Select start date')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '2026-06-11' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-11', 9),
      endAt: atHour('2026-06-15', 17),
    })
    expect(dialog.getByText('Select end date')).toBeInTheDocument()
  })

  it('hours phase after pinning Start edits start hour then can switch via End', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={onChange}
      />,
    )
    clickStartField()
    switchPhase('Hours')
    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('button', { name: 'Start hour 09:00' }),
    ).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Start hour 10:00' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 10),
      endAt: atHour('2026-06-15', 17),
    })
    clickEndField()
    expect(
      dialog.getByRole('button', { name: 'End hour 17:00' }),
    ).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'End hour 19:00' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 10),
      endAt: atHour('2026-06-15', 19),
    })
  })

  it('stays on Hours when clicking Start in the trigger while on End hours', () => {
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={vi.fn()}
      />,
    )
    clickEndField()
    switchPhase('Hours')
    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('button', { name: 'End hour 17:00' }),
    ).toBeInTheDocument()

    clickStartField()

    expect(
      dialog.getByRole('button', { name: 'Start hour 09:00' }),
    ).toBeInTheDocument()
    expect(dialog.queryByText('Select start date')).toBeNull()
    expect(dialog.queryByRole('button', { name: '2026-06-10' })).toBeNull()
  })

  it('GRI-46: End Hours → Start keeps Hours after dismiss+reopen race', () => {
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atHour('2026-06-10', 9)}
        endAt={atHour('2026-06-15', 17)}
        onChange={vi.fn()}
      />,
    )
    clickEndField()
    switchPhase('Hours')
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'End hour 17:00',
      }),
    ).toBeInTheDocument()

    const startBtn = screen.getByRole('button', { name: /^Start / })
    // John's path: pointerdown on Start can dismiss the popover, then click
    // reopens — must resume Hours for Start, not snap to Dates.
    fireEvent.pointerDown(startBtn)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(startBtn)

    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('button', { name: 'Start hour 09:00' }),
    ).toBeInTheDocument()
    expect(dialog.queryByText('Select start date')).toBeNull()
    expect(dialog.queryByRole('button', { name: '2026-06-10' })).toBeNull()
  })

  it('stays on Minutes when clicking End in the trigger while on Start minutes', () => {
    renderWithProviders(
      <DateTimeRangePicker
        startAt={atTime('2026-06-10', 9, 15)}
        endAt={atTime('2026-06-15', 17, 0)}
        onChange={vi.fn()}
      />,
    )
    clickStartField()
    switchPhase('Hours')
    switchPhase('Minutes')
    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('button', { name: 'Start minute :15' }),
    ).toBeInTheDocument()

    clickEndField()

    expect(
      dialog.getByRole('button', { name: 'End minute :00' }),
    ).toBeInTheDocument()
    expect(dialog.queryByText('Select end date')).toBeNull()
    expect(dialog.queryByRole('button', { name: '2026-06-15' })).toBeNull()
  })

  it('same-day hours still use range hour grid when opened empty', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DateTimeRangePicker startAt="" endAt="" onChange={onChange} />,
    )
    openPicker()
    clickDay('2026-06-10')
    switchPhase('Hours')
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Select start and end hour')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '09' }))
    fireEvent.click(dialog.getByRole('button', { name: '17' }))
    expect(onChange).toHaveBeenLastCalledWith({
      startAt: atHour('2026-06-10', 9),
      endAt: atHour('2026-06-10', 17),
    })
  })
})
