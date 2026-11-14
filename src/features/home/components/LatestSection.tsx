import * as React from 'react'
import { Avatar, Box, Button, Flex, Text } from '@radix-ui/themes'
import { RssFeed } from 'iconoir-react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useNavigate } from '@tanstack/react-router'
import { groupInventoryActivities } from '@features/latest/utils/groupInventoryActivities'
import { formatActivityDate } from '@features/latest/utils/formatActivityDate'
import { formatActivityTitle } from '@features/latest/utils/formatActivityTitle'
import DashboardCardSkeleton from '@shared/ui/components/DashboardCardSkeleton'
import { DashboardCard } from './DashboardCard'
import {
  ScrollToBottomButton,
  useScrollButtonStyles,
} from './ScrollToBottomButton'
import type {
  ActivityFeedItem,
  GroupedInventoryActivity,
} from '@features/latest/types'

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
  const isSmallScreen = !useMediaQuery('(min-width: 1024px)')

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
      title="Logs"
      icon={<RssFeed width={18} height={18} />}
      scrollContainerStyle={
        isSmallScreen
          ? { height: '100%', maxHeight: '60vh', minHeight: 0 }
          : undefined
      }
      headerAction={
        <Button
          size="2"
          variant="soft"
          onClick={() =>
            navigate({
              to: '/company',
              search: { tab: 'logs', activityId: undefined },
            })
          }
        >
          View all
        </Button>
      }
    >
      {loading ? (
        <DashboardCardSkeleton rowCount={4} />
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
