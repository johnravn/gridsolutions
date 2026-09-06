import { Box, SegmentedControl } from '@radix-ui/themes'
import { DATE_RANGES } from '../utils/dates'

export function DateRangeControl({
  rangeIndex,
  onChange,
}: {
  rangeIndex: number
  onChange: (index: number) => void
}) {
  return (
    <Box className="segmented-control-scroller">
      <SegmentedControl.Root
        value={DATE_RANGES[rangeIndex].label}
        onValueChange={(v) => {
          const i = DATE_RANGES.findIndex((r) => r.label === v)
          if (i >= 0) onChange(i)
        }}
      >
        {DATE_RANGES.map((r) => (
          <SegmentedControl.Item key={r.label} value={r.label}>
            {r.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </Box>
  )
}
