import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Message } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { DashboardCard } from './DashboardCard'
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

export function MattersSection({
  matters,
  loading,
  getInitials,
  getAvatarUrl,
}: {
  matters: Array<HomeMatter>
  loading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()

  return (
    <DashboardCard
      title="Matters"
      icon={<Message width={18} height={18} />}
      headerAction={
        <Button
          size="2"
          variant="soft"
          onClick={() => navigate({ to: '/matters' })}
        >
          View all
        </Button>
      }
      notFullHeight
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : matters.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No unread matters
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2">
          {matters.slice(0, 5).map((matter) => {
            if (!matter.created_by) return null
            const avatarUrl = getAvatarUrl(matter.created_by.avatar_url)
            const initials = getInitials(
              matter.created_by.display_name,
              matter.created_by.email,
            )

            return (
              <div
                key={matter.id}
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
                onClick={() => navigate({ to: '/matters' })}
              >
                <Flex gap="2" align="center">
                  <Avatar
                    size="2"
                    src={avatarUrl || undefined}
                    fallback={initials}
                    radius="full"
                  />
                  <Box style={{ flex: 1 }}>
                    <Text size="2" weight="medium">
                      {matter.title}
                    </Text>
                    <Flex gap="2" align="center">
                      <Text size="1" color="gray">
                        {matter.created_by.display_name ||
                          matter.created_by.email}
                      </Text>
                      <Text size="1" color="gray">
                        •
                      </Text>
                      <Badge
                        size="1"
                        color={getMatterTypeColor(matter.matter_type)}
                        variant="soft"
                      >
                        {getMatterTypeLabel(matter.matter_type)}
                      </Badge>
                      <Text size="1" color="gray">
                        •
                      </Text>
                      <Text size="1" color="gray">
                        {formatDistanceToNow(new Date(matter.created_at), {
                          addSuffix: true,
                        })}
                      </Text>
                    </Flex>
                  </Box>
                </Flex>
              </div>
            )
          })}
        </Flex>
      )}
    </DashboardCard>
  )
}
