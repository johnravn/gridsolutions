import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Badge,
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  ScrollArea,
  Separator,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { Bell, Check, NavArrowRight } from 'iconoir-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  getUnreadMatterEntityIds,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQuery,
  unreadNotificationsCountQuery,
  type Notification,
} from '../api/queries'
import { markMatterAsViewed } from '@features/matters/api/queries'

export function NotificationCenter({
  userId,
  companyId,
  onNavigateClick,
}: {
  userId: string
  companyId: string | null
  /** Called when navigating to /notifications (e.g. to close mobile sidebar) */
  onNavigateClick?: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const { data: notifications = [], isLoading } = useQuery({
    ...notificationsQuery({
      userId,
      companyId,
      unreadOnly: false,
      limit: 20,
    }),
    enabled: open && !!userId,
  })

  const { data: unreadCount = 0 } = useQuery({
    ...unreadNotificationsCountQuery({ userId, companyId }),
    enabled: !!userId,
  })

  const handleMarkRead = React.useCallback(
    async (e: React.MouseEvent, n: Notification) => {
      e.preventDefault()
      e.stopPropagation()
      await markNotificationRead(n.id)
      if (n.entity_type === 'matter' && n.entity_id) {
        try {
          await markMatterAsViewed(n.entity_id)
        } catch {
          /* non-blocking */
        }
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['matters'] })
    },
    [queryClient]
  )

  const handleMarkAllRead = React.useCallback(async () => {
    const matterIds = await getUnreadMatterEntityIds(userId, companyId)
    await markAllNotificationsRead(userId, companyId)
    for (const matterId of matterIds) {
      try {
        await markMatterAsViewed(matterId)
      } catch {
        /* non-blocking */
      }
    }
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['matters'] })
    setOpen(false)
  }, [userId, companyId, queryClient])

  const handleNotificationClick = React.useCallback(
    (n: Notification) => {
      if (n.entity_type === 'matter' && n.entity_id) {
        navigate({ to: '/matters', search: { matterId: n.entity_id } })
      } else if (n.entity_type === 'job' && n.entity_id) {
        navigate({ to: '/jobs', search: { jobId: n.entity_id, tab: undefined } })
      } else if (n.action_url) {
        navigate({ to: n.action_url as '/' })
      }
      if (!n.read_at) {
        markNotificationRead(n.id).then(async () => {
          if (n.entity_type === 'matter' && n.entity_id) {
            try {
              await markMatterAsViewed(n.entity_id)
            } catch {
              /* non-blocking */
            }
          }
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          queryClient.invalidateQueries({ queryKey: ['matters'] })
        })
      }
      setOpen(false)
    },
    [navigate, queryClient]
  )

  // On mobile: redirect to notifications page instead of dropdown (better touch UX)
  if (isMobile) {
    return (
      <Tooltip content="Notifications" delayDuration={300}>
        <IconButton
          size="2"
          variant="ghost"
          aria-label="Notifications"
          style={{ position: 'relative' }}
          asChild
        >
          <Link
            to="/notifications"
            onClick={onNavigateClick}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell width={20} height={20} />
            {unreadCount > 0 && (
              <Badge
                size="1"
                radius="full"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  fontSize: 11,
                  backgroundColor: 'var(--accent-9)',
                  color: 'white',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Link>
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <Tooltip content="Notifications" delayDuration={300}>
        <DropdownMenu.Trigger>
          <IconButton
            size="2"
            variant="ghost"
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            <Bell width={20} height={20} />
            {unreadCount > 0 && (
              <Badge
                size="1"
                radius="full"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  fontSize: 11,
                  backgroundColor: 'var(--accent-9)',
                  color: 'white',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </IconButton>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Content align="end" style={{ width: 380, maxWidth: '95vw' }}>
        <Flex justify="between" align="center" px="3" py="2">
          <Text size="2" weight="bold">
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={handleMarkAllRead}
            >
              <Check /> Mark all read
            </Button>
          )}
        </Flex>
        <Separator size="4" />
        <ScrollArea style={{ maxHeight: 400 }}>
          <Box py="2">
            {isLoading ? (
              <Flex justify="center" py="4">
                <Text size="2" color="gray">
                  Loading…
                </Text>
              </Flex>
            ) : notifications.length === 0 ? (
              <Flex justify="center" py="4">
                <Text size="2" color="gray">
                  No notifications
                </Text>
              </Flex>
            ) : (
              notifications.map((n) => (
                <Box
                  key={n.id}
                  px="3"
                  py="2"
                  style={{
                    cursor: 'pointer',
                    backgroundColor: n.read_at ? undefined : 'var(--blue-a2)',
                    borderLeft: n.read_at
                      ? undefined
                      : '3px solid var(--blue-9)',
                  }}
                  onClick={() => handleNotificationClick(n)}
                >
                  <Flex justify="between" align="start" gap="2">
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" weight="medium">
                        {n.title}
                      </Text>
                      {n.body_text && (
                        <Text size="1" color="gray" style={{ lineHeight: 1.4 }}>
                          {n.body_text.length > 120
                            ? n.body_text.slice(0, 120) + '…'
                            : n.body_text}
                        </Text>
                      )}
                      <Text size="1" color="gray">
                        {format(new Date(n.created_at), 'd. MMM HH:mm', {
                          locale: nb,
                        })}
                      </Text>
                    </Flex>
                    {!n.read_at && (
                      <IconButton
                        size="1"
                        variant="ghost"
                        aria-label="Mark as read"
                        onClick={(e) => handleMarkRead(e, n)}
                      >
                        <Check />
                      </IconButton>
                    )}
                  </Flex>
                </Box>
              ))
            )}
          </Box>
        </ScrollArea>
        <Separator size="4" />
        <Box px="3" py="2">
          <Button
            size="2"
            variant="soft"
            color="gray"
            asChild
            style={{ width: '100%' }}
            onClick={() => setOpen(false)}
          >
            <Link to="/notifications">
              View all & preferences
              <NavArrowRight />
            </Link>
          </Button>
        </Box>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
