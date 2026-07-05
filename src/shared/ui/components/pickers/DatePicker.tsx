import * as React from 'react'
import { Box, IconButton, Popover, Text } from '@radix-ui/themes'
import { Calendar } from 'iconoir-react'
import { CalendarGrid } from './CalendarGrid'
import {
  dateToLocalDate,
  formatDateLabel,
  fromLocalInput,
  getInitialMonth,
  parseIso,
} from './dateTimeUtils'
import { SinglePickerTrigger } from './PickerTrigger'
import type { PickerLocale } from './dateTimeUtils'

type Props = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  iconButton?: boolean
  iconButtonSize?: '1' | '2' | '3'
  locale?: PickerLocale
  disabled?: boolean
  invalid?: boolean
}

export default function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  iconButton = false,
  iconButtonSize = '2',
  locale = 'en',
  disabled = false,
  invalid = false,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const parsedDate = React.useMemo(() => parseIso(value), [value])
  const [currentMonth, setCurrentMonth] = React.useState(() =>
    getInitialMonth(value),
  )

  React.useEffect(() => {
    if (parsedDate) {
      setCurrentMonth(
        new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1),
      )
    }
  }, [parsedDate?.getTime()])

  const displayValue = parsedDate
    ? formatDateLabel(parsedDate, locale)
    : placeholder

  const handleDateClick = (date: Date) => {
    if (disabled) return
    const dateStr = dateToLocalDate(date)
    onChange(fromLocalInput(`${dateStr}T00:00`))
    setOpen(false)
  }

  const trigger = iconButton ? (
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
    <SinglePickerTrigger
      displayValue={displayValue}
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
    />
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
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onDateClick={handleDateClick}
            selectedDate={parsedDate}
            disabled={disabled}
          />
        </Popover.Content>
      </Popover.Root>
    </Box>
  )
}
