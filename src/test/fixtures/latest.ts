import type { ActivityFeedItem } from '@features/latest/types'

const baseAuthor = {
  user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  display_name: 'Test User',
  avatar_url: null,
  email: 'user@test.grid.local',
}

export function makeActivityFeedItem(
  overrides: Partial<ActivityFeedItem> = {},
): ActivityFeedItem {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    company_id: '11111111-1111-4111-8111-111111111111',
    activity_type: 'inventory_item_created',
    created_by_user_id: baseAuthor.user_id,
    created_at: '2026-06-01T10:00:00.000Z',
    metadata: { item_name: 'Cable' },
    title: 'Added Cable',
    description: null,
    deleted: false,
    created_by: baseAuthor,
    like_count: 0,
    comment_count: 0,
    user_liked: false,
    ...overrides,
  }
}
