import * as React from 'react'
import { Box, Flex, IconButton, Popover, Text } from '@radix-ui/themes'
import { Calendar, Xmark } from 'iconoir-react'
import { CalendarGrid } from './CalendarGrid'
import {
  dateToLocalDate,
  formatDateLabel,
  getInitialMonth,
  normalizeDateRange,
  parseIso,
  startOfDay,
} from './dateTimeUtils'
import { SinglePickerTrigger } from './PickerTrigger'
import type { DateRangeSelection, PickerLocale } from './dateTimeUtils'

type Props = {
  /** Local calendar date YYYY-MM-DD, or empty when unset. */
  startDate: string
  /** Local calendar date YYYY-MM-DD, or empty when unset. */
  endDate: string
  onChange: (range: { startDate: string; endDate: string }) => void
  /** When set, shows a clear control on the active period chip (iconButton mode). */
  onClear?: () => void
  label?: string
  placeholder?: string
  iconButton?: boolean
  iconButtonSize?: '1' | '2' | '3'
  locale?: PickerLocale
  disabled?: boolean
  invalid?: boolean
}

function formatPeriodLabel(
  startDate: string,
  endDate: string,
  locale: PickerLocale,
): string | null {
  if (!startDate || !endDate) return null
  const start = parseIso(startOfDay(startDate))
  const end = parseIso(startOfDay(endDate))
  if (!start || !end) return null
  if (startDate === endDate) return formatDateLabel(start, locale)
  return `${formatDateLabel(start, locale)} – ${formatDateLabel(end, locale)}`
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  onClear,
  label,
  placeholder = 'Select period',
  iconButton = false,
  iconButtonSize = '2',
  locale = 'en',
  disabled = false,
  invalid = false,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [dateSelection, setDateSelection] = React.useState<DateRangeSelection>({
    start: null,
    end: null,
  })
  const [currentMonth, setCurrentMonth] = React.useState(() =>
    getInitialMonth(startDate ? startOfDay(startDate) : ''),
  )

  const periodLabel = formatPeriodLabel(startDate, endDate, locale)
  const hasPeriod = periodLabel != null

  const syncFromProps = React.useCallback(() => {
    if (startDate && endDate) {
      const normalized = normalizeDateRange(startDate, endDate)
      setDateSelection({ start: normalized.start, end: normalized.end })
      setCurrentMonth(
        new Date(
          Number(normalized.start.slice(0, 4)),
          Number(normalized.start.slice(5, 7)) - 1,
          1,
        ),
      )
    } else {
      setDateSelection({ start: null, end: null })
    }
  }, [startDate, endDate])

  const wasOpenRef = React.useRef(false)
  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (justOpened) syncFromProps()
  }, [open, syncFromProps])

  const displayValue = periodLabel ?? placeholder

  const handleDateClick = (date: Date) => {
    if (disabled) return
    const clicked = dateToLocalDate(date)
    const { start, end } = dateSelection

    // First click (or reset after a completed multi-day range): start awaiting end.
    const hasCompletedMultiDay = start != null && end != null && start !== end
    if (!start || hasCompletedMultiDay) {
      setDateSelection({ start: clicked, end: null })
      return
    }

    // Second click: complete the period and close.
    const normalized = normalizeDateRange(start, clicked)
    setDateSelection({ start: normalized.start, end: normalized.end })
    onChange({ startDate: normalized.start, endDate: normalized.end })
    setOpen(false)
  }

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    setOpen(false)
    onClear?.()
  }

  const emptyIconTrigger = (
    <IconButton
      variant="soft"
      size={iconButtonSize}
      disabled={disabled}
      aria-label={placeholder}
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
  )

  const periodChipTrigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={periodLabel ?? placeholder}
      style={{
        all: 'unset',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxSizing: 'border-box',
        maxWidth: '100%',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Calendar width={14} height={14} style={{ flexShrink: 0 }} />
      <Text
        size="2"
        weight="medium"
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {periodLabel}
      </Text>
    </button>
  )

  const trigger = iconButton ? (
    hasPeriod ? (
      periodChipTrigger
    ) : (
      emptyIconTrigger
    )
  ) : (
    <SinglePickerTrigger
      displayValue={displayValue}
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
    />
  )

  const rangeForGrid: DateRangeSelection | undefined = dateSelection.start
    ? {
        start: dateSelection.start,
        end: dateSelection.end ?? dateSelection.start,
      }
    : undefined

  const popover = (
    <Popover.Root
      open={disabled ? false : open}
      onOpenChange={(newOpen) => {
        if (disabled) return
        setOpen(newOpen)
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Content
        side="bottom"
        align="start"
        sideOffset={4}
        style={{
          width: 360,
          maxHeight: 'min(80vh, 600px)',
          maxWidth: 'calc(100vw - 32px)',
          overflowY: 'auto',
          zIndex: 10001,
        }}
      >
        <Flex direction="column" gap="2">
          <Text size="1" color="gray">
            {dateSelection.start && !dateSelection.end
              ? 'Select end date'
              : 'Select start and end date'}
          </Text>
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onDateClick={handleDateClick}
            rangeSelection={rangeForGrid}
            disabled={disabled}
          />
        </Flex>
      </Popover.Content>
    </Popover.Root>
  )

  if (iconButton && hasPeriod && onClear) {
    return (
      <Box style={{ minWidth: 0 }}>
        <Flex
          align="center"
          gap="1"
          style={{
            backgroundColor: 'var(--blue-a3)',
            color: 'var(--blue-11)',
            borderRadius: 'var(--radius-2)',
            paddingLeft: 8,
            paddingRight: 6,
            paddingTop: 4,
            paddingBottom: 4,
            minHeight:
              iconButtonSize === '1' ? 24 : iconButtonSize === '3' ? 40 : 32,
            maxWidth: '100%',
            boxShadow: invalid ? 'inset 0 0 0 1px var(--red-8)' : undefined,
          }}
        >
          {popover}
          <IconButton
            type="button"
            size="1"
            variant="ghost"
            color="blue"
            disabled={disabled}
            onClick={handleClear}
            aria-label="Clear period filter"
          >
            <Xmark width={14} height={14} />
          </IconButton>
        </Flex>
      </Box>
    )
  }

  return (
    <Box style={{ minWidth: 0 }}>
      {label && !iconButton && (
        <Text as="div" size="2" color="gray" style={{ marginBottom: 8 }}>
          {label}
        </Text>
      )}
      {popover}
    </Box>
  )
}
