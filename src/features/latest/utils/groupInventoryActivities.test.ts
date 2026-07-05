import { describe, expect, it } from 'vitest'
import { makeActivityFeedItem } from '@test/fixtures/latest'
import { groupInventoryActivities } from './groupInventoryActivities'

describe('groupInventoryActivities', () => {
  it('returns non-inventory activities unchanged', () => {
    const activity = makeActivityFeedItem({
      activity_type: 'job_created',
    })
    const result = groupInventoryActivities([activity])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(activity)
  })

  it('groups inventory additions within 1 hour by same user', () => {
    const result = groupInventoryActivities([
      makeActivityFeedItem({
        id: 'a2',
        activity_type: 'inventory_item_created',
        created_at: '2026-06-01T10:30:00.000Z',
        metadata: { item_id: 'i2' },
      }),
      makeActivityFeedItem({
        id: 'a1',
        activity_type: 'inventory_item_created',
        created_at: '2026-06-01T10:00:00.000Z',
        metadata: { item_id: 'i1' },
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ isGrouped: true, item_count: 2 })
  })

  it('does not group activities beyond 1 hour apart', () => {
    const result = groupInventoryActivities([
      makeActivityFeedItem({
        id: 'a1',
        activity_type: 'inventory_item_created',
        created_at: '2026-06-01T10:00:00.000Z',
      }),
      makeActivityFeedItem({
        id: 'a2',
        activity_type: 'inventory_item_created',
        created_at: '2026-06-01T12:00:00.000Z',
      }),
    ])

    expect(result).toHaveLength(2)
  })

  it('does not group activities from different users', () => {
    const result = groupInventoryActivities([
      makeActivityFeedItem({
        id: 'a1',
        activity_type: 'inventory_item_created',
        created_at: '2026-06-01T10:00:00.000Z',
        created_by_user_id: 'user-a',
      }),
      makeActivityFeedItem({
        id: 'a2',
        activity_type: 'inventory_item_created',
        created_at: '2026-06-01T10:15:00.000Z',
        created_by_user_id: 'user-b',
        created_by: {
          user_id: 'user-b',
          display_name: 'Other',
          avatar_url: null,
          email: 'other@test.local',
        },
      }),
    ])

    expect(result).toHaveLength(2)
  })
})
