import { SegmentedControl } from '@radix-ui/themes'
import type { ReportSegment } from '../types'

const SEGMENTS: Array<{ value: ReportSegment; label: string }> = [
  { value: 'jobs', label: 'Job profitability' },
  { value: 'customers', label: 'Customer profitability' },
  { value: 'utilization', label: 'Utilization' },
  { value: 'low-margin', label: 'Low margin' },
  { value: 'monthly', label: 'Monthly P&L' },
  { value: 'invoice', label: 'Invoice pipeline' },
]

export function SegmentTabs({
  value,
  onChange,
}: {
  value: ReportSegment
  onChange: (v: ReportSegment) => void
}) {
  return (
    <SegmentedControl.Root
      value={value}
      onValueChange={(v) => onChange(v as ReportSegment)}
    >
      {SEGMENTS.map((s) => (
        <SegmentedControl.Item key={s.value} value={s.value}>
          {s.label}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  )
}
