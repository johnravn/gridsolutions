import { describe, expect, it } from 'vitest'
import { makeActivityFeedItem } from '@test/fixtures/latest'
import {
  activityEntityLabel,
  formatActivityTitle,
  formatLogTimestamp,
} from './formatActivityTitle'

describe('formatActivityTitle', () => {
  it('formats inventory create with item name', () => {
    const item = makeActivityFeedItem({
      activity_type: 'inventory_item_created',
      metadata: { item_name: 'Cable' },
    })
    expect(formatActivityTitle(item)).toBe('Added "Cable" to inventory')
  })

  it('maps entity labels', () => {
    expect(activityEntityLabel('job_created')).toBe('job')
    expect(activityEntityLabel('announcement')).toBe('announcement')
  })

  it('formats absolute log timestamps', () => {
    const stamp = formatLogTimestamp('2026-11-14T13:05:09.000Z')
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})
