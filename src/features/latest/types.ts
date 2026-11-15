// src/features/latest/types.ts

export type ActivityType =
  | 'inventory_item_created'
  | 'inventory_item_deleted'
  | 'inventory_group_created'
  | 'inventory_group_deleted'
  | 'vehicle_added'
  | 'vehicle_removed'
  | 'customer_added'
  | 'customer_removed'
  | 'crew_added'
  | 'crew_removed'
  | 'job_created'
  | 'job_status_changed'
  | 'job_deleted'
  | 'announcement'

export type ActivityLogRow = {
  id: string
  company_id: string
  activity_type: ActivityType
  created_by_user_id: string
  created_at: string
  metadata: Record<string, unknown>
  title: string | null
  description: string | null
  deleted: boolean
}

export type ActivityFeedItem = ActivityLogRow & {
  created_by: {
    user_id: string
    display_name: string | null
    avatar_url: string | null
    email: string
  }
  like_count: number
  comment_count: number
  user_liked: boolean
}

/** Client-side grouped inventory rows for Company Logs / formatters. */
export type GroupedInventoryActivity = {
  id: string // Composite ID based on grouped items
  isGrouped: true
  activity_type:
    | 'inventory_items_grouped'
    | 'inventory_groups_grouped'
    | 'inventory_mixed_grouped'
  created_by_user_id: string
  created_at: string // Earliest timestamp in the group
  created_by: ActivityFeedItem['created_by']
  items: Array<ActivityFeedItem> // The individual activities in this group
  item_count: number
  group_count: number
  like_count: number
  comment_count: number
  user_liked: boolean
}

export type DisplayActivityItem = ActivityFeedItem | GroupedInventoryActivity
