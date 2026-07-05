import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes'
import { CloudSync } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  MONITOR_JOB_DEFINITIONS,
  ageInMinutes,
  formatDurationMs,
  formatMonitorDateTime,
  formatTriggerSource,
  statusBadgeColor,
  summarizeRunDetails,
  systemMonitorSnapshotQuery,
  triggerContaSyncNow,
  triggerDemoTimelineAdvance,
} from '../api/monitorQueries'
import SuperResendEmailsSection from './SuperResendEmailsSection'
import type { MonitorJobLastRun, MonitorRecentRun } from '../api/monitorQueries'

function JobCard({
  name,
  schedule,
  description,
  lastRun,
  action,
}: {
  name: string
  schedule: string
  description: string
  lastRun: MonitorJobLastRun | undefined
  action?: React.ReactNode
}) {
  return (
    <Card size="2">
      <Flex direction="column" gap="2">
        <Flex align="start" justify="between" gap="3" wrap="wrap">
          <Box style={{ flex: '1 1 220px', minWidth: 0 }}>
            <Text weight="bold" size="3" as="div">
              {name}
            </Text>
            <Text size="1" color="gray" as="div" mt="1">
              {schedule}
            </Text>
          </Box>
          <Flex align="center" gap="2" wrap="wrap">
            <Badge
              color={statusBadgeColor(lastRun?.last_status)}
              variant="soft"
              size="2"
            >
              {lastRun?.last_status ?? 'No runs yet'}
            </Badge>
            {action}
          </Flex>
        </Flex>
        <Text size="2" color="gray">
          {description}
        </Text>
        <Grid columns={{ initial: '1', sm: '2' }} gap="2">
          <Text size="1" color="gray">
            Last run: {formatMonitorDateTime(lastRun?.last_started_at)}
          </Text>
          <Text size="1" color="gray">
            Duration:{' '}
            {formatDurationMs(
              lastRun?.last_started_at,
              lastRun?.last_finished_at,
            )}
          </Text>
          <Text size="1" color="gray">
            Trigger: {formatTriggerSource(lastRun?.last_trigger_source)}
          </Text>
          <Text size="1" color="gray">
            Summary:{' '}
            {lastRun
              ? summarizeRunDetails(lastRun.job_key, lastRun.last_details)
              : '—'}
          </Text>
        </Grid>
        {lastRun?.last_error_message ? (
          <Text size="1" color="red">
            {lastRun.last_error_message}
          </Text>
        ) : null}
      </Flex>
    </Card>
  )
}

function RecentRunRow({ run }: { run: MonitorRecentRun }) {
  const [expanded, setExpanded] = React.useState(false)
  const jobName =
    MONITOR_JOB_DEFINITIONS.find((j) => j.jobKey === run.job_key)?.name ??
    run.job_key

  return (
    <>
      <Table.Row>
        <Table.Cell>{formatMonitorDateTime(run.started_at)}</Table.Cell>
        <Table.Cell>{jobName}</Table.Cell>
        <Table.Cell>
          <Badge color={statusBadgeColor(run.status)} variant="soft" size="1">
            {run.status}
          </Badge>
        </Table.Cell>
        <Table.Cell>{formatTriggerSource(run.trigger_source)}</Table.Cell>
        <Table.Cell>{summarizeRunDetails(run.job_key, run.details)}</Table.Cell>
        <Table.Cell>
          {run.details && Object.keys(run.details).length > 0 ? (
            <Button
              type="button"
              size="1"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide' : 'Details'}
            </Button>
          ) : (
            '—'
          )}
        </Table.Cell>
      </Table.Row>
      {expanded ? (
        <Table.Row>
          <Table.Cell colSpan={6}>
            <Text
              size="1"
              as="pre"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {JSON.stringify(run.details, null, 2)}
            </Text>
            {run.error_message ? (
              <Text size="1" color="red" mt="2" as="div">
                {run.error_message}
              </Text>
            ) : null}
          </Table.Cell>
        </Table.Row>
      ) : null}
    </>
  )
}

export default function SuperMonitorTab() {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    systemMonitorSnapshotQuery(),
  )

  const syncMutation = useMutation({
    mutationFn: triggerContaSyncNow,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['super', 'monitor', 'snapshot'] })
      const msg = summarizeRunDetails('conta_customer_sync', {
        summary: `${result.results.reduce((n, r) => n + r.updated, 0)} updated, ${result.results.reduce((n, r) => n + r.created, 0)} created`,
      })
      if (result.status === 'success') {
        success('Conta sync completed', msg)
      } else if (result.status === 'partial') {
        toastError('Conta sync completed with issues', msg)
      } else {
        toastError('Conta sync failed', msg)
      }
    },
    onError: (e: unknown) => {
      toastError(
        'Conta sync failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const demoTimelineMutation = useMutation({
    mutationFn: triggerDemoTimelineAdvance,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['super', 'monitor', 'snapshot'] })
      success(
        'Demo timeline advanced',
        summarizeRunDetails('demo_timeline_advance', result),
      )
    },
    onError: (e: unknown) => {
      toastError(
        'Demo timeline advance failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const lastRunByKey = React.useMemo(() => {
    const map = new Map<string, MonitorJobLastRun>()
    for (const row of data?.jobs ?? []) {
      map.set(row.job_key, row)
    }
    return map
  }, [data?.jobs])

  const pendingCount = data?.notificationBacklog.pendingCount ?? 0
  const oldestAge = ageInMinutes(data?.notificationBacklog.oldestPendingAt)
  const backlogWarning =
    pendingCount > 10 || (oldestAge != null && oldestAge > 15)

  if (isLoading) {
    return (
      <Card size="3">
        <Text color="gray">Loading system monitor…</Text>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card size="3">
        <Text color="red" mb="3" as="div">
          {error instanceof Error ? error.message : 'Failed to load monitor'}
        </Text>
        <Button type="button" variant="soft" onClick={() => void refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Flex
      direction="column"
      gap="4"
      pb="4"
      style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
    >
      <Card size="3">
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Heading size="5">System monitor</Heading>
            <Text size="1" color="gray">
              {isFetching ? 'Refreshing…' : 'Auto-refreshes every 60s'}
            </Text>
          </Flex>
          <Text size="2" color="gray">
            Scheduled job health, Conta sync status, email pipeline backlog, and
            platform snapshot. Superuser only.
          </Text>

          {data?.platformCounts ? (
            <Grid columns={{ initial: '2', sm: '4' }} gap="3">
              <Box>
                <Text size="1" color="gray">
                  Companies
                </Text>
                <Text size="4" weight="bold" as="div">
                  {data.platformCounts.companies}
                </Text>
              </Box>
              <Box>
                <Text size="1" color="gray">
                  Users
                </Text>
                <Text size="4" weight="bold" as="div">
                  {data.platformCounts.users}
                </Text>
              </Box>
              <Box>
                <Text size="1" color="gray">
                  In-progress jobs
                </Text>
                <Text size="4" weight="bold" as="div">
                  {data.platformCounts.inProgressJobs}
                </Text>
              </Box>
              <Box>
                <Text size="1" color="gray">
                  Pending emails
                </Text>
                <Flex align="center" gap="2">
                  <Text size="4" weight="bold" as="span">
                    {pendingCount}
                  </Text>
                  {backlogWarning ? (
                    <Badge color="amber" variant="soft" size="1">
                      Backlog
                    </Badge>
                  ) : null}
                </Flex>
                {oldestAge != null && pendingCount > 0 ? (
                  <Text size="1" color="gray" as="div">
                    Oldest pending: {oldestAge}m ago
                  </Text>
                ) : null}
              </Box>
            </Grid>
          ) : null}
        </Flex>
      </Card>

      <Box>
        <Heading size="4" mb="3">
          Scheduled jobs
        </Heading>
        <Flex direction="column" gap="3">
          {MONITOR_JOB_DEFINITIONS.map((def) => (
            <JobCard
              key={def.jobKey}
              name={def.name}
              schedule={def.schedule}
              description={def.description}
              lastRun={lastRunByKey.get(def.jobKey)}
              action={
                def.jobKey === 'conta_customer_sync' ? (
                  <Button
                    type="button"
                    size="2"
                    variant="soft"
                    disabled={syncMutation.isPending}
                    onClick={() => syncMutation.mutate()}
                  >
                    <Flex align="center" gap="2">
                      <CloudSync width={16} height={16} />
                      {syncMutation.isPending ? 'Syncing…' : 'Run sync now'}
                    </Flex>
                  </Button>
                ) : def.jobKey === 'demo_timeline_advance' ? (
                  <Button
                    type="button"
                    size="2"
                    variant="soft"
                    disabled={demoTimelineMutation.isPending}
                    onClick={() => demoTimelineMutation.mutate()}
                  >
                    {demoTimelineMutation.isPending
                      ? 'Advancing…'
                      : 'Advance +7 days now'}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Flex>
      </Box>

      <Card size="3">
        <Heading size="4" mb="3">
          Conta company health
        </Heading>
        {(data?.contaCompanies.length ?? 0) === 0 ? (
          <Text size="2" color="gray">
            No companies configured for Conta sync.
          </Text>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table.Root variant="surface" size="1">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Company</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>API key</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Last sync</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Linked</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Stale</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(data?.contaCompanies ?? []).map((row) => {
                  const stale = row.stale_customer_count > 0
                  const inactive = !row.api_key_active
                  return (
                    <Table.Row key={row.company_id}>
                      <Table.Cell>{row.company_name}</Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={inactive ? 'red' : 'green'}
                          variant="soft"
                          size="1"
                        >
                          {inactive ? 'Inactive' : 'Active'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {formatMonitorDateTime(row.last_customer_sync_at)}
                      </Table.Cell>
                      <Table.Cell>{row.linked_customer_count}</Table.Cell>
                      <Table.Cell>
                        {stale ? (
                          <Badge color="amber" variant="soft" size="1">
                            {row.stale_customer_count}
                          </Badge>
                        ) : (
                          row.stale_customer_count
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Card>

      <SuperResendEmailsSection />

      <Card size="3">
        <Heading size="4" mb="3">
          Recent runs
        </Heading>
        {(data?.recentRuns.length ?? 0) === 0 ? (
          <Text size="2" color="gray">
            No job runs recorded yet. Runs appear after scheduled jobs execute
            or after you trigger Conta sync manually.
          </Text>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table.Root variant="surface" size="1">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Job</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Trigger</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Summary</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(data?.recentRuns ?? []).map((run) => (
                  <RecentRunRow key={run.id} run={run} />
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Card>
    </Flex>
  )
}
