// src/features/latest/utils/activityNavigation.ts
import type { ActivityFeedItem, ActivityType } from '../types'

export type NavigationInfo = {
  route: string
  searchParam: string
  id: string | null
}

export type ActivityButtonInfo = {
  label: string
  iconName: 'BoxIso' | 'Car' | 'UserLove' | 'Group' | 'GoogleDocs'
  color: 'blue' | 'green' | 'orange' | 'yellow' | 'indigo'
}

/**
 * Gets navigation information for an activity type
 * Returns null if the activity doesn't support navigation
 */
function metaString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function getActivityNavigation(
  activity: ActivityFeedItem,
): NavigationInfo | null {
  const metadata = activity.metadata

  switch (activity.activity_type) {
    case 'inventory_item_created':
      return {
        route: '/inventory',
        searchParam: 'inventoryId',
        id: metaString(metadata, 'item_id'),
      }
    case 'inventory_group_created':
      return {
        route: '/inventory',
        searchParam: 'inventoryId',
        id: metaString(metadata, 'group_id'),
      }
    case 'vehicle_added':
      return {
        route: '/vehicles',
        searchParam: 'vehicleId',
        id: metaString(metadata, 'vehicle_id'),
      }
    case 'customer_added':
      return {
        route: '/customers',
        searchParam: 'customerId',
        id: metaString(metadata, 'customer_id'),
      }
    case 'crew_added':
      return {
        route: '/crew',
        searchParam: 'userId',
        id: metaString(metadata, 'user_id'),
      }
    case 'job_created':
    case 'job_status_changed':
      return {
        route: '/jobs',
        searchParam: 'jobId',
        id: metaString(metadata, 'job_id'),
      }
    default:
      return null
  }
}

/**
 * Gets button info (label, icon, color) for an activity type
 */
export function getActivityButtonInfo(
  activityType: ActivityType,
): ActivityButtonInfo | null {
  switch (activityType) {
    case 'inventory_item_created':
    case 'inventory_group_created':
      return {
        label: 'Show item',
        iconName: 'BoxIso',
        color: 'blue',
      }
    case 'vehicle_added':
      return {
        label: 'Show vehicle',
        iconName: 'Car',
        color: 'green',
      }
    case 'customer_added':
      return {
        label: 'Show customer',
        iconName: 'UserLove',
        color: 'orange',
      }
    case 'crew_added':
      return {
        label: 'Show crew',
        iconName: 'Group',
        color: 'yellow',
      }
    case 'job_created':
    case 'job_status_changed':
      return {
        label: 'Show job',
        iconName: 'GoogleDocs',
        color: 'indigo',
      }
    default:
      return null
  }
}

/**
 * Gets a generic short message for an activity type
 */
export function getActivityGenericMessage(
  activityType: ActivityType | 'grouped_inventory',
): string {
  switch (activityType) {
    case 'inventory_item_created':
    case 'grouped_inventory':
      return 'New items added'
    case 'inventory_item_deleted':
      return 'Item removed'
    case 'inventory_group_created':
      return 'New group created'
    case 'inventory_group_deleted':
      return 'Group removed'
    case 'vehicle_added':
      return 'New vehicle added'
    case 'vehicle_removed':
      return 'Vehicle removed'
    case 'customer_added':
      return 'New customer added'
    case 'customer_removed':
      return 'Customer removed'
    case 'crew_added':
      return 'New crew member added'
    case 'crew_removed':
      return 'Crew member removed'
    case 'job_created':
      return 'New job created'
    case 'job_status_changed':
      return 'Job status changed'
    case 'job_deleted':
      return 'Job deleted'
    case 'announcement':
      return 'Announcement'
    default:
      return 'Activity update'
  }
}
