import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Card,
  Flex,
  Heading,
  Spinner,
  Table,
  Text,
} from '@radix-ui/themes'
import { MobileHScroll } from '@shared/ui/components/MobileHScroll'
import { resolveAvatarUrl } from '@shared/lib/avatarUrl'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  
  timeEntriesForJobQuery
} from '@features/logging/api/timeEntries'
import {
  looksLikeHoursOnlyEntry,
  rangeToHours,
} from '@features/logging/lib/timeEntryHours'
import { formatLoggingDate } from '@features/logging/lib/timeEntryRange'
import type {TimeEntryWithProfile} from '@features/logging/api/timeEntries';

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

function formatDurationLabel(startAt: string, endAt: string) {
  const hours = rangeToHours(startAt, endAt)
  if (hours <= 0) return '0h'
  if (Number.isInteger(hours)) return `${hours}h`
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (whole === 0) return `${minutes}m`
  if (minutes === 0) return `${whole}h`
  return `${whole}h ${minutes}m`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('nb-NO', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MoneyLoggingEntriesPanel({ jobId }: { jobId: string }) {
  const { companyId } = useCompany()

  const { data: entries = [], isLoading } = useQuery({
    ...timeEntriesForJobQuery({
      companyId: companyId ?? '',
      jobId,
    }),
    enabled: !!companyId && !!jobId,
  })

  const totalHours = React.useMemo(
    () =>
      entries.reduce(
        (sum, entry) => sum + rangeToHours(entry.start_at, entry.end_at),
        0,
      ),
    [entries],
  )

  return (
    <Card style={{ background: 'var(--gray-a2)' }}>
      <Flex direction="column" gap="3">
        <Box style={{ minWidth: 0 }}>
          <Heading size="3" mb="1">
            Logging
          </Heading>
          <Text size="2" color="gray">
            Time entries linked to this job.
            {entries.length > 0
              ? ` ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · ${totalHours.toFixed(2)} h total.`
              : null}
          </Text>
        </Box>

        {isLoading ? (
          <Flex
            align="center"
            justify="center"
            gap="2"
            py="6"
            role="status"
            aria-live="polite"
          >
            <Spinner size="3" />
            <Text size="2" color="gray">
              Loading logging entries…
            </Text>
          </Flex>
        ) : entries.length === 0 ? (
          <Text size="2" color="gray">
            No logging entries linked to this job yet.
          </Text>
        ) : (
          <MobileHScroll>
            <Table.Root size="1" variant="surface" style={{ minWidth: 420 }}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Hours</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>User</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {entries.map((entry) => {
                  const name = getDisplayName(entry.profile) ?? 'Unknown'
                  const hoursOnly = looksLikeHoursOnlyEntry(
                    entry.start_at,
                    entry.end_at,
                  )
                  return (
                    <Table.Row key={entry.id}>
                      <Table.Cell>
                        <Flex direction="column" gap="0">
                          <Text size="2">
                            {formatLoggingDate(entry.start_at)}
                          </Text>
                          {!hoursOnly && (
                            <Text size="1" color="gray">
                              {formatTime(entry.start_at)}–
                              {formatTime(entry.end_at)}
                            </Text>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" weight="medium">
                          {formatDurationLabel(entry.start_at, entry.end_at)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          size="2"
                          style={{ wordBreak: 'break-word' }}
                          title={entry.title}
                        >
                          {entry.title}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                          <Avatar
                            size="1"
                            radius="full"
                            fallback={getInitialsFromNameOrEmail(
                              entry.profile?.display_name ??
                                [
                                  entry.profile?.first_name,
                                  entry.profile?.last_name,
                                ]
                                  .filter(Boolean)
                                  .join(' ') ??
                                null,
                              entry.profile?.email ?? '??',
                            )}
                            src={
                              resolveAvatarUrl(entry.profile?.avatar_url) ??
                              undefined
                            }
                            style={{ border: '1px solid var(--gray-5)' }}
                          />
                          <Text size="2" truncate title={name}>
                            {name}
                          </Text>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </MobileHScroll>
        )}
      </Flex>
    </Card>
  )
}
