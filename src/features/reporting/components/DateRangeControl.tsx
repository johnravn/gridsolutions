import * as React from 'react'
import { Flex, Select, Text } from '@radix-ui/themes'
import {
  MONTH_OPTIONS,
  
  reportingYearOptions
} from '../utils/dates'
import type {MonthYear} from '../utils/dates';

function MonthYearSelects({
  value,
  onChange,
  label,
  idPrefix,
}: {
  value: MonthYear
  onChange: (next: MonthYear) => void
  label: string
  idPrefix: string
}) {
  const years = React.useMemo(() => reportingYearOptions(), [])

  return (
    <Flex align="center" gap="2" wrap="wrap">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Select.Root
        value={String(value.month)}
        onValueChange={(month) =>
          onChange({ ...value, month: Number.parseInt(month, 10) })
        }
      >
        <Select.Trigger
          aria-label={`${label} month`}
          id={`${idPrefix}-month`}
          style={{ minWidth: 96 }}
        />
        <Select.Content>
          {MONTH_OPTIONS.map((m) => (
            <Select.Item key={m.value} value={String(m.value)}>
              {m.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <Select.Root
        value={String(value.year)}
        onValueChange={(year) =>
          onChange({ ...value, year: Number.parseInt(year, 10) })
        }
      >
        <Select.Trigger
          aria-label={`${label} year`}
          id={`${idPrefix}-year`}
          style={{ minWidth: 88 }}
        />
        <Select.Content>
          {years.map((y) => (
            <Select.Item key={y} value={String(y)}>
              {y}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  )
}

/**
 * From / To month+year dropdowns for Reporting.
 * Same month/year → that month only; different → inclusive period.
 */
export function DateRangeControl({
  from,
  to,
  onChangeFrom,
  onChangeTo,
}: {
  from: MonthYear
  to: MonthYear
  onChangeFrom: (next: MonthYear) => void
  onChangeTo: (next: MonthYear) => void
}) {
  return (
    <Flex align="center" gap="3" wrap="wrap" justify="end">
      <MonthYearSelects
        label="From"
        idPrefix="reporting-from"
        value={from}
        onChange={onChangeFrom}
      />
      <MonthYearSelects
        label="To"
        idPrefix="reporting-to"
        value={to}
        onChange={onChangeTo}
      />
    </Flex>
  )
}
