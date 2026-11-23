import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
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
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { timeEntriesForJobQuery } from '@features/logging/api/timeEntries'
import {
  looksLikeHoursOnlyEntry,
  rangeToHours,
} from '@features/logging/lib/timeEntryHours'
import { formatLoggingDate } from '@features/logging/lib/timeEntryRange'
import {
  computeLoggingExpenseAmount,
  loggingExpenseDescription,
  loggingExpenseSourceId,
} from '../../utils/loggingExpense'
import { insertJobMoneyItem, jobMoneyItemsQuery } from '../../api/moneyQueries'
import type { TimeEntryWithProfile } from '@features/logging/api/timeEntries'

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
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const { data: entries = [], isLoading } = useQuery({
    ...timeEntriesForJobQuery({
      companyId: companyId ?? '',
      jobId,
    }),
    enabled: !!companyId && !!jobId,
  })

  const { data: moneyItems = [] } = useQuery({
    ...jobMoneyItemsQuery(jobId),
    enabled: !!jobId,
  })

  const addedSourceIds = React.useMemo(
    () =>
      new Set(
        moneyItems
          .filter((item) => item.source_id)
          .map((item) => item.source_id as string),
      ),
    [moneyItems],
  )

  const userIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const entry of entries) {
      if (entry.user_id) ids.add(entry.user_id)
    }
    return Array.from(ids).sort()
  }, [entries])

  const { data: companyRates } = useQuery({
    queryKey: ['company', companyId, 'general-rates'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('companies')
        .select(
          'employee_daily_rate, employee_hourly_rate, owner_daily_rate, owner_hourly_rate',
        )
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: userRates = [] } = useQuery({
    queryKey: [
      'company',
      companyId,
      'logging-expense-rates',
      userIds.join(','),
    ] as const,
    enabled: !!companyId && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, role, rate_type, rate')
        .eq('company_id', companyId!)
        .in('user_id', userIds)
      if (error) throw error
      return data ?? []
    },
  })

  const userRatesMap = React.useMemo(() => {
    const map = new Map<
      string,
      { role: string | null; rate: number | null; rate_type: string | null }
    >()
    for (const row of userRates) {
      if (!row.user_id) continue
      map.set(row.user_id, {
        role: row.role ?? null,
        rate: row.rate != null ? Number(row.rate) : null,
        rate_type: row.rate_type ?? null,
      })
    }
    return map
  }, [userRates])

  const addExpenseMutation = useMutation({
    mutationFn: async (entry: TimeEntryWithProfile) => {
      if (!companyId) throw new Error('No company')
      const sourceId = loggingExpenseSourceId(entry.id)
      if (addedSourceIds.has(sourceId)) {
        throw new Error('Already added as an expense')
      }

      const hoursLabel = formatDurationLabel(entry.start_at, entry.end_at)
      const name = getDisplayName(entry.profile) ?? 'Unknown'
      const amount = computeLoggingExpenseAmount({
        startAt: entry.start_at,
        endAt: entry.end_at,
        userRate: userRatesMap.get(entry.user_id) ?? null,
        companyRates,
      })
      if (amount == null) {
        throw new Error(
          'No hourly rate for this user — set a freelancer rate or company employee/owner rate first.',
        )
      }

      await insertJobMoneyItem({
        job_id: jobId,
        company_id: companyId,
        type: 'expense',
        description: loggingExpenseDescription({
          userName: name,
          title: entry.title,
          hoursLabel,
        }),
        amount,
        date: entry.start_at.slice(0, 10),
        reference: hoursLabel,
        source: 'logging',
        source_id: sourceId,
        category: 'crew',
      })
    },
    onSuccess: () => {
      success('Expense added from logging')
      void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money-items'] })
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to add expense',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const totalHours = React.useMemo(
    () =>
      entries.reduce(
        (sum, entry) => sum + rangeToHours(entry.start_at, entry.end_at),
        0,
      ),
    [entries],
  )

  const pendingEntryId =
    addExpenseMutation.isPending && addExpenseMutation.variables
      ? addExpenseMutation.variables.id
      : null

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
            <Table.Root size="1" variant="surface" style={{ minWidth: 480 }}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Hours</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>User</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="1">
                    {/* actions */}
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {entries.map((entry) => {
                  const name = getDisplayName(entry.profile) ?? 'Unknown'
                  const hoursOnly = looksLikeHoursOnlyEntry(
                    entry.start_at,
                    entry.end_at,
                  )
                  const sourceId = loggingExpenseSourceId(entry.id)
                  const alreadyAdded = addedSourceIds.has(sourceId)
                  const isThisPending = pendingEntryId === entry.id
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
                      <Table.Cell>
                        {alreadyAdded ? (
                          <Text size="1" color="gray">
                            Added
                          </Text>
                        ) : (
                          <Button
                            size="1"
                            variant="soft"
                            disabled={addExpenseMutation.isPending}
                            onClick={() => addExpenseMutation.mutate(entry)}
                          >
                            {isThisPending ? 'Adding…' : 'Add'}
                          </Button>
                        )}
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
