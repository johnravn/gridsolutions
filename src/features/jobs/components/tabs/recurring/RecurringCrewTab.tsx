import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { resolveAvatarUrl } from '@shared/lib/avatarUrl'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { recurringJobCrewSummaryQuery } from '../../../api/recurringJobQueries'
import type { RecurringJobCrewEntry } from '../../../types'
import type { RadixBadgeColor } from '../../../utils/statusColors'

type Props = {
  recurringJobId: string
  onSelectJob: (jobId: string) => void
}

type BookingStatusCounts = {
  confirmed: number
  planned: number
  canceled: number
  other: number
}

function countBookingStatuses(
  bookings: RecurringJobCrewEntry['bookings'],
): BookingStatusCounts {
  const counts: BookingStatusCounts = {
    confirmed: 0,
    planned: 0,
    canceled: 0,
    other: 0,
  }
  for (const b of bookings) {
    if (b.status === 'confirmed') counts.confirmed += 1
    else if (b.status === 'planned') counts.planned += 1
    else if (b.status === 'canceled') counts.canceled += 1
    else counts.other += 1
  }
  return counts
}

function bookingStatusColor(status: string): RadixBadgeColor {
  switch (status) {
    case 'confirmed':
      return 'indigo'
    case 'planned':
      return 'blue'
    case 'canceled':
      return 'red'
    default:
      return 'gray'
  }
}

function PersonCard({
  entry,
  onOpen,
}: {
  entry: RecurringJobCrewEntry
  onOpen: () => void
}) {
  const avatarUrl = resolveAvatarUrl(entry.avatar_url)
  const initials = getInitials(entry.display_name ?? entry.email ?? '')
  const counts = countBookingStatuses(entry.bookings)
  const total = entry.bookings.length

  return (
    <Card
      size="2"
      style={{ cursor: 'pointer', height: '100%' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`${entry.display_name || entry.email}, ${total} booking${total !== 1 ? 's' : ''}`}
    >
      <Flex direction="column" gap="3" style={{ height: '100%' }}>
        <Flex align="center" gap="3" style={{ minWidth: 0 }}>
          <Avatar
            size="3"
            src={avatarUrl ?? undefined}
            fallback={initials}
            radius="full"
            style={{ flexShrink: 0 }}
          />
          <Box style={{ minWidth: 0 }}>
            <Text
              size="2"
              weight="medium"
              as="div"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.display_name || entry.email}
            </Text>
            <Text size="1" color="gray">
              {total} booking{total !== 1 ? 's' : ''}
            </Text>
          </Box>
        </Flex>

        <Flex gap="2" wrap="wrap">
          {counts.confirmed > 0 && (
            <Badge size="1" variant="soft" color="indigo">
              {counts.confirmed} confirmed
            </Badge>
          )}
          {counts.planned > 0 && (
            <Badge size="1" variant="soft" color="blue">
              {counts.planned} planned
            </Badge>
          )}
          {counts.canceled > 0 && (
            <Badge size="1" variant="soft" color="red">
              {counts.canceled} canceled
            </Badge>
          )}
          {counts.other > 0 && (
            <Badge size="1" variant="soft" color="gray">
              {counts.other} other
            </Badge>
          )}
        </Flex>
      </Flex>
    </Card>
  )
}

function CrewBookingsDialog({
  entry,
  open,
  onOpenChange,
  onSelectJob,
}: {
  entry: RecurringJobCrewEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectJob: (jobId: string) => void
}) {
  if (!entry) return null

  const avatarUrl = resolveAvatarUrl(entry.avatar_url)
  const initials = getInitials(entry.display_name ?? entry.email ?? '')
  const name = entry.display_name || entry.email

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="560px">
        <Flex align="center" gap="3" mb="1">
          <Avatar
            size="3"
            src={avatarUrl ?? undefined}
            fallback={initials}
            radius="full"
          />
          <Box style={{ minWidth: 0 }}>
            <Dialog.Title mb="0">{name}</Dialog.Title>
            <Dialog.Description size="2" color="gray">
              {entry.bookings.length} booking
              {entry.bookings.length !== 1 ? 's' : ''} in this series
            </Dialog.Description>
          </Box>
        </Flex>

        <Separator my="3" />

        <Flex
          direction="column"
          gap="2"
          style={{ maxHeight: 'min(60vh, 480px)', overflowY: 'auto' }}
        >
          {entry.bookings.map((b, idx) => (
            <Flex
              key={`${b.job_id}-${idx}`}
              gap="2"
              align="center"
              wrap="wrap"
              p="2"
              style={{
                cursor: 'pointer',
                borderRadius: 'var(--radius-2)',
                background: 'var(--gray-a2)',
              }}
              onClick={() => {
                onSelectJob(b.job_id)
                onOpenChange(false)
              }}
            >
              <Text size="2" style={{ textDecoration: 'underline' }}>
                {b.job_title}
                {b.jobnr != null ? ` (#${b.jobnr})` : ''}
              </Text>
              {b.role_title && (
                <Text size="1" color="gray">
                  {b.role_title}
                </Text>
              )}
              {b.start_at && (
                <Text size="1" color="gray">
                  {format(new Date(b.start_at), 'd. MMM', { locale: nb })}
                </Text>
              )}
              <Badge
                size="1"
                variant="soft"
                color={bookingStatusColor(b.status)}
              >
                {makeWordPresentable(b.status)}
              </Badge>
            </Flex>
          ))}
        </Flex>

        <Flex mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export default function RecurringCrewTab({
  recurringJobId,
  onSelectJob,
}: Props) {
  const { data: crew = [], isLoading } = useQuery({
    ...recurringJobCrewSummaryQuery({ recurringJobId }),
  })
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  )

  const selectedEntry =
    crew.find((entry) => entry.user_id === selectedUserId) ?? null

  if (isLoading) {
    return (
      <Text size="2" color="gray">
        Loading crew…
      </Text>
    )
  }

  if (crew.length === 0) {
    return (
      <Text size="2" color="gray">
        No crew bookings across jobs in this recurring job yet.
      </Text>
    )
  }

  return (
    <>
      <Grid columns={{ initial: '1', sm: '2' }} gap="3">
        {crew.map((entry) => (
          <PersonCard
            key={entry.user_id}
            entry={entry}
            onOpen={() => setSelectedUserId(entry.user_id)}
          />
        ))}
      </Grid>

      <CrewBookingsDialog
        entry={selectedEntry}
        open={selectedUserId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null)
        }}
        onSelectJob={onSelectJob}
      />
    </>
  )
}
