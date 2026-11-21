import * as React from 'react'
import { Button, Flex, Popover, SegmentedControl, Text } from '@radix-ui/themes'
import { NavArrowDown } from 'iconoir-react'
import { MONTH_OPTIONS } from '../utils/dates'
import {
  formatPeriodLabel,
  isMonthInRange,
  isYearInRange,
  monthYearKey,
  normalizeMonthYearRange,
  periodPickerYears,
  yearRangeToMonthYears,
} from '../utils/periodPicker'
import type { PeriodGranularity } from '../utils/periodPicker'
import type { MonthYear } from '../utils/dates'

const cellBase: React.CSSProperties = {
  border: '1px solid transparent',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 'var(--font-size-2)',
  padding: '6px 4px',
  textAlign: 'center',
  transition:
    'background-color 120ms var(--motion-ease-out), color 120ms var(--motion-ease-out)',
}

function cellStyle(opts: {
  selected: boolean
  inRange: boolean
  isToday?: boolean
}): React.CSSProperties {
  if (opts.selected) {
    return {
      ...cellBase,
      background: 'var(--accent-9)',
      color: 'var(--accent-contrast)',
      fontWeight: 500,
    }
  }
  if (opts.inRange) {
    return {
      ...cellBase,
      background: 'var(--accent-3)',
      color: 'var(--gray-12)',
    }
  }
  return {
    ...cellBase,
    background: opts.isToday ? 'var(--gray-3)' : 'transparent',
    color: 'var(--gray-12)',
  }
}

/**
 * Month | Year toggle + one period popup.
 * First click sets start; second click sets inclusive end and closes.
 */
export function DateRangeControl({
  from,
  to,
  onChange,
}: {
  from: MonthYear
  to: MonthYear
  onChange: (from: MonthYear, to: MonthYear) => void
}) {
  const [granularity, setGranularity] =
    React.useState<PeriodGranularity>('year')
  const [open, setOpen] = React.useState(false)
  const [anchor, setAnchor] = React.useState<MonthYear | null>(null)
  const [hover, setHover] = React.useState<MonthYear | null>(null)
  const years = React.useMemo(() => periodPickerYears(), [])
  const now = React.useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }, [])

  const previewFrom = anchor ?? from
  const previewTo = anchor ? (hover ?? anchor) : to
  const { from: rangeFrom, to: rangeTo } = normalizeMonthYearRange(
    previewFrom,
    previewTo,
  )

  const label = formatPeriodLabel(from, to, granularity)

  const closeAndReset = React.useCallback(() => {
    setOpen(false)
    setAnchor(null)
    setHover(null)
  }, [])

  const commitRange = React.useCallback(
    (a: MonthYear, b: MonthYear) => {
      const next = normalizeMonthYearRange(a, b)
      onChange(next.from, next.to)
      closeAndReset()
    },
    [closeAndReset, onChange],
  )

  const onMonthClick = (value: MonthYear) => {
    if (!anchor) {
      setAnchor(value)
      setHover(value)
      return
    }
    commitRange(anchor, value)
  }

  const onYearClick = (year: number) => {
    const asMonthYear: MonthYear = { year, month: 1 }
    if (!anchor) {
      setAnchor(asMonthYear)
      setHover(asMonthYear)
      return
    }
    const next = yearRangeToMonthYears(anchor.year, year)
    onChange(next.from, next.to)
    closeAndReset()
  }

  return (
    <Flex align="center" gap="2" wrap="wrap" justify="end">
      <SegmentedControl.Root
        size="1"
        value={granularity}
        onValueChange={(v) => {
          setGranularity(v as PeriodGranularity)
          setAnchor(null)
          setHover(null)
        }}
      >
        <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
        <SegmentedControl.Item value="year">Year</SegmentedControl.Item>
      </SegmentedControl.Root>

      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setAnchor(null)
            setHover(null)
          }
        }}
      >
        <Popover.Trigger>
          <Button variant="soft" size="2" highContrast>
            {label}
            <NavArrowDown width={14} height={14} />
          </Button>
        </Popover.Trigger>
        <Popover.Content
          align="end"
          sideOffset={6}
          style={{
            width: granularity === 'month' ? 320 : 280,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(70vh, 480px)',
            overflowY: 'auto',
            padding: 12,
          }}
        >
          <Text size="1" color="gray" mb="2" as="div">
            {anchor
              ? 'Click the end of the period'
              : 'Click start, then end (same cell = one period)'}
          </Text>

          {granularity === 'month' ? (
            <Flex direction="column" gap="3">
              {years.map((year) => (
                <BoxYear key={year} year={year}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 4,
                    }}
                  >
                    {MONTH_OPTIONS.map((m) => {
                      const value = { year, month: m.value }
                      const key = monthYearKey(value)
                      const selected =
                        monthYearKey(rangeFrom) === key ||
                        monthYearKey(rangeTo) === key
                      const inRange = isMonthInRange(value, rangeFrom, rangeTo)
                      const isToday =
                        value.year === now.year && value.month === now.month
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-label={formatPeriodLabel(value, value, 'month')}
                          onMouseEnter={() => {
                            if (anchor) setHover(value)
                          }}
                          onClick={() => onMonthClick(value)}
                          style={cellStyle({ selected, inRange, isToday })}
                        >
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </BoxYear>
              ))}
            </Flex>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
              }}
            >
              {years.map((year) => {
                const selected =
                  rangeFrom.year === year || rangeTo.year === year
                const inRange = isYearInRange(year, rangeFrom, rangeTo)
                return (
                  <button
                    key={year}
                    type="button"
                    aria-label={String(year)}
                    onMouseEnter={() => {
                      if (anchor) setHover({ year, month: 1 })
                    }}
                    onClick={() => onYearClick(year)}
                    style={cellStyle({
                      selected,
                      inRange,
                      isToday: year === now.year,
                    })}
                  >
                    {year}
                  </button>
                )
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Root>
    </Flex>
  )
}

function BoxYear({
  year,
  children,
}: {
  year: number
  children: React.ReactNode
}) {
  return (
    <Flex direction="column" gap="1">
      <Text size="1" weight="medium" color="gray">
        {year}
      </Text>
      {children}
    </Flex>
  )
}
