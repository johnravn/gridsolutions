import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { Check, Message } from 'iconoir-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { markMatterAsViewed } from '@features/matters/api/queries'
import DashboardCardSkeleton from '@shared/ui/components/DashboardCardSkeleton'
import { DashboardCard } from './DashboardCard'
import {
  HorizontalCardScroller,
  HorizontalScrollCard,
} from './HorizontalCardScroller'
import type { HomeMatter, MatterType } from '../types'

function getMatterTypeLabel(type: MatterType): string {
  switch (type) {
    case 'vote':
      return 'Vote'
    case 'chat':
      return 'Chat'
    case 'update':
      return 'Update'
    case 'crew_invite':
      return 'Invite'
    case 'announcement':
      return 'Announcement'
    default:
      return type
  }
}

function getMatterTypeColor(
  type: MatterType,
): 'blue' | 'purple' | 'green' | 'orange' {
  switch (type) {
    case 'vote':
      return 'purple'
    case 'chat':
      return 'blue'
    case 'update':
      return 'blue'
    case 'crew_invite':
      return 'green'
    case 'announcement':
      return 'orange'
    default:
      return 'blue'
  }
}

function MatterCard({
  matter,
  getInitials,
  getAvatarUrl,
  onOpen,
  onMarkRead,
  marking,
  fillHeight,
}: {
  matter: HomeMatter
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  onOpen: () => void
  onMarkRead: () => void
  marking: boolean
  fillHeight?: boolean
}) {
  const [hovered, setHovered] = React.useState(false)

  if (!matter.created_by) return null
  const avatarUrl = getAvatarUrl(matter.created_by.avatar_url)
  const initials = getInitials(
    matter.created_by.display_name,
    matter.created_by.email,
  )

  return (
    <Card
      size="2"
      style={{
        height: fillHeight ? '100%' : undefined,
        minHeight: fillHeight ? '100%' : undefined,
        cursor: 'pointer',
        flexShrink: 0,
        position: 'relative',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onOpen}
      onMouseEnter={() => {
        setHovered(true)
      }}
      onMouseLeave={() => {
        setHovered(false)
      }}
    >
      <Flex
        gap="2"
        align="start"
        justify="between"
        style={{ flex: 1, minHeight: 0 }}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Flex gap="2" align="center" wrap="wrap">
            <Text size="3" weight="bold">
              {matter.title}
            </Text>
            <Badge
              size="1"
              color={getMatterTypeColor(matter.matter_type)}
              variant="soft"
            >
              {getMatterTypeLabel(matter.matter_type)}
            </Badge>
          </Flex>
          <Text size="1" color="gray" mt="1" as="div">
            {matter.created_by.display_name || matter.created_by.email}
            {' · '}
            {formatDistanceToNow(new Date(matter.created_at), {
              addSuffix: true,
            })}
          </Text>
        </Box>
        <Avatar
          size="2"
          src={avatarUrl || undefined}
          fallback={initials}
          radius="full"
          style={{ flexShrink: 0 }}
        />
      </Flex>

      {hovered && (
        <Box
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Tooltip content="Mark as read">
            <IconButton
              size="1"
              variant="soft"
              highContrast
              disabled={marking}
              onClick={(e) => {
                e.stopPropagation()
                onMarkRead()
              }}
              aria-label="Mark as read"
            >
              <Check width={14} height={14} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Card>
  )
}

export function MattersScrollContent({
  matters,
  loading,
  getInitials,
  getAvatarUrl,
  fillHeight = true,
  fadeRight = false,
  bleed = false,
  cardMinWidth = 220,
  emptyFallback = null,
}: {
  matters: Array<HomeMatter>
  loading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  fillHeight?: boolean
  fadeRight?: boolean
  bleed?: boolean
  cardMinWidth?: number
  /** When null and empty, render nothing (caller shows all-clear). */
  emptyFallback?: React.ReactNode
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const visibleMatters = matters.filter((m) => m.created_by)
  const [markingId, setMarkingId] = React.useState<string | null>(null)

  const invalidateMatters = React.useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matters'] }),
      qc.invalidateQueries({ queryKey: ['matters', 'unread-count'] }),
    ])
  }, [qc])

  const markOne = useMutation({
    mutationFn: async (matterId: string) => {
      setMarkingId(matterId)
      await markMatterAsViewed(matterId)
    },
    onSettled: async () => {
      setMarkingId(null)
      await invalidateMatters()
    },
  })

  const openMatter = (matterId: string) => {
    navigate({ to: '/matters', search: { matterId } })
  }

  if (loading) {
    return <DashboardCardSkeleton rowCount={2} compact />
  }

  if (visibleMatters.length === 0) {
    return emptyFallback
  }

  return (
    <HorizontalCardScroller
      bleed={bleed}
      fillHeight={fillHeight}
      fadeRight={fadeRight}
    >
      {visibleMatters.map((matter) => (
        <HorizontalScrollCard
          key={matter.id}
          minWidth={cardMinWidth}
          style={
            fillHeight ? { height: '100%', alignSelf: 'stretch' } : undefined
          }
        >
          <MatterCard
            matter={matter}
            getInitials={getInitials}
            getAvatarUrl={getAvatarUrl}
            onOpen={() => openMatter(matter.id)}
            onMarkRead={() => markOne.mutate(matter.id)}
            marking={markingId === matter.id}
            fillHeight={fillHeight}
          />
        </HorizontalScrollCard>
      ))}
    </HorizontalCardScroller>
  )
}

export function MattersSection({
  matters,
  loading,
  getInitials,
  getAvatarUrl,
  presentation = 'desktop',
}: {
  matters: Array<HomeMatter>
  loading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  presentation?: 'desktop' | 'mobile'
}) {
  const qc = useQueryClient()
  const isMobile = presentation === 'mobile'
  const visibleMatters = matters.filter((m) => m.created_by)

  const invalidateMatters = React.useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matters'] }),
      qc.invalidateQueries({ queryKey: ['matters', 'unread-count'] }),
    ])
  }, [qc])

  const markAll = useMutation({
    mutationFn: async () => {
      await Promise.all(visibleMatters.map((m) => markMatterAsViewed(m.id)))
    },
    onSettled: async () => {
      await invalidateMatters()
    },
  })

  return (
    <DashboardCard
      title="Matters"
      icon={<Message width={18} height={18} />}
      count={matters.length}
      headerAction={
        visibleMatters.length > 0 ? (
          <Button
            size="2"
            variant="soft"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        ) : undefined
      }
      notFullHeight={isMobile}
      fillHeight={!isMobile}
      variant={isMobile ? 'plain' : 'card'}
    >
      <MattersScrollContent
        matters={matters}
        loading={loading}
        getInitials={getInitials}
        getAvatarUrl={getAvatarUrl}
        fillHeight={!isMobile}
        bleed={isMobile}
        cardMinWidth={isMobile ? 280 : 240}
        emptyFallback={
          <Box py="4">
            <Text size="2" color="gray" align="center">
              No unread matters
            </Text>
          </Box>
        }
      />
    </DashboardCard>
  )
}
