import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatActivityDate } from './formatActivityDate'

describe('formatActivityDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns relative time for recent activities', () => {
    const result = formatActivityDate('2026-06-14T12:00:00.000Z')
    expect(result).toMatch(/day/i)
  })

  it('returns absolute date for activities older than 3 days', () => {
    const result = formatActivityDate('2026-06-01T10:00:00.000Z')
    expect(result).toMatch(/1\. juni 2026/)
  })
})
