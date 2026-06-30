import * as React from 'react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import DateTimePicker from './DateTimePicker'
import {
  formatDateLabel,
  formatTimeLabel,
} from './pickers/dateTimeUtils'

/** Mirror trigger label formatting (uses local timezone like the component). */
function triggerLabel(
  iso: string,
  locale: 'en' | 'nb' = 'en',
  dateOnly = false,
) {
  const date = new Date(iso)
  const datePart = formatDateLabel(date, locale)
  if (dateOnly) return datePart
  return `${datePart}, ${formatTimeLabel(date.getHours(), date.getMinutes())}`
}

type RenderOptions = {
  value?: string
  onChange?: Mock<(value: string) => void>
  label?: string
  placeholder?: string
  invalid?: boolean
  dateOnly?: boolean
  iconButton?: boolean
  locale?: 'en' | 'nb'
  disabled?: boolean
}

function renderDateTimePicker({
  value = '',
  onChange = vi.fn(),
  ...props
}: RenderOptions = {}) {
  return {
    onChange,
    ...renderWithProviders(
      <DateTimePicker value={value} onChange={onChange} {...props} />,
    ),
  }
}

function openPicker(triggerName: RegExp | string) {
  fireEvent.click(screen.getByRole('button', { name: triggerName }))
}

function getPopover() {
  return screen.getByRole('dialog')
}

function clickCalendarDay(localDate: string) {
  const popover = getPopover()
  fireEvent.click(within(popover).getByRole('button', { name: localDate }))
}

function switchToTimeTab() {
  fireEvent.click(within(getPopover()).getByRole('button', { name: 'Time' }))
}

function clickHour(hour: string) {
  const popover = getPopover()
  fireEvent.click(within(popover).getByRole('button', { name: hour }))
}

function clickMinute(minute: string) {
  const popover = getPopover()
  fireEvent.click(within(popover).getByRole('button', { name: minute }))
}

function openPickerForValue(
  iso: string,
  locale: 'en' | 'nb' = 'en',
  dateOnly = false,
) {
  openPicker(triggerLabel(iso, locale, dateOnly))
}

/** Local datetime string → ISO, matching the component's fromLocalInput helper. */
function localToIso(local: string) {
  return new Date(local).toISOString()
}

function localTimeFromIso(iso: string) {
  const date = new Date(iso)
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  }
}

describe('DateTimePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('trigger display', () => {
    it('shows default placeholder when value is empty', () => {
      renderDateTimePicker()
      expect(
        screen.getByRole('button', { name: 'Select date and time' }),
      ).toBeInTheDocument()
    })

    it('shows custom placeholder when provided', () => {
      renderDateTimePicker({ placeholder: 'Pick a slot' })
      expect(
        screen.getByRole('button', { name: 'Pick a slot' }),
      ).toBeInTheDocument()
    })

    it('shows date-only placeholder when dateOnly is true', () => {
      renderDateTimePicker({ dateOnly: true })
      expect(
        screen.getByRole('button', { name: 'Select date' }),
      ).toBeInTheDocument()
    })

    it('formats datetime value for en locale', () => {
      const value = '2026-05-15T10:30:00.000Z'
      renderDateTimePicker({
        value,
        locale: 'en',
      })
      expect(
        screen.getByRole('button', { name: triggerLabel(value, 'en') }),
      ).toBeInTheDocument()
    })

    it('formats datetime value for nb locale', () => {
      const value = '2026-05-15T10:30:00.000Z'
      renderDateTimePicker({
        value,
        locale: 'nb',
      })
      expect(
        screen.getByRole('button', { name: triggerLabel(value, 'nb') }),
      ).toBeInTheDocument()
    })

    it('uses Norwegian month names okt and des in nb locale', () => {
      const octValue = '2026-10-15T10:30:00.000Z'
      const decValue = '2026-12-15T10:30:00.000Z'
      const { rerender } = renderWithProviders(
        <DateTimePicker
          value={octValue}
          onChange={vi.fn()}
          locale="nb"
        />,
      )
      expect(
        screen.getByRole('button', { name: triggerLabel(octValue, 'nb') }),
      ).toBeInTheDocument()

      rerender(
        <DateTimePicker
          value={decValue}
          onChange={vi.fn()}
          locale="nb"
        />,
      )
      expect(
        screen.getByRole('button', { name: triggerLabel(decValue, 'nb') }),
      ).toBeInTheDocument()
    })

    it('shows date without time when dateOnly is true', () => {
      const value = '2026-05-15T10:30:00.000Z'
      renderDateTimePicker({
        value,
        dateOnly: true,
      })
      expect(
        screen.getByRole('button', { name: triggerLabel(value, 'en', true) }),
      ).toBeInTheDocument()
    })

    it('renders label when provided and not in iconButton mode', () => {
      renderDateTimePicker({ label: 'Start time' })
      expect(screen.getByText('Start time')).toBeInTheDocument()
    })

    it('does not render label in iconButton mode', () => {
      renderDateTimePicker({ label: 'Start time', iconButton: true })
      expect(screen.queryByText('Start time')).not.toBeInTheDocument()
    })

    it('falls back to placeholder for invalid ISO values without crashing', () => {
      expect(() => renderDateTimePicker({ value: 'not-a-date' })).not.toThrow()

      expect(
        screen.getByRole('button', { name: 'Select date and time' }),
      ).toBeInTheDocument()
    })

    it('disables the trigger when disabled', () => {
      renderDateTimePicker({ disabled: true })
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('popover structure', () => {
    it('shows Date and Time tabs in datetime mode', () => {
      renderDateTimePicker()
      openPicker('Select date and time')

      const popover = getPopover()
      expect(
        within(popover).getByRole('button', { name: 'Date' }),
      ).toBeInTheDocument()
      expect(
        within(popover).getByRole('button', { name: 'Time' }),
      ).toBeInTheDocument()
    })

    it('hides Time tab in dateOnly mode', () => {
      renderDateTimePicker({ dateOnly: true })
      openPicker('Select date')

      const popover = getPopover()
      expect(within(popover).queryByRole('button', { name: 'Time' })).toBeNull()
      expect(screen.getByText('Mo')).toBeInTheDocument()
    })
  })

  describe('date selection', () => {
    it('selects a date with default 09:00 when no prior value exists', () => {
      const onChange = vi.fn()
      renderDateTimePicker({ onChange })

      openPicker('Select date and time')
      clickCalendarDay('2026-06-15')

      expect(onChange).toHaveBeenCalledWith(localToIso('2026-06-15T09:00'))
    })

    it('preserves existing time when selecting a new date', () => {
      const value = '2026-06-10T14:35:00.000Z'
      const onChange = vi.fn()
      renderDateTimePicker({
        value,
        onChange,
      })

      openPickerForValue(value)
      clickCalendarDay('2026-06-20')

      const { hours, minutes } = localTimeFromIso(value)
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      expect(onChange).toHaveBeenCalledWith(localToIso(`2026-06-20T${timeStr}`))
    })

    it('switches to the Time tab after selecting a date in datetime mode', () => {
      renderDateTimePicker()
      openPicker('Select date and time')
      clickCalendarDay('2026-06-15')

      const popover = getPopover()
      expect(within(popover).getByText('Hour')).toBeInTheDocument()
    })

    it('selects midnight and closes popover in dateOnly mode', () => {
      const onChange = vi.fn()
      renderDateTimePicker({ dateOnly: true, onChange })

      openPicker('Select date')
      clickCalendarDay('2026-06-15')

      expect(onChange).toHaveBeenCalledWith(localToIso('2026-06-15T00:00'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('time selection', () => {
    it('updates hour while keeping the selected date', () => {
      const value = '2026-06-10T09:00:00.000Z'
      const onChange = vi.fn()
      renderDateTimePicker({
        value,
        onChange,
      })

      openPickerForValue(value)
      switchToTimeTab()
      clickHour('14')

      expect(onChange).toHaveBeenCalledWith(localToIso('2026-06-10T14:00'))
    })

    it('updates minute in 5-minute increments', () => {
      const value = '2026-06-10T14:00:00.000Z'
      const onChange = vi.fn()
      renderDateTimePicker({
        value,
        onChange,
      })

      openPickerForValue(value)
      switchToTimeTab()
      clickMinute(':30')

      const { hours } = localTimeFromIso(value)
      const timeStr = `${String(hours).padStart(2, '0')}:30`
      expect(onChange).toHaveBeenCalledWith(localToIso(`2026-06-10T${timeStr}`))
    })

    it('uses today as the date when changing hour without a selected date', () => {
      const onChange = vi.fn()
      renderDateTimePicker({ onChange })

      openPicker('Select date and time')
      switchToTimeTab()
      clickHour('16')

      expect(onChange).toHaveBeenCalledWith(localToIso('2026-06-01T16:00'))
    })

    it('uses today as the date when changing minute without a selected date', () => {
      const onChange = vi.fn()
      renderDateTimePicker({ onChange })

      openPicker('Select date and time')
      switchToTimeTab()
      clickMinute(':45')

      expect(onChange).toHaveBeenCalledWith(localToIso('2026-06-01T09:45'))
    })
  })

  describe('year navigation', () => {
    it('opens year picker and changes the visible calendar year', () => {
      const value = '2026-06-10T09:00:00.000Z'
      renderDateTimePicker({
        value,
      })

      openPickerForValue(value)
      fireEvent.click(
        within(getPopover()).getByRole('button', { name: '2026' }),
      )

      expect(screen.getByText('Select Year')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '2024' }))

      expect(
        within(getPopover()).getByRole('button', { name: '2024' }),
      ).toBeInTheDocument()
      expect(screen.getByText('June')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('does not call onChange when disabled', () => {
      const onChange = vi.fn()
      renderDateTimePicker({ disabled: true, onChange })

      fireEvent.click(screen.getByRole('button'))
      expect(onChange).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('value sync', () => {
    it('updates displayed value when parent changes value prop', () => {
      const initialValue = '2026-06-10T09:00:00.000Z'
      const updatedValue = '2026-07-20T16:45:00.000Z'

      function Harness() {
        const [value, setValue] = React.useState(initialValue)
        return (
          <>
            <button
              type="button"
              onClick={() => setValue(updatedValue)}
            >
              Update value
            </button>
            <DateTimePicker value={value} onChange={vi.fn()} />
          </>
        )
      }

      renderWithProviders(<Harness />)

      expect(
        screen.getByRole('button', { name: triggerLabel(initialValue) }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Update value' }))

      expect(
        screen.getByRole('button', { name: triggerLabel(updatedValue) }),
      ).toBeInTheDocument()
    })
  })
})
