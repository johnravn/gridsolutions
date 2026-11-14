import type { ActivityFeedItem, GroupedInventoryActivity } from '../types'

/**
 * Short human-readable title for an activity log row.
 */
export function formatActivityTitle(
  activity: ActivityFeedItem | GroupedInventoryActivity,
): string {
  if ('isGrouped' in activity) {
    const parts: Array<string> = []
    if (activity.item_count > 0) {
      parts.push(
        `${activity.item_count} ${activity.item_count === 1 ? 'item' : 'items'}`,
      )
    }
    if (activity.group_count > 0) {
      parts.push(
        `${activity.group_count} ${activity.group_count === 1 ? 'group' : 'groups'}`,
      )
    }
    return `Added ${parts.join(' and ')} to inventory`
  }

  const metadata = activity.metadata

  switch (activity.activity_type) {
    case 'inventory_item_created':
      return `Added "${metadata.item_name || 'item'}" to inventory`
    case 'inventory_item_deleted':
      return `Removed "${metadata.item_name || 'item'}" from inventory`
    case 'inventory_group_created':
      return `Created inventory group "${metadata.group_name || 'group'}"`
    case 'inventory_group_deleted':
      return `Removed inventory group "${metadata.group_name || 'group'}"`
    case 'vehicle_added':
      return `Added vehicle "${metadata.vehicle_name || metadata.license_plate || 'vehicle'}"`
    case 'vehicle_removed':
      return `Removed vehicle "${metadata.vehicle_name || metadata.license_plate || 'vehicle'}"`
    case 'customer_added':
      return `Added customer "${metadata.customer_name || 'customer'}"`
    case 'customer_removed':
      return `Removed customer "${metadata.customer_name || 'customer'}"`
    case 'crew_added':
      return `Added crew member "${metadata.user_name || metadata.email || 'crew'}"`
    case 'crew_removed':
      return `Removed crew member "${metadata.user_name || metadata.email || 'crew'}"`
    case 'job_created':
      return `Created job "${metadata.job_title || activity.title || 'job'}"`
    case 'job_status_changed':
      return `Changed job "${metadata.job_title || activity.title || 'job'}" status`
    case 'job_deleted':
      return `Deleted job "${metadata.job_title || activity.title || 'job'}"`
    case 'announcement':
      return activity.title || 'Announcement'
  }
}

export function activityEntityLabel(
  activityType: ActivityFeedItem['activity_type'],
): string {
  switch (activityType) {
    case 'inventory_item_created':
    case 'inventory_item_deleted':
      return 'inventory_item'
    case 'inventory_group_created':
    case 'inventory_group_deleted':
      return 'inventory_group'
    case 'vehicle_added':
    case 'vehicle_removed':
      return 'vehicle'
    case 'customer_added':
    case 'customer_removed':
      return 'customer'
    case 'crew_added':
    case 'crew_removed':
      return 'crew'
    case 'job_created':
    case 'job_status_changed':
    case 'job_deleted':
      return 'job'
    case 'announcement':
      return 'announcement'
  }
}

/** Absolute timestamp for dense log rows. */
export function formatLogTimestamp(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return createdAt
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
