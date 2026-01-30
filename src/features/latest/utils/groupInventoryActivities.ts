// src/features/latest/utils/groupInventoryActivities.ts
import type {
  ActivityFeedItem,
  DisplayActivityItem,
  GroupedInventoryActivity,
} from '../types'

const GROUPING_TIME_WINDOW_MS = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Groups inventory addition activities (items and groups) within a 1-hour window
 * by the same user into a single display entry.
 */
export function groupInventoryActivities(
  activities: Array<ActivityFeedItem>,
): Array<DisplayActivityItem> {
  const result: Array<DisplayActivityItem> = []
  const inventoryAdditionTypes = new Set([
    'inventory_item_created',
    'inventory_group_created',
  ])

  let i = 0
  while (i < activities.length) {
    const activity = activities[i]

    // If this is an inventory addition and there might be more to group
    if (
      inventoryAdditionTypes.has(activity.activity_type) &&
      i < activities.length - 1
    ) {
      const group: Array<ActivityFeedItem> = [activity]
      const baseTime = new Date(activity.created_at).getTime()
      const userId = activity.created_by_user_id

      // Look ahead to find activities that should be grouped together
      let j = i + 1
      while (j < activities.length) {
        const nextActivity = activities[j]

        // Check if next activity should be grouped:
        // 1. Same user
        // 2. Same activity type (item or group creation)
        // 3. Within 1-hour window
        // 4. No other activity types in between
        const nextTime = new Date(nextActivity.created_at).getTime()
        const timeDiff = baseTime - nextTime // baseTime is earlier (activities are sorted desc)

        const shouldGroup =
          inventoryAdditionTypes.has(nextActivity.activity_type) &&
          nextActivity.created_by_user_id === userId &&
          timeDiff >= 0 &&
          timeDiff <= GROUPING_TIME_WINDOW_MS

        if (shouldGroup) {
          group.push(nextActivity)
          j++
        } else {
          break
        }
      }

      // If we have a group of 2 or more, create a grouped entry
      if (group.length >= 2) {
        // Sort group by time (earliest first for display)
        group.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )

        const items = group.filter(
          (a) => a.activity_type === 'inventory_item_created',
        )
        const groups = group.filter(
          (a) => a.activity_type === 'inventory_group_created',
        )

        // Determine the grouped activity type
        let groupedType: GroupedInventoryActivity['activity_type']
        if (items.length > 0 && groups.length > 0) {
          groupedType = 'inventory_mixed_grouped'
        } else if (items.length > 0) {
          groupedType = 'inventory_items_grouped'
        } else {
          groupedType = 'inventory_groups_grouped'
        }

        // Aggregate like counts, comment counts, and check user liked
        const totalLikes = group.reduce((sum, a) => sum + a.like_count, 0)
        const totalComments = group.reduce((sum, a) => sum + a.comment_count, 0)
        const userLiked = group.some((a) => a.user_liked)

        // Create composite ID from all activity IDs
        const compositeId = `grouped_${group.map((a) => a.id).join('_')}`

        const grouped: GroupedInventoryActivity = {
          id: compositeId,
          isGrouped: true,
          activity_type: groupedType,
          created_by_user_id: userId,
          created_at: group[0].created_at, // Earliest timestamp
          created_by: activity.created_by,
          items: group,
          item_count: items.length,
          group_count: groups.length,
          like_count: totalLikes,
          comment_count: totalComments,
          user_liked: userLiked,
        }

        result.push(grouped)
        i = j // Skip the grouped activities
      } else {
        // Single activity, no grouping needed
        result.push(activity)
        i++
      }
    } else {
      // Not an inventory addition or can't be grouped, add as-is
      result.push(activity)
      i++
    }
  }

  return result
}
