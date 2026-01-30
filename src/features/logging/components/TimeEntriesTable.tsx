import * as React from 'react'
import {
  Avatar,
  Button,
  Dialog,
  Flex,
  IconButton,
  Table,
  Text,
} from '@radix-ui/themes'
import { Edit, Trash } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import type { TimeEntryWithProfile } from '../api/timeEntries'

export default function TimeEntriesTable({
  entries,
  isLoading,
  emptyLabel = 'No entries yet for this period.',
  onEditEntry,
  canEditEntry,
  onDeleteEntry,
  canDeleteEntry,
}: {
  entries: Array<TimeEntryWithProfile>
  isLoading: boolean
  emptyLabel?: string
  onEditEntry?: (entry: TimeEntryWithProfile) => void
  canEditEntry?: (entry: TimeEntryWithProfile) => boolean
  onDeleteEntry?: (entry: TimeEntryWithProfile) => void
  canDeleteEntry?: (entry: TimeEntryWithProfile) => boolean
}) {
  if (isLoading) {
    return <Text>Loading...</Text>
  }

  if (entries.length === 0) {
    return <Text color="gray">{emptyLabel}</Text>
  }

  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Employee</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Job #</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
          {(onEditEntry || onDeleteEntry) && <Table.ColumnHeaderCell />}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {entries.map((entry) => (
          <Table.Row key={entry.id}>
            <Table.Cell>
              <Flex align="center" gap="2">
                <Avatar
                  size="2"
                  radius="full"
                  fallback={getInitialsFromNameOrEmail(
                    entry.profile?.display_name ??
                      [entry.profile?.first_name, entry.profile?.last_name]
                        .filter(Boolean)
                        .join(' ') ??
                      null,
                    entry.profile?.email ?? '??',
                  )}
                  src={getAvatarUrl(entry.profile?.avatar_url) ?? undefined}
                  style={{ border: '1px solid var(--gray-5)' }}
                />
                <Text size="2">
                  {getDisplayName(entry.profile) ?? 'Unknown'}
                </Text>
              </Flex>
            </Table.Cell>
            <Table.Cell>{formatDate(entry.start_at)}</Table.Cell>
            <Table.Cell>{formatTime(entry.start_at)}</Table.Cell>
            <Table.Cell>{formatTime(entry.end_at)}</Table.Cell>
            <Table.Cell>
              <Text weight="medium">{entry.title}</Text>
            </Table.Cell>
            <Table.Cell>{entry.job_number ?? '-'}</Table.Cell>
            <Table.Cell>
              {isBlankNote(entry.note) ? (
                <Text color="gray">-</Text>
              ) : (
                <Dialog.Root>
                  <Dialog.Trigger asChild>
                    <Button variant="soft" size="1">
                      Show
                    </Button>
                  </Dialog.Trigger>
                  <Dialog.Content size="2" style={{ maxWidth: 520 }}>
                    <Dialog.Title>Note</Dialog.Title>
                    <Dialog.Description size="2" color="gray" mb="3">
                      Details for this time entry.
                    </Dialog.Description>
                    <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                      {entry.note}
                    </Text>
                  </Dialog.Content>
                </Dialog.Root>
              )}
            </Table.Cell>
            <Table.Cell>
              {formatDuration(entry.start_at, entry.end_at)}
            </Table.Cell>
            {(onEditEntry || onDeleteEntry) && (
              <Table.Cell>
                <Flex align="center" gap="1" justify="end">
                  {onEditEntry && (
                    <IconButton
                      variant="ghost"
                      size="1"
                      onClick={() => onEditEntry(entry)}
                      disabled={canEditEntry ? !canEditEntry(entry) : false}
                      aria-label="Edit time entry"
                    >
                      <Edit width={14} height={14} />
                    </IconButton>
                  )}
                  {onDeleteEntry && (
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={() => onDeleteEntry(entry)}
                      disabled={canDeleteEntry ? !canDeleteEntry(entry) : false}
                      aria-label="Delete time entry"
                    >
                      <Trash width={14} height={14} />
                    </IconButton>
                  )}
                </Flex>
              </Table.Cell>
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours === 0 && minutes === 0) return '0m'
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function getAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
  return data.publicUrl
}

function getDisplayName(
  profile: TimeEntryWithProfile['profile'] | null | undefined,
) {
  if (!profile) return null
  return (
    profile.display_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.email
  )
}

function isBlankNote(note: string | null | undefined) {
  return !note || note.trim().length === 0
}
