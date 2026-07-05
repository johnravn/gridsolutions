import * as React from 'react'
import { Box, Text } from '@radix-ui/themes'
import {
  formatHourGridLabel,
  formatHourLabel,
  isHourInRange,
} from './dateTimeUtils'

type Props = {
  /** Single-select mode (multi-day tabs). */
  selectedHour?: number | null
  /** Range-select mode (same day): first click start, second click end. */
  rangeSelection?: { start: number | null; end: number | null }
  onHourClick: (hour: number) => void
  label?: string
  disabled?: boolean
}

export function HourGrid({
  selectedHour = null,
  rangeSelection,
  onHourClick,
  label = 'Hour',
  disabled = false,
}: Props) {
  const isRangeMode = rangeSelection != null

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
        {Array.from({ length: 24 }, (_, i) => i).map((h) => {
          const hourLabel = formatHourGridLabel(h)
          const hourAriaLabel = formatHourLabel(h)
          const rangePos = isRangeMode
            ? isHourInRange(h, rangeSelection.start, rangeSelection.end)
            : false
          const hourSelected = !isRangeMode && h === selectedHour

          let border = '1px solid var(--gray-6)'
          let background = 'var(--gray-2)'
          let color = 'var(--gray-12)'
          let fontWeight = 400

          if (rangePos === 'start' || rangePos === 'end' || hourSelected) {
            border = '2px solid var(--blue-7)'
            background = 'var(--blue-3)'
            color = 'var(--blue-11)'
            fontWeight = 500
          } else if (rangePos === 'between') {
            border = '1px solid var(--blue-5)'
            background = 'var(--blue-2)'
            color = 'var(--blue-11)'
          }

          const ariaLabel =
            isRangeMode || !label ? hourLabel : `${label} ${hourAriaLabel}`

          return (
            <button
              key={h}
              type="button"
              aria-label={ariaLabel}
              disabled={disabled}
              onClick={() => onHourClick(h)}
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
              {hourLabel}
            </button>
          )
        })}
      </Box>
    </Box>
  )
}
