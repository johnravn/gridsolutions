import * as React from 'react'
import { Box, Text } from '@radix-ui/themes'
import {
  buildMinuteOptions,
  formatMinuteGridLabel,
  formatTimeLabel,
  isMinuteInRange,
} from './dateTimeUtils'

type Props = {
  step?: number
  selectedMinute?: number | null
  rangeSelection?: { start: number | null; end: number | null }
  onMinuteClick: (minute: number) => void
  label?: string
  disabled?: boolean
}

export function MinuteGrid({
  step = 5,
  selectedMinute = null,
  rangeSelection,
  onMinuteClick,
  label = 'Minute',
  disabled = false,
}: Props) {
  const isRangeMode = rangeSelection != null
  const minutes = buildMinuteOptions(step)

  return (
    <Box>
      {label && (
        <Text size="1" color="gray" mb="2">
          {label}
        </Text>
      )}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 8,
        }}
      >
        {minutes.map((m) => {
          const minuteLabel = formatMinuteGridLabel(m)
          const minuteAriaLabel = formatTimeLabel(0, m).slice(3)
          const rangePos = isRangeMode
            ? isMinuteInRange(m, rangeSelection.start, rangeSelection.end)
            : false
          const minuteSelected = !isRangeMode && m === selectedMinute

          let border = '1px solid var(--gray-6)'
          let background = 'var(--gray-2)'
          let color = 'var(--gray-12)'
          let fontWeight = 400

          if (rangePos === 'start' || rangePos === 'end' || minuteSelected) {
            border = '2px solid var(--blue-7)'
            background = 'var(--blue-3)'
            color = 'var(--blue-11)'
            fontWeight = 500
          }

          const ariaLabel =
            isRangeMode || !label ? minuteLabel : `${label} :${minuteAriaLabel}`

          return (
            <button
              key={m}
              type="button"
              aria-label={ariaLabel}
              disabled={disabled}
              onClick={() => onMinuteClick(m)}
              style={{
                padding: '8px 4px',
                borderRadius: 6,
                border,
                background,
                color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-1)',
                fontWeight,
                transition: 'all 0.15s',
                textAlign: 'center',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {minuteLabel}
            </button>
          )
        })}
      </Box>
    </Box>
  )
}
