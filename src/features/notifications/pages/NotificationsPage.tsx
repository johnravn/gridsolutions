import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import { markMatterAsViewed } from '@features/matters/api/queries'
import {
  getUnreadMatterEntityIds,
  markAllNotificationsRead,
  markNotificationRead,
  notificationPreferencesQuery,
  notificationsQuery,
  upsertNotificationPreferences,
} from '../api/queries'
import type { Notification } from '../api/queries'

export default function NotificationsPage() {
  const { companyId } = useCompany()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()

  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })
  const userId = authUser?.id ?? ''

  const { data: notifications = [], isLoading } = useQuery({
    ...notificationsQuery({
      userId,
      companyId,
      unreadOnly: false,
      limit: 100,
    }),
    enabled: !!userId,
  })

  const { data: prefs } = useQuery({
    ...notificationPreferencesQuery({
      userId,
      companyId: companyId ?? '',
    }),
    enabled: !!userId && !!companyId,
  })

  const [localPrefs, setLocalPrefs] = React.useState({
    email_offer_updates: true,
    email_crew_invites: true,
    email_matter_replies: true,
    email_reminders: true,
    email_announcements: true,
  })

  React.useEffect(() => {
    if (prefs) {
      setLocalPrefs({
        email_offer_updates: prefs.email_offer_updates,
        email_crew_invites: prefs.email_crew_invites,
        email_matter_replies: prefs.email_matter_replies,
        email_reminders: prefs.email_reminders,
        email_announcements: prefs.email_announcements,
      })
    }
  }, [prefs])

  const savePrefsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company')
      await upsertNotificationPreferences({
        user_id: userId,
        company_id: companyId,
        ...localPrefs,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      success(
        'Preferences saved',
        'Your email notification preferences have been updated.',
      )
    },
    onError: (e: Error) => {
      toastError('Failed to save preferences', e.message || 'Please try again.')
    },
  })

  const handleMarkAllRead = async () => {
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
  }

  const handleNotificationClick = (n: Notification) => {
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
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  // Sort: unread first, then by created_at descending
  const sortedNotifications = React.useMemo(
    () =>
      [...notifications].sort((a, b) => {
        const aUnread = !a.read_at ? 1 : 0
        const bUnread = !b.read_at ? 1 : 0
        if (aUnread !== bUnread) return bUnread - aUnread
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }),
    [notifications]
  )

  // Responsive: two-column layout on >= 1024px
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Resize state (same pattern as InventoryPage, CustomerPage)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - containerRect.left
      const newWidthPercent = Math.max(
        25,
        Math.min(75, (mouseX / containerRect.width) * 100)
      )
      setLeftPanelWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (!userId) {
    return (
      <Box p="4">
        <Text color="gray">Please sign in to view notifications.</Text>
      </Box>
    )
  }

  const notificationsList = (
    <>
      <Flex justify="between" align="center" mb="3" style={{ flexShrink: 0 }}>
        <Heading size="5">
          {unreadCount > 0
            ? `Unread (${unreadCount})`
            : 'Recent notifications'}
        </Heading>
        {unreadCount > 0 && (
          <Button variant="soft" size="2" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </Flex>
      <Separator size="4" mb="3" style={{ flexShrink: 0 }} />
      {isLoading ? (
        <Text color="gray">Loading…</Text>
      ) : sortedNotifications.length === 0 ? (
        <Text color="gray">No notifications yet.</Text>
      ) : (
        <Flex direction="column" gap="2">
          {sortedNotifications.map((n) => (
            <Box
              key={n.id}
              p="3"
              style={{
                borderRadius: 8,
                backgroundColor: n.read_at ? undefined : 'var(--blue-a2)',
                borderLeft: n.read_at
                  ? undefined
                  : '4px solid var(--blue-9)',
                cursor: n.entity_id || n.action_url ? 'pointer' : undefined,
              }}
              onClick={() =>
                (n.entity_id || n.action_url) && handleNotificationClick(n)
              }
            >
              <Text size="2" weight="medium" as="div">
                {n.title}
              </Text>
              {n.body_text && (
                <Text size="2" color="gray" mt="1" as="div">
                  {n.body_text}
                </Text>
              )}
              <Text size="1" color="gray" mt="2">
                {format(new Date(n.created_at), 'd. MMM yyyy HH:mm', {
                  locale: nb,
                })}
              </Text>
            </Box>
          ))}
        </Flex>
      )}
    </>
  )

  const preferencesContent = (
    <>
      <Heading size="5" mb="3">
        Email preferences
      </Heading>
      <Text size="2" color="gray" mb="4" as="div">
        Choose which notifications you want to receive by email for the current
        company.
      </Text>
      <Flex direction="column" gap="3">
        <PrefRow
          label="Offer updates (sent, accepted, revision requested)"
          checked={localPrefs.email_offer_updates}
          onCheckedChange={(v) =>
            setLocalPrefs((s) => ({ ...s, email_offer_updates: v }))
          }
        />
        <PrefRow
          label="Crew invites"
          checked={localPrefs.email_crew_invites}
          onCheckedChange={(v) =>
            setLocalPrefs((s) => ({ ...s, email_crew_invites: v }))
          }
        />
        <PrefRow
          label="New matters (votes, updates, chats)"
          checked={localPrefs.email_matter_replies}
          onCheckedChange={(v) =>
            setLocalPrefs((s) => ({ ...s, email_matter_replies: v }))
          }
        />
        <PrefRow
          label="Reminders"
          checked={localPrefs.email_reminders}
          onCheckedChange={(v) =>
            setLocalPrefs((s) => ({ ...s, email_reminders: v }))
          }
        />
        <PrefRow
          label="Announcements"
          checked={localPrefs.email_announcements}
          onCheckedChange={(v) =>
            setLocalPrefs((s) => ({ ...s, email_announcements: v }))
          }
        />
      </Flex>
      <Button
        size="2"
        mt="4"
        onClick={() => savePrefsMutation.mutate()}
        disabled={savePrefsMutation.isPending}
      >
        {savePrefsMutation.isPending ? 'Saving…' : 'Save preferences'}
      </Button>
    </>
  )

  // Mobile: stacked layout
  const mobileCardHeight = 'calc(100dvh - 88px)'
  if (!isLarge) {
    return (
      <section style={{ minHeight: 0, minWidth: 0, maxWidth: '100%' }}>
        <Grid columns="1fr" gap="4" align="stretch" style={{ minHeight: 0 }}>
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: mobileCardHeight,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {notificationsList}
            </Box>
          </Card>
          {companyId && (
            <Card size="3">
              <Box style={{ minWidth: 0 }}>{preferencesContent}</Box>
            </Card>
          )}
        </Grid>
      </section>
    )
  }

  // Desktop: two-column resizable layout
  return (
    <section style={{ height: '100%', minHeight: 0 }}>
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* LEFT: notifications list */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: 300,
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {notificationsList}
          </Box>
        </Card>

        {/* Resizer */}
        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          style={{
            width: '6px',
            height: '20%',
            cursor: 'col-resize',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: 4,
            flexShrink: 0,
            alignSelf: 'center',
            userSelect: 'none',
            margin: '0 -4px',
            zIndex: 10,
            transition: isResizing ? 'none' : 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        {/* RIGHT: preferences */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'auto',
            minWidth: 300,
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          {companyId ? (
            preferencesContent
          ) : (
            <Text color="gray">Select a company to manage email preferences.</Text>
          )}
        </Card>
      </Flex>
    </section>
  )
}

function PrefRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <Flex justify="between" align="center" gap="4">
      <Text size="2">{label}</Text>
      <Switch checked={checked} onCheckedChange={onCheckedChange} size="2" />
    </Flex>
  )
}
