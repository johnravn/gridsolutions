import * as React from 'react'
import { Box, Flex, Popover, Text } from '@radix-ui/themes'
import { CalendarGrid } from './CalendarGrid'
import { HourGrid } from './HourGrid'
import { MinuteGrid } from './MinuteGrid'
import { PickerTrigger } from './PickerTrigger'
import { SegmentedControl } from './SegmentedControl'
import {
  buildRangeIso,
  dateToLocalDate,
  ensurePositiveSameDayTimes,
  extractRangeTimes,
  formatDateLabel,
  formatTimeLabel,
  getInitialMonth,
  handleRangeDateClick,
  handleRangeHourClick,
  isEndMinuteDisabled,
  isFullDayEnd,
  isFullDayStart,
  isInvalidTimeRange,
  isStartMinuteDisabled,
  parseIso,
  startOfDay,
  toLocalDate,
} from './dateTimeUtils'
import type { PickerLocale, RangeTimeSelection } from './dateTimeUtils'

const EMPTY_TIME_SELECTION: RangeTimeSelection = {
  startHour: null,
  endHour: null,
  startMinute: null,
  endMinute: null,
}

type Props = {
  startAt: string
  endAt: string
  onChange: (range: { startAt: string; endAt: string }) => void
  label?: string
  invalid?: boolean
  locale?: PickerLocale
  disabled?: boolean
  /** Minute picker step. Defaults to 5; use 1 for per-minute precision. */
  minuteStep?: 1 | 5
}

type Phase = 'dates' | 'hours' | 'minutes'

const MULTI_DAY_END_TAB_DELAY_MS = 300

function resolveEndDate(start: string, end: string | null): string {
  return end ?? start
}

function formatSelectionTime(
  hour: number | null,
  minute: number | null,
): string | undefined {
  if (hour == null) return undefined
  return formatTimeLabel(hour, minute ?? 0)
}

function formatIsoTime(iso: string, isEnd: boolean): string | undefined {
  if (!iso) return undefined
  if (isEnd ? isFullDayEnd(iso) : isFullDayStart(iso)) return 'All day'
  const d = parseIso(iso)
  return d ? formatTimeLabel(d.getHours(), d.getMinutes()) : undefined
}

export default function DateTimeRangePicker({
  startAt,
  endAt,
  onChange,
  label,
  invalid = false,
  locale = 'en',
  disabled = false,
  minuteStep = 5,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [phase, setPhase] = React.useState<Phase>('dates')
  const [dateSelection, setDateSelection] = React.useState<{
    start: string | null
    end: string | null
  }>({ start: null, end: null })
  const [timeSelection, setTimeSelection] =
    React.useState<RangeTimeSelection>(EMPTY_TIME_SELECTION)
  const [activeTimeTab, setActiveTimeTab] = React.useState<'start' | 'end'>(
    'start',
  )

  const parsedStart = React.useMemo(() => parseIso(startAt), [startAt])
  const parsedEnd = React.useMemo(() => parseIso(endAt), [endAt])

  const [currentMonth, setCurrentMonth] = React.useState(() =>
    getInitialMonth(startAt || endAt),
  )

  React.useEffect(() => {
    const anchor = parsedStart ?? parsedEnd
    if (anchor) {
      setCurrentMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    }
  }, [parsedStart?.getTime(), parsedEnd?.getTime()])

  const syncFromProps = React.useCallback(() => {
    if (parsedStart) {
      const startDate = toLocalDate(parsedStart.toISOString())
      const endDate = parsedEnd
        ? toLocalDate(parsedEnd.toISOString())
        : startDate
      setDateSelection({ start: startDate, end: endDate })
      setTimeSelection(extractRangeTimes(startAt, endAt))
    } else {
      setDateSelection({ start: null, end: null })
      setTimeSelection(EMPTY_TIME_SELECTION)
    }
  }, [parsedStart, parsedEnd, startAt, endAt])

  const wasOpenRef = React.useRef(false)
  const advanceToEndTabTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  React.useEffect(() => {
    return () => {
      if (advanceToEndTabTimeoutRef.current) {
        clearTimeout(advanceToEndTabTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open

    if (!justOpened) return

    syncFromProps()
    setPhase('dates')
    setActiveTimeTab('start')
  }, [open, syncFromProps])

  // Keep the closed trigger in sync when the parent form resets/prefills
  // (e.g. Edit Job / Add Role). Internal selection state otherwise wins and
  // can leave the trigger empty or stale after form.reset().
  React.useEffect(() => {
    if (open) return
    syncFromProps()
  }, [startAt, endAt, open, syncFromProps])

  const endDate = dateSelection.start
    ? resolveEndDate(dateSelection.start, dateSelection.end)
    : null

  const isSameDay =
    dateSelection.start != null &&
    endDate != null &&
    dateSelection.start === endDate

  const scheduleAdvanceToEndTab = () => {
    if (advanceToEndTabTimeoutRef.current) {
      clearTimeout(advanceToEndTabTimeoutRef.current)
    }
    advanceToEndTabTimeoutRef.current = setTimeout(() => {
      setActiveTimeTab('end')
      advanceToEndTabTimeoutRef.current = null
    }, MULTI_DAY_END_TAB_DELAY_MS)
  }

  const minDurationMs = minuteStep * 60_000

  const applySameDayTimes = (
    times: RangeTimeSelection,
  ): RangeTimeSelection | null => {
    if (!isSameDay) return times
    if (times.startHour == null || times.endHour == null) return times
    return ensurePositiveSameDayTimes(times, minuteStep)
  }

  const commitRange = (
    dates: { start: string; end: string },
    times: RangeTimeSelection,
  ) => {
    const { startAt: newStart, endAt: newEnd } = buildRangeIso(
      dates.start,
      dates.end,
      times,
      minDurationMs,
    )
    onChange({ startAt: newStart, endAt: newEnd })
  }

  const handleDateClick = (date: Date) => {
    if (disabled) return
    const localDate = dateToLocalDate(date)
    const next = handleRangeDateClick(dateSelection, localDate)

    if (!next.start) return

    const end = next.end ?? next.start
    const dates = { start: next.start, end }
    const datesChanged =
      dates.start !== dateSelection.start || dates.end !== dateSelection.end
    const times = datesChanged ? EMPTY_TIME_SELECTION : timeSelection

    setDateSelection(dates)
    setTimeSelection(times)
    commitRange(dates, times)
  }

  const handleSameDayHourClick = (hour: number) => {
    if (disabled || !dateSelection.start || !endDate) return
    const next = handleRangeHourClick(
      { start: timeSelection.startHour, end: timeSelection.endHour },
      hour,
    )
    const hadCompleteHours =
      timeSelection.startHour != null && timeSelection.endHour != null
    const draft: RangeTimeSelection = {
      startHour: next.start,
      endHour: next.end,
      startMinute:
        next.start == null
          ? null
          : hadCompleteHours && next.end == null
            ? 0
            : (timeSelection.startMinute ?? 0),
      endMinute: next.end != null ? (timeSelection.endMinute ?? 0) : null,
    }
    const times = applySameDayTimes(draft)
    if (!times) return
    setTimeSelection(times)
    commitRange({ start: dateSelection.start, end: endDate }, times)
    if (next.start != null && next.end == null) {
      scheduleAdvanceToEndTab()
    }
  }

  const handleStartHourClick = (hour: number) => {
    if (disabled || !dateSelection.start || !endDate) return
    const draft = {
      ...timeSelection,
      startHour: hour,
      startMinute: timeSelection.startMinute ?? 0,
    }
    const times = applySameDayTimes(draft)
    if (!times) return
    setTimeSelection(times)
    commitRange({ start: dateSelection.start, end: endDate }, times)
    scheduleAdvanceToEndTab()
  }

  const handleEndHourClick = (hour: number) => {
    if (disabled || !dateSelection.start || !endDate) return
    const draft = {
      ...timeSelection,
      endHour: hour,
      endMinute: timeSelection.endMinute ?? 0,
    }
    const times = applySameDayTimes(draft)
    if (!times) return
    setTimeSelection(times)
    commitRange({ start: dateSelection.start, end: endDate }, times)
  }

  const handleStartMinuteClick = (minute: number) => {
    if (disabled || !dateSelection.start || !endDate) return
    if (timeSelection.startHour == null) return
    if (isStartMinuteDisabled(minute, timeSelection, isSameDay)) return
    const draft = { ...timeSelection, startMinute: minute }
    const times = applySameDayTimes(draft)
    if (!times) return
    setTimeSelection(times)
    commitRange({ start: dateSelection.start, end: endDate }, times)
    scheduleAdvanceToEndTab()
  }

  const handleEndMinuteClick = (minute: number) => {
    if (disabled || !dateSelection.start || !endDate) return
    if (timeSelection.endHour == null) return
    if (isEndMinuteDisabled(minute, timeSelection, isSameDay)) return
    const draft = { ...timeSelection, endMinute: minute }
    const times = applySameDayTimes(draft)
    if (!times) return
    setTimeSelection(times)
    commitRange({ start: dateSelection.start, end: endDate }, times)
  }

  const buildTriggerFields = () => {
    const displayStart =
      dateSelection.start ??
      (parsedStart ? toLocalDate(parsedStart.toISOString()) : null)

    if (!displayStart) return []

    const displayEnd =
      dateSelection.end ??
      (parsedEnd ? toLocalDate(parsedEnd.toISOString()) : displayStart)

    const startDateObj = parseIso(startOfDay(displayStart))
    if (!startDateObj) return []

    const startDateLabel = formatDateLabel(startDateObj, locale)
    const startTime =
      formatSelectionTime(timeSelection.startHour, timeSelection.startMinute) ??
      (startAt ? formatIsoTime(startAt, false) : undefined)

    const endDateObj = parseIso(startOfDay(displayEnd))
    if (!endDateObj) return []

    const endDateLabel = formatDateLabel(endDateObj, locale)
    const endTime =
      formatSelectionTime(timeSelection.endHour, timeSelection.endMinute) ??
      (endAt ? formatIsoTime(endAt, true) : undefined)
    const sameDay = displayStart === displayEnd

    return [
      {
        label: 'Start',
        primary: sameDay ? (startTime ?? 'All day') : startDateLabel,
        secondary: sameDay ? startDateLabel : startTime,
      },
      {
        label: 'End',
        primary: sameDay ? (endTime ?? 'All day') : endDateLabel,
        secondary: sameDay ? endDateLabel : endTime,
      },
    ]
  }

  const rangeInvalid = invalid || isInvalidTimeRange(startAt, endAt)

  const fieldInteraction =
    open &&
    (phase === 'hours' || phase === 'minutes') &&
    dateSelection.start != null

  const triggerFields = React.useMemo(() => {
    const fields = buildTriggerFields()
    if (!fieldInteraction) return fields
    return fields.map((field) => ({
      ...field,
      active:
        (field.label === 'Start' && activeTimeTab === 'start') ||
        (field.label === 'End' && activeTimeTab === 'end'),
    }))
  }, [
    startAt,
    endAt,
    dateSelection,
    timeSelection,
    parsedStart,
    parsedEnd,
    locale,
    fieldInteraction,
    activeTimeTab,
  ])

  const handleFieldClick = (field: 'start' | 'end') => {
    if (advanceToEndTabTimeoutRef.current) {
      clearTimeout(advanceToEndTabTimeoutRef.current)
      advanceToEndTabTimeoutRef.current = null
    }
    setActiveTimeTab(field)
  }

  const hasHourSelection =
    timeSelection.startHour != null || timeSelection.endHour != null

  return (
    <Box style={{ minWidth: 0 }}>
      {label && (
        <Text as="div" size="2" color="gray" style={{ marginBottom: 8 }}>
          {label}
        </Text>
      )}

      <Popover.Root
        open={disabled ? false : open}
        onOpenChange={(newOpen) => {
          if (disabled) return
          setOpen(newOpen)
        }}
      >
        <Popover.Trigger asChild>
          <PickerTrigger
            fields={triggerFields}
            placeholder="Select period"
            invalid={rangeInvalid}
            disabled={disabled}
            fieldInteraction={fieldInteraction}
            onFieldClick={handleFieldClick}
            onOpen={() => setOpen(true)}
          />
        </Popover.Trigger>
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
          <Flex align="center" mb="3">
            <SegmentedControl
              segments={[
                { id: 'dates', label: 'Dates' },
                { id: 'hours', label: 'Hours' },
                { id: 'minutes', label: 'Minutes' },
              ]}
              activeId={phase}
              onChange={(id) => {
                const nextPhase = id as Phase
                setPhase(nextPhase)
                if (nextPhase === 'minutes') {
                  setActiveTimeTab('start')
                }
              }}
            />
          </Flex>

          {phase === 'dates' && (
            <CalendarGrid
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onDateClick={handleDateClick}
              rangeSelection={dateSelection}
              disabled={disabled}
            />
          )}

          {phase === 'hours' && dateSelection.start && (
            <Box>
              {isSameDay ? (
                <Flex direction="column" gap="3">
                  <HourGrid
                    label="Select start and end hour"
                    rangeSelection={{
                      start: timeSelection.startHour,
                      end: timeSelection.endHour,
                    }}
                    onHourClick={handleSameDayHourClick}
                    disabled={disabled}
                  />
                  <Text size="1" color="gray">
                    Tap one hour for start, another for end. Leave unselected
                    for all day.
                  </Text>
                </Flex>
              ) : (
                <Box>
                  {activeTimeTab === 'start' ? (
                    <HourGrid
                      label="Start hour"
                      selectedHour={timeSelection.startHour}
                      onHourClick={handleStartHourClick}
                      disabled={disabled}
                    />
                  ) : (
                    <HourGrid
                      label="End hour"
                      selectedHour={timeSelection.endHour}
                      onHourClick={handleEndHourClick}
                      disabled={disabled}
                    />
                  )}
                  <Text size="1" color="gray" mt="3">
                    Leave unselected for all day.
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {phase === 'minutes' && dateSelection.start && (
            <Box>
              {!hasHourSelection ? (
                <Text size="2" color="gray">
                  Select hours first, or use the Minutes tab after choosing
                  hours.
                </Text>
              ) : (
                <Box>
                  {activeTimeTab === 'start' ? (
                    <MinuteGrid
                      step={minuteStep}
                      label="Start minute"
                      selectedMinute={timeSelection.startMinute}
                      onMinuteClick={handleStartMinuteClick}
                      disabled={disabled || timeSelection.startHour == null}
                      isMinuteDisabled={(minute) =>
                        isStartMinuteDisabled(minute, timeSelection, isSameDay)
                      }
                    />
                  ) : (
                    <MinuteGrid
                      step={minuteStep}
                      label="End minute"
                      selectedMinute={timeSelection.endMinute}
                      onMinuteClick={handleEndMinuteClick}
                      disabled={disabled || timeSelection.endHour == null}
                      isMinuteDisabled={(minute) =>
                        isEndMinuteDisabled(minute, timeSelection, isSameDay)
                      }
                    />
                  )}
                  <Text size="1" color="gray" mt="3">
                    Optional refinement after choosing hours. Defaults to :00.
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {(phase === 'hours' || phase === 'minutes') &&
            !dateSelection.start && (
              <Text size="2" color="gray">
                Select a date first.
              </Text>
            )}
        </Popover.Content>
      </Popover.Root>
    </Box>
  )
}
