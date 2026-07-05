import * as React from 'react'
import { Box, Popover, Text } from '@radix-ui/themes'
import { HourGrid } from './HourGrid'
import { SinglePickerTrigger } from './PickerTrigger'
import { atHour, formatHourLabel, parseIso, toLocalDate } from './dateTimeUtils'
import type { PickerLocale } from './dateTimeUtils'

type Props = {
  value: string | null
  onChange: (value: string | null) => void
  referenceDate?: string
  label?: string
  placeholder?: string
  locale?: PickerLocale
  disabled?: boolean
  invalid?: boolean
}

export default function TimeOfDayPicker({
  value,
  onChange,
  referenceDate,
  label,
  placeholder = 'Select time',
  disabled = false,
  invalid = false,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const parsed = React.useMemo(() => (value ? parseIso(value) : null), [value])

  const selectedHour = parsed ? parsed.getHours() : null

  const displayValue =
    selectedHour != null ? formatHourLabel(selectedHour) : placeholder

  const handleHourClick = (hour: number) => {
    if (disabled) return
    const date =
      referenceDate ??
      (parsed
        ? toLocalDate(parsed.toISOString())
        : toLocalDate(new Date().toISOString()))
    onChange(atHour(date, hour))
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setOpen(false)
  }

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
          <SinglePickerTrigger
            displayValue={displayValue}
            placeholder={placeholder}
            invalid={invalid}
            disabled={disabled}
          />
        </Popover.Trigger>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          style={{
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 10001,
          }}
        >
          <HourGrid
            selectedHour={selectedHour}
            onHourClick={handleHourClick}
            disabled={disabled}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                marginTop: 12,
                padding: '6px 12px',
                border: '1px solid var(--gray-6)',
                borderRadius: 4,
                background: 'var(--gray-2)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-2)',
                width: '100%',
              }}
            >
              Clear
            </button>
          )}
        </Popover.Content>
      </Popover.Root>
    </Box>
  )
}
