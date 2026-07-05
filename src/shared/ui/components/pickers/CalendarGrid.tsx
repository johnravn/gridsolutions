import * as React from 'react'
import { Box, Flex, Text } from '@radix-ui/themes'
import {
  buildCalendarDays,
  buildYearRange,
  dateToLocalDate,
  isDateInRange,
  isSameLocalDate,
  isToday,
} from './dateTimeUtils'
import type { DateRangeSelection } from './dateTimeUtils'

export type CalendarGridProps = {
  currentMonth: Date
  onMonthChange: (month: Date) => void
  onDateClick: (date: Date) => void
  selectedDate?: Date | null
  rangeSelection?: DateRangeSelection
  disabled?: boolean
}

export function CalendarGrid({
  currentMonth,
  onMonthChange,
  onDateClick,
  selectedDate = null,
  rangeSelection,
  disabled = false,
}: CalendarGridProps) {
  const [showYearPicker, setShowYearPicker] = React.useState(false)
  const yearPickerRef = React.useRef<HTMLDivElement>(null)

  const calendarDays = React.useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth],
  )

  const currentYear = currentMonth.getFullYear()
  const currentMonthIndex = currentMonth.getMonth()
  const monthNameOnly = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
  })
  const yearRange = React.useMemo(() => buildYearRange(), [])

  React.useEffect(() => {
    if (showYearPicker && yearPickerRef.current) {
      const currentYearButton =
        yearPickerRef.current.querySelector<HTMLElement>(
          `[data-year="${new Date().getFullYear()}"]`,
        )
      if (currentYearButton?.scrollIntoView) {
        currentYearButton.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        })
      }
    }
  }, [showYearPicker])

  const handleYearSelect = (year: number) => {
    onMonthChange(new Date(year, currentMonthIndex, 1))
    setShowYearPicker(false)
  }

  if (showYearPicker) {
    return (
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
          <Box style={{ width: 60 }} />
        </Flex>
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
                  color: yearSelected ? 'var(--blue-10)' : 'var(--gray-12)',
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
    )
  }

  return (
    <Box>
      <Flex align="center" justify="between" mb="3">
        <button
          type="button"
          onClick={() =>
            onMonthChange(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() - 1,
                1,
              ),
            )
          }
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
            }}
          >
            {currentYear}
          </button>
        </Flex>
        <button
          type="button"
          onClick={() =>
            onMonthChange(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1,
                1,
              ),
            )
          }
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

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {calendarDays.map(({ day, date, isCurrentMonth }, idx) => {
          const localDate = dateToLocalDate(date)
          const rangePos = rangeSelection
            ? isDateInRange(localDate, rangeSelection.start, rangeSelection.end)
            : false
          const dateSelected =
            selectedDate != null && isSameLocalDate(date, selectedDate)
          const today = isToday(date)

          let border = '1px solid var(--gray-6)'
          let background = isCurrentMonth ? 'var(--gray-2)' : 'var(--gray-1)'
          let color = isCurrentMonth ? 'var(--gray-12)' : 'var(--gray-9)'
          let fontWeight = 400

          if (rangePos === 'start' || rangePos === 'end' || dateSelected) {
            border = '2px solid var(--blue-7)'
            background = 'var(--blue-3)'
            color = 'var(--blue-11)'
            fontWeight = 500
          } else if (rangePos === 'between') {
            border = '1px solid var(--blue-5)'
            background = 'var(--blue-2)'
            color = 'var(--blue-11)'
          } else if (today) {
            border = '1px solid var(--gray-8)'
            background = 'var(--gray-3)'
          }

          return (
            <button
              key={idx}
              type="button"
              aria-label={localDate}
              disabled={disabled}
              onClick={() => onDateClick(date)}
              style={{
                padding: '8px 4px',
                borderRadius: 6,
                border,
                background,
                color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-2)',
                fontWeight,
                transition: 'all 0.15s',
                textAlign: 'center',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {day}
            </button>
          )
        })}
      </Box>
    </Box>
  )
}
