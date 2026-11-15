import { describe, expect, it } from 'vitest'
import {
  formatMatterDate,
  formatMatterDuration,
  formatMatterTime,
} from './formatMatterDateTime'

describe('formatMatterDateTime', () => {
  it('formats date and time for a fixed UTC instant', () => {
    // Local timezone may shift day/hour; assert stable structure instead.
    const date = formatMatterDate('2025-12-03T14:50:00')
    expect(date).toMatch(/^\d{1,2}\. [a-z]+ \d{4}$/)
    expect(formatMatterTime('2025-12-03T14:50:00')).toMatch(/^\d{2}:\d{2}$/)
  })

  it('formats durations', () => {
    expect(
      formatMatterDuration('2025-12-03T08:00:00', '2025-12-03T16:25:00'),
    ).toBe('8hrs 25m')
    expect(
      formatMatterDuration('2025-12-03T08:00:00', '2025-12-03T10:00:00'),
    ).toBe('2hrs')
    expect(
      formatMatterDuration('2025-12-03T08:00:00', '2025-12-03T08:40:00'),
    ).toBe('40m')
  })
})
