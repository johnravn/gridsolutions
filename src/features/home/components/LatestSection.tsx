import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  Flex,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { RssFeed } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { groupInventoryActivities } from '@features/latest/utils/groupInventoryActivities'
import { formatActivityDate } from '@features/latest/utils/formatActivityDate'
import type {
  ActivityFeedItem,
  GroupedInventoryActivity,
} from '@features/latest/types'
import { DashboardCard } from './DashboardCard'
import {
  ScrollToBottomButton,
  useScrollButtonStyles,
} from './ScrollToBottomButton'

function getActivityIcon(
  activity: ActivityFeedItem | GroupedInventoryActivity,
): { icon: string; bgColor: string } {
  if ('isGrouped' in activity) {
    if (activity.activity_type === 'inventory_items_grouped') {
      return { icon: '📦', bgColor: 'var(--blue-3)' }
    }
    if (activity.activity_type === 'inventory_groups_grouped') {
      return { icon: '📁', bgColor: 'var(--purple-3)' }
    }
    return { icon: '📦', bgColor: 'var(--blue-3)' }
  }

  const regularActivity: ActivityFeedItem = activity

  switch (regularActivity.activity_type) {
    case 'inventory_item_created':
    case 'inventory_item_deleted':
      return { icon: '📦', bgColor: 'var(--blue-3)' }
    case 'inventory_group_created':
    case 'inventory_group_deleted':
      return { icon: '📁', bgColor: 'var(--purple-3)' }
    case 'vehicle_added':
    case 'vehicle_removed':
      return { icon: '🚗', bgColor: 'var(--green-3)' }
    case 'customer_added':
    case 'customer_removed':
      return { icon: '👤', bgColor: 'var(--orange-3)' }
    case 'crew_added':
    case 'crew_removed':
      return { icon: '👷', bgColor: 'var(--yellow-3)' }
    case 'job_created':
    case 'job_status_changed':
    case 'job_deleted':
      return { icon: '📋', bgColor: 'var(--indigo-3)' }
    case 'announcement':
      return { icon: '📢', bgColor: 'var(--red-3)' }
    default:
      return { icon: '📌', bgColor: 'var(--gray-3)' }
  }
}

function formatActivityTitle(
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

  const regularActivity: ActivityFeedItem = activity
  const metadata = regularActivity.metadata

  switch (regularActivity.activity_type) {
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
      return `Created job "${metadata.job_title || regularActivity.title || 'job'}"`
    case 'job_status_changed':
      return `Changed job "${metadata.job_title || regularActivity.title || 'job'}" status`
    case 'job_deleted':
      return `Deleted job "${metadata.job_title || regularActivity.title || 'job'}"`
    case 'announcement':
      return regularActivity.title || 'Announcement'
    default:
      return regularActivity.title || 'Activity'
  }
}

export function LatestSection({
  activities,
  loading,
  onActivityClick,
  getInitials,
  getAvatarUrl,
}: {
  activities: Array<ActivityFeedItem>
  loading: boolean
  onActivityClick: (id: string) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  useScrollButtonStyles()

  const groupedActivities = React.useMemo(
    () => groupInventoryActivities(activities),
    [activities],
  )
  const displayActivities = groupedActivities.slice(0, 10)

  React.useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const scrollableParent = scrollContainerRef.current.parentElement
        if (scrollableParent) {
          const { scrollTop, scrollHeight, clientHeight } = scrollableParent
          const isScrollable = scrollHeight > clientHeight
          const isNotAtBottom = scrollTop + clientHeight < scrollHeight - 10
          setShowScrollIndicator(isScrollable && isNotAtBottom)
        }
      }
    }

    const timeoutId = setTimeout(checkScroll, 100)
    const container = scrollContainerRef.current
    if (container) {
      const scrollableParent = container.parentElement
      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', checkScroll)
        window.addEventListener('resize', checkScroll)
        return () => {
          clearTimeout(timeoutId)
          scrollableParent.removeEventListener('scroll', checkScroll)
          window.removeEventListener('resize', checkScroll)
        }
      }
    }
    return () => clearTimeout(timeoutId)
  }, [displayActivities])

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      const scrollableParent = scrollContainerRef.current.parentElement
      if (scrollableParent) {
        scrollableParent.scrollTo({
          top: scrollableParent.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }

  return (
    <DashboardCard
      title="Latest"
      icon={<RssFeed width={18} height={18} />}
      headerAction={
        <Button
          size="2"
          variant="soft"
          onClick={() =>
            navigate({ to: '/latest', search: { activityId: undefined } })
          }
        >
          View all
        </Button>
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : groupedActivities.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No recent activity
          </Text>
        </Box>
      ) : (
        <Box
          ref={scrollContainerRef}
          style={{ position: 'relative', height: '100%' }}
        >
          <Flex direction="column" gap="2">
            {displayActivities.map((activity) => {
              const displayName =
                activity.created_by.display_name || activity.created_by.email
              const avatarUrl = getAvatarUrl(activity.created_by.avatar_url)
              const initials = getInitials(
                activity.created_by.display_name,
                activity.created_by.email,
              )

              return (
                <div
                  key={activity.id}
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => onActivityClick(activity.id)}
                >
                  <Flex gap="3" align="center" justify="between">
                    <Flex
                      gap="3"
                      align="center"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text size="3" style={{ flexShrink: 0 }}>
                        {getActivityIcon(activity).icon}
                      </Text>
                      <Flex
                        direction="column"
                        gap="1"
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <Text size="2" weight="medium">
                          {formatActivityTitle(activity)}
                        </Text>
                        <Text size="1" color="gray">
                          {formatActivityDate(activity.created_at)}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
                      <Text size="1" color="gray">
                        {displayName}
                      </Text>
                      <Avatar
                        size="2"
                        src={avatarUrl || undefined}
                        fallback={initials}
                        radius="full"
                      />
                    </Flex>
                  </Flex>
                </div>
              )
            })}
          </Flex>
          <ScrollToBottomButton
            visible={showScrollIndicator}
            isHovered={isHovered}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={scrollToBottom}
          />
        </Box>
      )}
    </DashboardCard>
  )
}
