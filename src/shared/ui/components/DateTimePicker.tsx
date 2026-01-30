import * as React from 'react'
import { Box, Flex, IconButton, Popover, Text } from '@radix-ui/themes'
import { Calendar } from 'iconoir-react'

type Props = {
  value: string // ISO string or empty string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  /** If true, shows error styling on trigger */
  invalid?: boolean
  /** If true, shows only date picker (no time) */
  dateOnly?: boolean
  /** If true, uses an icon button trigger instead of text field */
  iconButton?: boolean
  /** Icon button size (only used when iconButton is true) */
  iconButtonSize?: '1' | '2' | '3'
  disabled?: boolean
}

/**
 * DateTimePicker with 5-minute precision
 * Visual grid-based date and hour selection, minute slider
 * Wrapped in a Popover for compact display
 * Takes and returns ISO strings (empty string for no value)
 */
export default function DateTimePicker({
  value,
  onChange,
  label,
  placeholder,
  invalid = false,
  dateOnly = false,
  iconButton = false,
  iconButtonSize = '2',
  disabled = false,
}: Props) {
  const defaultPlaceholder = dateOnly ? 'Select date' : 'Select date and time'
  const finalPlaceholder = placeholder || defaultPlaceholder

  const [open, setOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'date' | 'time'>('date')
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (value) {
      const d = new Date(value)
      return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  })
  const [showYearPicker, setShowYearPicker] = React.useState(false)
  const yearPickerRef = React.useRef<HTMLDivElement>(null)

  // Parse ISO string to local date/time components
  const dateValue = value ? toLocalDate(value) : ''
  const selectedDate = value ? new Date(value) : null
  const hour = value ? new Date(value).getHours() : 9
  const minute = value ? new Date(value).getMinutes() : 0

  // Get calendar days for current month
  const calendarDays = React.useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // Convert Sunday (0) to 6, Monday (1) to 0, etc. to make Monday the first day
    const dayOfWeek = firstDay.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const startPadding = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0, Sunday = 6
    const daysInMonth = lastDay.getDate()

    const days: Array<{ day: number; date: Date; isCurrentMonth: boolean }> = []

    // Previous month days
    const prevMonth = new Date(year, month - 1, 0)
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        day: prevMonth.getDate() - i,
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        date: new Date(year, month, day),
        isCurrentMonth: true,
      })
    }

    // Next month days to fill the grid
    const remaining = 42 - days.length // 6 rows * 7 days
    for (let day = 1; day <= remaining; day++) {
      days.push({
        day,
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      })
    }

    return days
  }, [currentMonth])

  const handleDateClick = (date: Date) => {
    if (disabled) return
    const dateStr = toLocalDate(date.toISOString())
    if (dateOnly) {
      // For date-only, set time to start of day (00:00)
      const local = `${dateStr}T00:00`
      onChange(fromLocalInput(local))
      setOpen(false)
    } else {
      // For datetime, keep existing time or default to 09:00
      const h = value ? hour : 9
      const m = value ? minute : 0
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const local = `${dateStr}T${timeStr}`
      onChange(fromLocalInput(local))
      setActiveTab('time')
    }
  }

  const handleHourClick = (h: number) => {
    if (disabled) return
    if (!dateValue) {
      // If no date selected, set today
      const today = toLocalDate(new Date().toISOString())
      const timeStr = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const local = `${today}T${timeStr}`
      onChange(fromLocalInput(local))
      return
    }
    const date = dateValue
    const timeStr = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    const local = `${date}T${timeStr}`
    onChange(fromLocalInput(local))
  }

  const handleMinuteClick = (m: number) => {
    if (disabled) return
    if (!dateValue) {
      const today = toLocalDate(new Date().toISOString())
      const timeStr = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const local = `${today}T${timeStr}`
      onChange(fromLocalInput(local))
      return
    }
    const date = dateValue
    const timeStr = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const local = `${date}T${timeStr}`
    onChange(fromLocalInput(local))
  }

  const formatDisplayValue = () => {
    if (!value) return finalPlaceholder
    const d = new Date(value)
    const monthNames = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ]
    const day = d.getDate()
    const month = monthNames[d.getMonth()]
    const year = d.getFullYear()
    const dateLabel = `${day}. ${month} ${year}`

    if (dateOnly) {
      return dateLabel
    }

    const h = d.getHours()
    const m = d.getMinutes()
    const displayHour = String(h).padStart(2, '0')
    const displayMin = String(m).padStart(2, '0')
    return `${dateLabel}, ${displayHour}:${displayMin}`
  }

  const currentYear = currentMonth.getFullYear()
  const currentMonthIndex = currentMonth.getMonth()
  const monthNameOnly = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
  })

  // Generate years for year picker (1930 to current year + 10 years)
  const yearRange = React.useMemo(() => {
    const currentYearNum = new Date().getFullYear()
    const years: Array<number> = []
    for (let i = 1930; i <= currentYearNum + 10; i++) {
      years.push(i)
    }
    return years
  }, [])

  const handleYearSelect = (year: number) => {
    setCurrentMonth(new Date(year, currentMonthIndex, 1))
    setShowYearPicker(false)
  }

  // Auto-scroll to current year when year picker opens
  React.useEffect(() => {
    if (showYearPicker && yearPickerRef.current) {
      const currentYearButton =
        yearPickerRef.current.querySelector<HTMLElement>(
          `[data-year="${new Date().getFullYear()}"]`,
        )
      if (currentYearButton) {
        currentYearButton.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        })
      }
    }
  }, [showYearPicker])

  const isToday = (date: Date) =>
    toLocalDate(date.toISOString()) === toLocalDate(new Date().toISOString())
  const isSelected = (date: Date) =>
    selectedDate &&
    toLocalDate(date.toISOString()) === toLocalDate(selectedDate.toISOString())

  const triggerButton = iconButton ? (
    <IconButton
      variant="soft"
      size={iconButtonSize}
      disabled={disabled}
      style={
        invalid
          ? {
              border: '1px solid var(--red-8)',
              boxShadow: '0 0 0 1px var(--red-8)',
            }
          : undefined
      }
    >
      <Calendar width={16} height={16} />
    </IconButton>
  ) : (
    <button
      type="button"
      disabled={disabled}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: 'var(--radius-3)',
        border: `1px solid ${invalid ? 'var(--red-8)' : 'var(--gray-a6)'}`,
        background: 'var(--color-panel-solid)',
        color: value ? 'var(--gray-12)' : 'var(--gray-9)',
        fontSize: 'var(--font-size-3)',
        lineHeight: 'var(--line-height-3)',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color 0.15s, background-color 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.borderColor = invalid
          ? 'var(--red-9)'
          : 'var(--gray-a8)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.borderColor = invalid
          ? 'var(--red-8)'
          : 'var(--gray-a6)'
      }}
    >
      <Calendar width={16} height={16} />
      {formatDisplayValue()}
    </button>
  )

  return (
    <Box style={{ minWidth: 0 }}>
      {label && !iconButton && (
        <Text as="div" size="2" color="gray" style={{ marginBottom: 8 }}>
          {label}
        </Text>
      )}

      <Popover.Root
        open={disabled ? false : open}
        onOpenChange={(newOpen) => {
          if (disabled) return
          setOpen(newOpen)
          if (!newOpen) {
            // Reset year picker when popover closes
            setShowYearPicker(false)
          }
        }}
      >
        <Popover.Trigger>{triggerButton}</Popover.Trigger>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          style={{
            width: 360,
            maxHeight: 'min(80vh, 600px)',
            maxWidth: 'calc(100vw - 32px)',
            overflowY: 'auto',
            zIndex: 10001, // Ensure it appears above dialogs (which use z-index 10000)
          }}
        >
          {/* Tabs with close button */}
          <Flex align="center" justify="between" mb="3" gap="2">
            {!dateOnly && (
              <Flex
                gap="1"
                style={{
                  background: 'var(--gray-3)',
                  padding: 4,
                  borderRadius: 6,
                  display: 'inline-flex',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('date')
                    setShowYearPicker(false)
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 4,
                    border: 'none',
                    background:
                      activeTab === 'date' ? 'var(--gray-9)' : 'transparent',
                    color: activeTab === 'date' ? 'white' : 'var(--gray-11)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-2)',
                    fontWeight: activeTab === 'date' ? 500 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  Date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('time')
                    setShowYearPicker(false)
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 4,
                    border: 'none',
                    background:
                      activeTab === 'time' ? 'var(--gray-9)' : 'transparent',
                    color: activeTab === 'time' ? 'white' : 'var(--gray-11)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-2)',
                    fontWeight: activeTab === 'time' ? 500 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  Time
                </button>
              </Flex>
            )}
          </Flex>

          {/* Date picker */}
          {(dateOnly || activeTab === 'date') && !showYearPicker && (
            <Box>
              {/* Month navigation */}
              <Flex align="center" justify="between" mb="3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMonth(
                      new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() - 1,
                        1,
                      ),
                    )
                  }}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 4,
                    background: 'var(--gray-2)',
                    cursor: 'pointer',
                  }}
                >
                  ←
                </button>
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    {monthNameOnly}
                  </Text>
                  <button
                    type="button"
                    onClick={() => setShowYearPicker(true)}
                    style={{
                      padding: '2px 8px',
                      border: 'none',
                      borderRadius: 4,
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--gray-11)',
                      fontSize: 'var(--font-size-2)',
                      fontWeight: 500,
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--gray-3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {currentYear}
                  </button>
                </Flex>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMonth(
                      new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() + 1,
                        1,
                      ),
                    )
                  }}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 4,
                    background: 'var(--gray-2)',
                    cursor: 'pointer',
                  }}
                >
                  →
                </button>
              </Flex>

              {/* Day labels */}
              <Flex
                mb="2"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 4,
                }}
              >
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <Text
                    key={day}
                    size="1"
                    color="gray"
                    style={{ textAlign: 'center', fontWeight: 500 }}
                  >
                    {day}
                  </Text>
                ))}
              </Flex>

              {/* Calendar grid */}
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 4,
                }}
              >
                {calendarDays.map(({ day, date, isCurrentMonth }, idx) => {
                  const dateSelected = isSelected(date)
                  const today = isToday(date)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDateClick(date)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 6,
                        border: `${
                          dateSelected
                            ? '2px solid var(--blue-7)'
                            : today
                              ? '1px solid var(--gray-8)'
                              : '1px solid var(--gray-6)'
                        }`,
                        background: dateSelected
                          ? 'transparent'
                          : today
                            ? 'var(--gray-3)'
                            : isCurrentMonth
                              ? 'var(--gray-2)'
                              : 'var(--gray-1)',
                        color: dateSelected
                          ? 'var(--blue-10)'
                          : isCurrentMonth
                            ? 'var(--gray-12)'
                            : 'var(--gray-9)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-2)',
                        fontWeight: dateSelected ? 500 : 400,
                        transition: 'all 0.15s',
                        textAlign: 'center',
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </Box>
            </Box>
          )}

          {/* Year picker */}
          {(dateOnly || activeTab === 'date') && showYearPicker && (
            <Box>
              <Flex align="center" justify="between" mb="3">
                <button
                  type="button"
                  onClick={() => setShowYearPicker(false)}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 4,
                    background: 'var(--gray-2)',
                    cursor: 'pointer',
                  }}
                >
                  ← Back
                </button>
                <Text size="2" weight="medium">
                  Select Year
                </Text>
                <Box style={{ width: 60 }} /> {/* Spacer for alignment */}
              </Flex>

              {/* Year grid */}
              <Box
                ref={yearPickerRef}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}
              >
                {yearRange.map((year) => {
                  const yearSelected = year === currentYear
                  const isCurrentYear = year === new Date().getFullYear()
                  return (
                    <button
                      key={year}
                      type="button"
                      data-year={year}
                      onClick={() => handleYearSelect(year)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 6,
                        border: `${
                          yearSelected
                            ? '2px solid var(--blue-7)'
                            : '1px solid var(--gray-6)'
                        }`,
                        background: yearSelected
                          ? 'transparent'
                          : isCurrentYear
                            ? 'var(--gray-3)'
                            : 'var(--gray-2)',
                        color: yearSelected
                          ? 'var(--blue-10)'
                          : 'var(--gray-12)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-2)',
                        fontWeight: yearSelected ? 500 : 400,
                        transition: 'all 0.15s',
                        textAlign: 'center',
                      }}
                    >
                      {year}
                    </button>
                  )
                })}
              </Box>
            </Box>
          )}

          {/* Time picker */}
          {!dateOnly && activeTab === 'time' && (
            <Box>
              {/* Hour grid */}
              <Box mb="3">
                <Flex align="center" gap="2" mb="2">
                  <Text size="1" color="gray">
                    Hour
                  </Text>
                </Flex>
                <Box
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 8,
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                    const hourSelected = h === hour
                    const displayHour = String(h).padStart(2, '0')
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHourClick(h)}
                        style={{
                          padding: '8px 4px',
                          borderRadius: 6,
                          border: `${
                            hourSelected
                              ? '2px solid var(--blue-7)'
                              : '1px solid var(--gray-6)'
                          }`,
                          background: hourSelected
                            ? 'transparent'
                            : 'var(--gray-2)',
                          color: hourSelected
                            ? 'var(--blue-10)'
                            : 'var(--gray-12)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-1)',
                          fontWeight: hourSelected ? 500 : 400,
                          transition: 'all 0.15s',
                          textAlign: 'center',
                        }}
                      >
                        {displayHour}
                      </button>
                    )
                  })}
                </Box>
              </Box>

              {/* Minute slider */}
              <Box>
                <Text size="1" color="gray" style={{ marginBottom: 8 }}>
                  Minute
                </Text>
                <Box
                  style={{
                    display: 'flex',
                    gap: 4,
                    overflowX: 'auto',
                    paddingBottom: 4,
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => {
                    const minuteSelected = minute === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMinuteClick(m)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: `${
                            minuteSelected
                              ? '2px solid var(--blue-7)'
                              : '1px solid var(--gray-6)'
                          }`,
                          background: minuteSelected
                            ? 'transparent'
                            : 'var(--gray-2)',
                          color: minuteSelected
                            ? 'var(--blue-10)'
                            : 'var(--gray-12)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-2)',
                          fontWeight: minuteSelected ? 500 : 400,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        :{String(m).padStart(2, '0')}
                      </button>
                    )
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Popover.Content>
      </Popover.Root>
    </Box>
  )
}

/**
 * Convert ISO string to local date string (YYYY-MM-DD)
 */
function toLocalDate(iso: string): string {
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert local datetime string (YYYY-MM-DDTHH:MM) to ISO string
 */
function fromLocalInput(local: string): string {
  if (!local) return ''
  // Parse as local time and convert to ISO
  const d = new Date(local)
  return d.toISOString()
}
