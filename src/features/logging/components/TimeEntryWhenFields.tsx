import { Box, Flex, SegmentedControl, Text, TextField } from '@radix-ui/themes'
import { DatePicker, DateTimeRangePicker } from '@shared/ui/components/pickers'
import {
  formatHoursInput,
  hoursFromRangeOrDefault,
  hoursToRange,
  isValidLoggedHours,
  parseHoursInput,
} from '../lib/timeEntryHours'
import type { TimeInputMode } from '../lib/timeEntryHours'

export default function TimeEntryWhenFields({
  mode,
  onModeChange,
  startAt,
  endAt,
  onRangeChange,
  hoursInput,
  onHoursInputChange,
  rangeInvalid = false,
  disabled = false,
}: {
  mode: TimeInputMode
  onModeChange: (mode: TimeInputMode) => void
  startAt: string
  endAt: string
  onRangeChange: (range: { startAt: string; endAt: string }) => void
  hoursInput: string
  onHoursInputChange: (value: string) => void
  rangeInvalid?: boolean
  disabled?: boolean
}) {
  const parsedHours = parseHoursInput(hoursInput)
  const hoursInvalid = !isValidLoggedHours(parsedHours)

  const switchMode = (next: string) => {
    if (disabled) return
    const nextMode = next as TimeInputMode
    if (nextMode === mode) return
    if (nextMode === 'hours') {
      const hours = hoursFromRangeOrDefault(startAt, endAt)
      onHoursInputChange(formatHoursInput(hours))
      onRangeChange(hoursToRange(startAt || new Date().toISOString(), hours))
    }
    onModeChange(nextMode)
  }

  const handleDateChange = (iso: string) => {
    const hours = isValidLoggedHours(parsedHours)
      ? parsedHours
      : hoursFromRangeOrDefault(startAt, endAt)
    onRangeChange(hoursToRange(iso, hours))
  }

  const handleHoursChange = (value: string) => {
    onHoursInputChange(value)
    const hours = parseHoursInput(value)
    if (!isValidLoggedHours(hours) || !startAt) return
    onRangeChange(hoursToRange(startAt, hours))
  }

  return (
    <Flex direction="column" gap="3">
      <label>
        <Text as="div" size="2" mb="1" weight="medium">
          Time
        </Text>
        <SegmentedControl.Root
          value={mode}
          onValueChange={switchMode}
          style={{
            width: '100%',
            pointerEvents: disabled ? 'none' : undefined,
            opacity: disabled ? 0.6 : undefined,
          }}
        >
          <SegmentedControl.Item value="range">
            Start to end
          </SegmentedControl.Item>
          <SegmentedControl.Item value="hours">Hours</SegmentedControl.Item>
        </SegmentedControl.Root>
      </label>

      {mode === 'range' ? (
        <Box>
          <Text as="div" size="2" mb="1" weight="medium">
            Time period
          </Text>
          <DateTimeRangePicker
            startAt={startAt}
            endAt={endAt}
            onChange={onRangeChange}
            invalid={rangeInvalid}
            disabled={disabled}
            locale="nb"
          />
        </Box>
      ) : (
        <Flex gap="3" wrap="wrap" align="start">
          <Box style={{ flex: '1 1 180px', minWidth: 180 }}>
            <Text as="div" size="2" mb="1" weight="medium">
              Date
            </Text>
            <DatePicker
              value={startAt}
              onChange={handleDateChange}
              disabled={disabled}
              locale="nb"
            />
          </Box>
          <Box style={{ flex: '0 0 140px', width: 140 }}>
            <Text as="div" size="2" mb="1" weight="medium">
              Hours
            </Text>
            <TextField.Root
              type="text"
              inputMode="decimal"
              value={hoursInput}
              onChange={(e) => handleHoursChange(e.target.value)}
              placeholder="e.g. 7.5"
              disabled={disabled}
              color={hoursInvalid ? 'red' : undefined}
              aria-label="Hours"
              aria-invalid={hoursInvalid}
            />
            {hoursInvalid && (
              <Text size="1" color="red" mt="1">
                Enter hours greater than 0, up to 24
              </Text>
            )}
          </Box>
        </Flex>
      )}
    </Flex>
  )
}
