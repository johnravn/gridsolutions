import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Flex,
  Heading,
  IconButton,
  Separator,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import {
  Copy,
  Eye,
  EyeClosed,
  NavArrowDown,
  NavArrowRight,
  Search,
  Trash,
} from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { getCalendarFeedUrl } from '@features/calendar/api/calendarSubscription'
import {
  calendarSubscriptionKindLabel,
  calendarSubscriptionsAdminQuery,
  deleteCalendarSubscriptionAsSuper,
  deleteCalendarSubscriptionsForUserAsSuper,
  userDisplayLabel,
} from '../api/calendarSubscriptionQueries'
import type {
  SuperCalendarSubscriptionRow,
  SuperCalendarSubscriptionUserGroup,
} from '../api/calendarSubscriptionQueries'

function truncateToken(token: string): string {
  if (token.length <= 12) return token
  return `${token.slice(0, 6)}…${token.slice(-4)}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function matchesSearch(
  group: SuperCalendarSubscriptionUserGroup,
  search: string,
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    group.email,
    group.display_name,
    group.first_name,
    group.last_name,
    userDisplayLabel(group),
    ...group.subscriptions.flatMap((s) => [
      s.company_name,
      s.kind,
      calendarSubscriptionKindLabel(s.kind),
      s.token,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

function TokenRow({
  sub,
  onDelete,
  deleting,
}: {
  sub: SuperCalendarSubscriptionRow
  onDelete: (sub: SuperCalendarSubscriptionRow) => void
  deleting: boolean
}) {
  const { success, error: toastError } = useToast()
  const [revealed, setRevealed] = React.useState(false)

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(getCalendarFeedUrl(sub.token))
      success('Copied', 'Feed URL copied to clipboard')
    } catch {
      toastError('Copy failed', 'Could not copy feed URL')
    }
  }

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(sub.token)
      success('Copied', 'Token copied to clipboard')
    } catch {
      toastError('Copy failed', 'Could not copy token')
    }
  }

  return (
    <Box
      p="3"
      style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 'var(--radius-3)',
        background: 'var(--color-panel-solid)',
      }}
    >
      <Flex align="start" justify="between" gap="3" wrap="wrap">
        <Box style={{ flex: '1 1 240px', minWidth: 0 }}>
          <Flex align="center" gap="2" wrap="wrap" mb="1">
            <Text weight="medium" size="2">
              {calendarSubscriptionKindLabel(sub.kind)}
            </Text>
            {sub.remind_1h_before ? (
              <Badge size="1" color="amber" variant="soft">
                1h reminder
              </Badge>
            ) : null}
          </Flex>
          <Text size="1" color="gray" as="div">
            Company: {sub.company_name}
          </Text>
          <Text size="1" color="gray" as="div">
            Created: {formatDate(sub.created_at)}
          </Text>
          <Flex align="center" gap="2" mt="2" wrap="wrap">
            <Code size="1" style={{ wordBreak: 'break-all' }}>
              {revealed ? sub.token : truncateToken(sub.token)}
            </Code>
            <Tooltip content={revealed ? 'Hide token' : 'Show token'}>
              <IconButton
                size="1"
                variant="ghost"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? 'Hide token' : 'Show token'}
              >
                {revealed ? (
                  <EyeClosed width={14} height={14} />
                ) : (
                  <Eye width={14} height={14} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip content="Copy token">
              <IconButton
                size="1"
                variant="ghost"
                onClick={() => void copyToken()}
                aria-label="Copy token"
              >
                <Copy width={14} height={14} />
              </IconButton>
            </Tooltip>
          </Flex>
        </Box>
        <Flex align="center" gap="2" wrap="wrap">
          <Button size="1" variant="soft" onClick={() => void copyFeedUrl()}>
            Copy feed URL
          </Button>
          <Button
            size="1"
            color="red"
            variant="soft"
            disabled={deleting}
            onClick={() => onDelete(sub)}
          >
            <Trash width={14} height={14} />
            Delete
          </Button>
        </Flex>
      </Flex>
    </Box>
  )
}

function avatarPublicUrl(path: string | null): string | undefined {
  if (!path) return undefined
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

function UserGroupCard({
  group,
  onDeleteToken,
  onDeleteAll,
  deletingId,
  deletingUserId,
}: {
  group: SuperCalendarSubscriptionUserGroup
  onDeleteToken: (sub: SuperCalendarSubscriptionRow) => void
  onDeleteAll: (group: SuperCalendarSubscriptionUserGroup) => void
  deletingId: string | null
  deletingUserId: string | null
}) {
  const [open, setOpen] = React.useState(false)
  const label = userDisplayLabel(group)
  const count = group.subscriptions.length

  return (
    <Card size="2">
      <Flex
        align="center"
        justify="between"
        gap="3"
        wrap="wrap"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Flex align="center" gap="2" style={{ minWidth: 0, flex: '1 1 220px' }}>
          {open ? (
            <NavArrowDown width={18} height={18} style={{ flexShrink: 0 }} />
          ) : (
            <NavArrowRight width={18} height={18} style={{ flexShrink: 0 }} />
          )}
          <Avatar
            src={avatarPublicUrl(group.avatar_url)}
            fallback={getInitials(label)}
            size="3"
            radius="full"
            style={{ flexShrink: 0, border: '1px solid var(--gray-5)' }}
          />
          <Box style={{ minWidth: 0 }}>
            <Text weight="bold" size="3" as="div" truncate>
              {label}
            </Text>
            {label !== group.email && group.email ? (
              <Text size="1" color="gray" as="div" truncate>
                {group.email}
              </Text>
            ) : null}
          </Box>
        </Flex>
        <Flex align="center" gap="2" onClick={(e) => e.stopPropagation()}>
          <Badge variant="soft" size="2">
            {count} token{count === 1 ? '' : 's'}
          </Badge>
          <Button
            size="1"
            color="red"
            variant="soft"
            disabled={deletingUserId === group.user_id}
            onClick={() => onDeleteAll(group)}
          >
            Delete all
          </Button>
        </Flex>
      </Flex>

      {open ? (
        <Flex direction="column" gap="2" mt="3">
          {group.subscriptions.map((sub) => (
            <TokenRow
              key={sub.id}
              sub={sub}
              onDelete={onDeleteToken}
              deleting={deletingId === sub.id}
            />
          ))}
        </Flex>
      ) : null}
    </Card>
  )
}

export default function SuperCalendarSubscriptionsTab() {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = React.useState('')
  const [pendingDelete, setPendingDelete] =
    React.useState<SuperCalendarSubscriptionRow | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] =
    React.useState<SuperCalendarSubscriptionUserGroup | null>(null)

  const {
    data: groups = [],
    isLoading,
    isError,
    error,
  } = useQuery(calendarSubscriptionsAdminQuery())

  const deleteOne = useMutation({
    mutationFn: (id: string) => deleteCalendarSubscriptionAsSuper(id),
    onSuccess: () => {
      setPendingDelete(null)
      success('Deleted', 'Calendar subscription token revoked')
      void qc.invalidateQueries({
        queryKey: ['super', 'calendar-subscriptions'],
      })
    },
    onError: (e: unknown) => {
      toastError(
        'Delete failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const deleteAllForUser = useMutation({
    mutationFn: (userId: string) =>
      deleteCalendarSubscriptionsForUserAsSuper(userId),
    onSuccess: () => {
      setPendingDeleteUser(null)
      success('Deleted', 'All calendar tokens for that user were revoked')
      void qc.invalidateQueries({
        queryKey: ['super', 'calendar-subscriptions'],
      })
    },
    onError: (e: unknown) => {
      toastError(
        'Delete failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const filtered = React.useMemo(
    () => groups.filter((g) => matchesSearch(g, search)),
    [groups, search],
  )

  const totalTokens = groups.reduce((n, g) => n + g.subscriptions.length, 0)

  return (
    <>
      <Card
        size="3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
        }}
      >
        <Flex align="start" justify="between" gap="3" wrap="wrap" mb="2">
          <Box>
            <Heading size="5" mb="1">
              Calendar subscriptions
            </Heading>
            <Text size="2" color="gray">
              Tokens power public ICS feed URLs. Deleting a token immediately
              revokes that feed.
            </Text>
          </Box>
          <Badge size="2" variant="soft">
            {totalTokens} token{totalTokens === 1 ? '' : 's'} · {groups.length}{' '}
            user{groups.length === 1 ? '' : 's'}
          </Badge>
        </Flex>

        <Separator size="4" mb="3" />

        <Box mb="3" style={{ maxWidth: 420 }}>
          <TextField.Root
            size="2"
            placeholder="Search by user, email, company, kind, or token…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          >
            <TextField.Slot>
              <Search width={16} height={16} />
            </TextField.Slot>
          </TextField.Root>
        </Box>

        <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {isLoading ? (
            <Text color="gray" size="2">
              Loading calendar subscriptions…
            </Text>
          ) : isError ? (
            <Text color="red" size="2">
              {error instanceof Error
                ? error.message
                : 'Failed to load calendar subscriptions'}
            </Text>
          ) : filtered.length === 0 ? (
            <Text color="gray" size="2">
              {search.trim()
                ? 'No subscriptions match your search.'
                : 'No calendar subscription tokens found.'}
            </Text>
          ) : (
            <Flex direction="column" gap="3">
              {filtered.map((group) => (
                <UserGroupCard
                  key={group.user_id}
                  group={group}
                  onDeleteToken={setPendingDelete}
                  onDeleteAll={setPendingDeleteUser}
                  deletingId={
                    deleteOne.isPending ? (deleteOne.variables ?? null) : null
                  }
                  deletingUserId={
                    deleteAllForUser.isPending
                      ? (deleteAllForUser.variables ?? null)
                      : null
                  }
                />
              ))}
            </Flex>
          )}
        </Box>
      </Card>

      <AlertDialog.Root
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Revoke calendar token?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This deletes the{' '}
            <b>
              {pendingDelete
                ? calendarSubscriptionKindLabel(pendingDelete.kind)
                : ''}
            </b>{' '}
            subscription for{' '}
            <b>
              {pendingDelete
                ? pendingDelete.user_display_name || pendingDelete.user_email
                : ''}
            </b>
            . Any calendar apps using this feed URL will stop updating.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                disabled={deleteOne.isPending}
                onClick={() => {
                  if (pendingDelete) deleteOne.mutate(pendingDelete.id)
                }}
              >
                {deleteOne.isPending ? 'Deleting…' : 'Yes, revoke'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <AlertDialog.Root
        open={!!pendingDeleteUser}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteUser(null)
        }}
      >
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Revoke all tokens for user?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This deletes all{' '}
            <b>{pendingDeleteUser?.subscriptions.length ?? 0}</b> calendar
            subscription token
            {(pendingDeleteUser?.subscriptions.length ?? 0) === 1
              ? ''
              : 's'}{' '}
            for{' '}
            <b>
              {pendingDeleteUser ? userDisplayLabel(pendingDeleteUser) : ''}
            </b>
            . Their external calendar feeds will stop working.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                disabled={deleteAllForUser.isPending}
                onClick={() => {
                  if (pendingDeleteUser) {
                    deleteAllForUser.mutate(pendingDeleteUser.user_id)
                  }
                }}
              >
                {deleteAllForUser.isPending ? 'Deleting…' : 'Yes, revoke all'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
