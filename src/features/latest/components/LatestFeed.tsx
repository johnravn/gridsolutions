// src/features/latest/components/LatestFeed.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Flex, Spinner, Text } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { formatDistanceToNow } from 'date-fns'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import { latestFeedQuery } from '../api/queries'
import { groupInventoryActivities } from '../utils/groupInventoryActivities'
import { getActivityGenericMessage } from '../utils/activityNavigation'
import type { ActivityType, GroupedInventoryActivity } from '../types'

// Using shared getInitialsFromNameOrEmail from generalFunctions
const getInitials = getInitialsFromNameOrEmail

function getActivityIcon(
  activityType: ActivityType | GroupedInventoryActivity['activity_type'],
): string {
  switch (activityType) {
    case 'inventory_item_created':
    case 'inventory_item_deleted':
    case 'inventory_items_grouped':
      return '📦'
    case 'inventory_group_created':
    case 'inventory_group_deleted':
    case 'inventory_groups_grouped':
      return '📁'
    case 'inventory_mixed_grouped':
      return '📦' // Mixed groups default to box icon
    case 'vehicle_added':
    case 'vehicle_removed':
      return '🚗'
    case 'customer_added':
    case 'customer_removed':
      return '👤'
    case 'crew_added':
    case 'crew_removed':
      return '👷'
    case 'job_created':
    case 'job_status_changed':
    case 'job_deleted':
      return '📋'
    case 'announcement':
      return '📢'
    default:
      return '📌'
  }
}

export default function LatestFeed({
  selectedId,
  onSelect,
  activityTypes,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  activityTypes?: Array<ActivityType>
}) {
  const { companyId } = useCompany()
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      activityTypes,
      limit: 100,
    }),
    enabled: !!companyId,
  })

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  }

  if (isError) {
    return (
      <Text color="red" size="2">
        Failed to load feed
      </Text>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <Box py="6">
        <Text color="gray" size="2" align="center">
          No activity yet
        </Text>
      </Box>
    )
  }

  // Group inventory activities
  const groupedActivities = groupInventoryActivities(data.items)

  return (
    <Box>
      {groupedActivities.map((activity) => {
        // Calculate avatar URL without using hooks
        const avatarUrl = activity.created_by.avatar_url
          ? supabase.storage
              .from('avatars')
              .getPublicUrl(activity.created_by.avatar_url).data.publicUrl
          : null

        const displayName =
          activity.created_by.display_name || activity.created_by.email
        const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
          addSuffix: true,
        })

        const isSelected = selectedId === activity.id
        const isHovered = hoveredId === activity.id

        return (
          <React.Fragment key={activity.id}>
            <Box
              style={{
                cursor: 'pointer',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-3)',
                backgroundColor: isSelected
                  ? 'var(--accent-3)'
                  : isHovered
                    ? 'var(--gray-2)'
                    : 'transparent',
                border: isSelected
                  ? '1px solid transparent'
                  : isHovered
                    ? '1px solid var(--gray-a6)'
                    : '1px solid transparent',
                transition:
                  'background-color 0.15s ease, border-color 0.15s ease',
              }}
              onClick={() => onSelect(activity.id)}
              onMouseEnter={() => setHoveredId(activity.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Flex gap="3" align="start" justify="between">
                <Flex gap="3" align="start" style={{ flex: 1, minWidth: 0 }}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-2)',
                      backgroundColor: 'var(--accent-3)',
                      flexShrink: 0,
                    }}
                  >
                    <Text size="4">
                      {getActivityIcon(activity.activity_type)}
                    </Text>
                  </Flex>

                  <Box style={{ flex: 1, minWidth: 0 }}>
                    {/* Title only */}
                    <Text size="2" style={{ lineHeight: 1.5 }} mb="1">
                      {getActivityGenericMessage(
                        'isGrouped' in activity
                          ? 'grouped_inventory'
                          : activity.activity_type,
                      )}
                    </Text>

                    <Flex align="center" gap="3" mt="2">
                      <Text size="1" color="gray">
                        {timeAgo}
                      </Text>
                      {activity.like_count > 0 && (
                        <Text size="1" color="gray">
                          ❤️ {activity.like_count}
                        </Text>
                      )}
                      {activity.comment_count > 0 && (
                        <Text size="1" color="gray">
                          💬 {activity.comment_count}
                        </Text>
                      )}
                    </Flex>
                  </Box>
                </Flex>

                <Flex
                  align="center"
                  gap="2"
                  style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}
                >
                  <Text size="2" weight="medium">
                    {displayName}
                  </Text>
                  <Avatar
                    size="1"
                    radius="full"
                    src={avatarUrl ?? undefined}
                    fallback={getInitials(
                      activity.created_by.display_name,
                      activity.created_by.email,
                    )}
                  />
                </Flex>
              </Flex>
            </Box>
          </React.Fragment>
        )
      })}
    </Box>
  )
}
