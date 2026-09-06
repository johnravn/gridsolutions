import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { CloudSync, Refresh, WarningCircle } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  MONITOR_JOB_DEFINITIONS,
  ageInMinutes,
  formatDurationMs,
  formatMonitorDateTime,
  formatTriggerSource,
  shortenOrgId,
  statusBadgeColor,
  summarizeContaCustomerSyncResults,
  summarizeContaInvoicePaidSyncResults,
  summarizeRunDetails,
  systemMonitorSnapshotQuery,
  triggerContaSyncNow,
  triggerDemoTimelineAdvance,
  triggerEmailDispatchNow,
  triggerJobStatusAutoUpdate,
} from '../api/monitorQueries'
import SuperResendEmailsSection from './SuperResendEmailsSection'
import { MonitorVirtualList } from './MonitorVirtualList'
import type {
  MonitorContaCompany,
  MonitorJobLastRun,
  MonitorPendingNotification,
  MonitorRecentRun,
} from '../api/monitorQueries'

const CONTA_LIST_MAX_HEIGHT = 320
const PENDING_LIST_MAX_HEIGHT = 240
const RECENT_RUNS_MAX_HEIGHT = 360

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
    <Card size="2" style={{ flexShrink: 0 }}>
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
        {!lastRun ? (
          <Text size="1" color="gray">
            No runs logged yet. Status appears after the schedule fires or you
            use Run now.
          </Text>
        ) : (
          <Grid columns={{ initial: '1', sm: '2' }} gap="2">
            <Text size="1" color="gray">
              Last run: {formatMonitorDateTime(lastRun.last_started_at)}
            </Text>
            <Text size="1" color="gray">
              Duration:{' '}
              {formatDurationMs(
                lastRun.last_started_at,
                lastRun.last_finished_at,
              )}
            </Text>
            <Text size="1" color="gray">
              Trigger: {formatTriggerSource(lastRun.last_trigger_source)}
            </Text>
            <Text size="1" color="gray">
              Summary:{' '}
              {summarizeRunDetails(lastRun.job_key, lastRun.last_details)}
            </Text>
          </Grid>
        )}
        {lastRun?.last_error_message ? (
          <Text size="1" color="red">
            {lastRun.last_error_message}
          </Text>
        ) : null}
      </Flex>
    </Card>
  )
}

function ContaCompanyHealthSection({
  companies,
}: {
  companies: Array<MonitorContaCompany>
}) {
  return (
    <Card size="3" style={{ flexShrink: 0 }}>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Heading size="4">Conta company health</Heading>
          <Badge variant="soft" size="1" color="gray">
            {companies.length}{' '}
            {companies.length === 1 ? 'company' : 'companies'}
          </Badge>
        </Flex>
        {companies.length === 0 ? (
          <Text size="2" color="gray">
            No companies configured for Conta sync. Companies need
            accounting_software = conta and an organization id.
          </Text>
        ) : (
          <MonitorVirtualList
            items={companies}
            getItemKey={(row) => row.company_id}
            estimateSize={112}
            maxHeight={CONTA_LIST_MAX_HEIGHT}
            renderItem={(row) => {
              const stale = row.stale_customer_count > 0
              const inactive = !row.api_key_active
              const neverSynced = !row.last_customer_sync_at
              const openInvoices = row.open_conta_invoice_count ?? 0
              return (
                <Box
                  p="3"
                  style={{
                    borderRadius: 'var(--radius-3)',
                    background: 'var(--gray-a2)',
                  }}
                >
                  <Flex
                    align="center"
                    justify="between"
                    gap="3"
                    wrap="wrap"
                    mb="2"
                  >
                    <Text weight="bold" size="3">
                      {row.company_name}
                    </Text>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Badge variant="soft" size="1" color="gray">
                        {row.accounting_api_environment ?? '—'}
                      </Badge>
                      <Badge
                        color={inactive ? 'red' : 'green'}
                        variant="soft"
                        size="1"
                      >
                        {inactive ? 'API inactive' : 'API active'}
                      </Badge>
                    </Flex>
                  </Flex>
                  <Grid columns={{ initial: '2', sm: '4' }} gap="2">
                    <Text size="1" color="gray">
                      Org: {shortenOrgId(row.accounting_organization_id)}
                    </Text>
                    <Text size="1" color="gray">
                      Last sync:{' '}
                      {neverSynced
                        ? 'Never'
                        : formatMonitorDateTime(row.last_customer_sync_at)}
                    </Text>
                    <Text size="1" color="gray">
                      Linked: {row.linked_customer_count}
                      {stale ? ` · Stale: ${row.stale_customer_count}` : ''}
                    </Text>
                    <Text size="1" color="gray">
                      Open invoices: {openInvoices}
                    </Text>
                  </Grid>
                </Box>
              )
            }}
          />
        )}
      </Flex>
    </Card>
  )
}

function EmailPipelineSection({
  pendingCount,
  oldestAge,
  backlogWarning,
  pendingNotifications,
  dispatchPending,
  onDispatch,
}: {
  pendingCount: number
  oldestAge: number | null
  backlogWarning: boolean
  pendingNotifications: Array<MonitorPendingNotification>
  dispatchPending: boolean
  onDispatch: () => void
}) {
  return (
    <Card size="3" style={{ flexShrink: 0 }}>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Heading size="4">Email pipeline</Heading>
          <Button
            type="button"
            size="2"
            variant="soft"
            disabled={dispatchPending}
            onClick={onDispatch}
          >
            {dispatchPending ? 'Dispatching…' : 'Dispatch now'}
          </Button>
        </Flex>
        <Text size="2" color="gray">
          Pending notification emails waiting for send-notification-email.
          Insert trigger + 5-min cron normally keep this clear.
        </Text>
        <Flex align="center" gap="3" wrap="wrap">
          <Text size="2">
            Pending:{' '}
            <Text weight="bold" as="span">
              {pendingCount}
            </Text>
          </Text>
          {oldestAge != null && pendingCount > 0 ? (
            <Text size="2" color="gray">
              Oldest: {oldestAge}m ago
            </Text>
          ) : null}
          {backlogWarning ? (
            <Badge color="amber" variant="soft" size="1">
              Backlog
            </Badge>
          ) : null}
        </Flex>
        {pendingCount === 0 ? (
          <Text size="2" color="gray">
            Queue empty — insert trigger + 5-min cron keep this clear.
          </Text>
        ) : (
          <Flex direction="column" gap="2">
            <MonitorVirtualList
              items={pendingNotifications}
              getItemKey={(n) => n.id}
              estimateSize={64}
              maxHeight={PENDING_LIST_MAX_HEIGHT}
              renderItem={(n) => (
                <Box
                  p="2"
                  style={{
                    borderRadius: 'var(--radius-2)',
                    background: 'var(--gray-a2)',
                  }}
                >
                  <Text size="1" color="gray" as="div">
                    {formatMonitorDateTime(n.created_at)} · {n.type}
                  </Text>
                  <Text size="2">{n.title}</Text>
                </Box>
              )}
            />
            {pendingCount > pendingNotifications.length ? (
              <Text size="1" color="gray">
                Showing oldest {pendingNotifications.length} of {pendingCount}.
              </Text>
            ) : null}
          </Flex>
        )}
      </Flex>
    </Card>
  )
}

function RecentRunsSection({ runs }: { runs: Array<MonitorRecentRun> }) {
  return (
    <Card size="3" style={{ flexShrink: 0 }}>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Heading size="4">Recent runs</Heading>
          <Badge variant="soft" size="1" color="gray">
            {runs.length} shown
          </Badge>
        </Flex>
        {runs.length === 0 ? (
          <Text size="2" color="gray">
            No job runs recorded yet. Runs appear after scheduled jobs execute
            (Vercel/GitHub/pg_cron) or after you use any Run now / Dispatch /
            Advance button above.
          </Text>
        ) : (
          <MonitorVirtualList
            items={runs}
            getItemKey={(run) => run.id}
            estimateSize={96}
            maxHeight={RECENT_RUNS_MAX_HEIGHT}
            renderItem={(run) => {
              const jobName =
                MONITOR_JOB_DEFINITIONS.find((j) => j.jobKey === run.job_key)
                  ?.name ?? run.job_key
              return (
                <Box
                  p="3"
                  style={{
                    borderRadius: 'var(--radius-3)',
                    background: 'var(--gray-a2)',
                  }}
                >
                  <Flex
                    align="center"
                    justify="between"
                    gap="2"
                    wrap="wrap"
                    mb="1"
                  >
                    <Text weight="medium" size="2">
                      {jobName}
                    </Text>
                    <Badge
                      color={statusBadgeColor(run.status)}
                      variant="soft"
                      size="1"
                    >
                      {run.status}
                    </Badge>
                  </Flex>
                  <Grid columns={{ initial: '1', sm: '3' }} gap="1">
                    <Text size="1" color="gray">
                      {formatMonitorDateTime(run.started_at)}
                    </Text>
                    <Text size="1" color="gray">
                      Trigger: {formatTriggerSource(run.trigger_source)}
                    </Text>
                    <Text size="1" color="gray">
                      {summarizeRunDetails(run.job_key, run.details)}
                    </Text>
                  </Grid>
                  {run.error_message ? (
                    <Text size="1" color="red" mt="1" as="div">
                      {run.error_message}
                    </Text>
                  ) : null}
                </Box>
              )
            }}
          />
        )}
      </Flex>
    </Card>
  )
}

export default function SuperMonitorTab() {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    systemMonitorSnapshotQuery(),
  )

  const invalidateSnapshot = () => {
    void qc.invalidateQueries({ queryKey: ['super', 'monitor', 'snapshot'] })
  }

  const syncMutation = useMutation({
    mutationFn: triggerContaSyncNow,
    onSuccess: (result) => {
      invalidateSnapshot()
      const customerMsg = summarizeContaCustomerSyncResults(
        result.customerSync?.results ?? result.results ?? [],
      )
      const invoiceMsg = summarizeContaInvoicePaidSyncResults(
        result.invoicePaidSync?.results ?? [],
      )
      const combined = `Customers: ${customerMsg}. Invoices: ${invoiceMsg}.`
      if (result.ok) {
        success('Conta syncs completed', combined)
      } else {
        toastError('Conta syncs completed with issues', combined)
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
      invalidateSnapshot()
      success(
        'Demo timeline advanced',
        summarizeRunDetails(
          'demo_timeline_advance',
          result as unknown as Record<string, unknown>,
        ),
      )
    },
    onError: (e: unknown) => {
      toastError(
        'Demo timeline advance failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const jobStatusMutation = useMutation({
    mutationFn: triggerJobStatusAutoUpdate,
    onSuccess: (result) => {
      invalidateSnapshot()
      success(
        'Job status auto-update finished',
        `${result.rowsUpdated} jobs updated`,
      )
    },
    onError: (e: unknown) => {
      toastError(
        'Job status auto-update failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const emailDispatchMutation = useMutation({
    mutationFn: triggerEmailDispatchNow,
    onSuccess: (result) => {
      invalidateSnapshot()
      const msg = `${result.scanned} scanned, ${result.sentOrProcessed} sent${result.errors > 0 ? `, ${result.errors} errors` : ''}`
      if (result.errors > 0) {
        toastError('Email dispatch completed with issues', msg)
      } else {
        success('Email dispatch completed', msg)
      }
    },
    onError: (e: unknown) => {
      toastError(
        'Email dispatch failed',
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

  const pendingCount = data?.notificationBacklog?.pendingCount ?? 0
  const oldestAge = ageInMinutes(data?.notificationBacklog?.oldestPendingAt)
  const backlogWarning =
    pendingCount > 10 || (oldestAge != null && oldestAge > 15)

  const problemJobs = React.useMemo(() => {
    return MONITOR_JOB_DEFINITIONS.filter((def) => {
      const status = lastRunByKey.get(def.jobKey)?.last_status
      return status === 'failed' || status === 'partial'
    })
  }, [lastRunByKey])

  const showAlert = problemJobs.length > 0 || backlogWarning

  if (isLoading) {
    return (
      <Card size="3">
        <Flex align="center" gap="2">
          <Spinner size="2" />
          <Text color="gray">Loading system monitor…</Text>
        </Flex>
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

  const renderContaSyncAction = () => (
    <Button
      type="button"
      size="2"
      variant="soft"
      disabled={syncMutation.isPending}
      onClick={() => syncMutation.mutate()}
    >
      <Flex align="center" gap="2">
        <CloudSync width={16} height={16} />
        {syncMutation.isPending ? 'Syncing…' : 'Run Conta syncs now'}
      </Flex>
    </Button>
  )

  const contaCompanies = data?.contaCompanies ?? []
  const recentRuns = data?.recentRuns ?? []
  const pendingNotifications = data?.pendingNotifications ?? []

  return (
    <Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Flex direction="column" gap="4" pb="4">
        <Card size="3" style={{ flexShrink: 0 }}>
          <Flex direction="column" gap="4">
            <Flex align="center" justify="between" gap="3" wrap="wrap">
              <Heading size="5">System monitor</Heading>
              <Flex align="center" gap="2">
                <Text size="1" color="gray">
                  {isFetching ? 'Refreshing…' : 'Auto-refreshes every 60s'}
                </Text>
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  <Flex align="center" gap="1">
                    <Refresh width={14} height={14} />
                    Refresh
                  </Flex>
                </Button>
              </Flex>
            </Flex>
            <Text size="2" color="gray">
              Scheduled job health, Conta sync status, email pipeline backlog,
              and platform snapshot. Superuser only.
            </Text>

            {showAlert ? (
              <Callout.Root color="amber" variant="soft">
                <Callout.Icon>
                  <WarningCircle width={16} height={16} />
                </Callout.Icon>
                <Callout.Text>
                  {problemJobs.length > 0
                    ? `Attention: ${problemJobs.map((j) => j.name).join(', ')} reported ${problemJobs.length === 1 ? 'an issue' : 'issues'} on the last run.`
                    : null}
                  {problemJobs.length > 0 && backlogWarning ? ' ' : null}
                  {backlogWarning
                    ? `Email backlog warning: ${pendingCount} pending${oldestAge != null ? ` (oldest ${oldestAge}m ago)` : ''}.`
                    : null}
                </Callout.Text>
              </Callout.Root>
            ) : null}

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
                  def.jobKey === 'conta_customer_sync' ||
                  def.jobKey === 'conta_invoice_paid_sync' ? (
                    renderContaSyncAction()
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
                  ) : def.jobKey === 'notification_email_dispatch' ? (
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      disabled={emailDispatchMutation.isPending}
                      onClick={() => emailDispatchMutation.mutate()}
                    >
                      {emailDispatchMutation.isPending
                        ? 'Dispatching…'
                        : 'Dispatch now'}
                    </Button>
                  ) : def.jobKey === 'job_status_auto_update' ? (
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      disabled={jobStatusMutation.isPending}
                      onClick={() => jobStatusMutation.mutate()}
                    >
                      {jobStatusMutation.isPending
                        ? 'Updating…'
                        : 'Run status update now'}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </Flex>
        </Box>

        <ContaCompanyHealthSection companies={contaCompanies} />

        <EmailPipelineSection
          pendingCount={pendingCount}
          oldestAge={oldestAge}
          backlogWarning={backlogWarning}
          pendingNotifications={pendingNotifications}
          dispatchPending={emailDispatchMutation.isPending}
          onDispatch={() => emailDispatchMutation.mutate()}
        />

        <SuperResendEmailsSection />

        <RecentRunsSection runs={recentRuns} />
      </Flex>
    </Box>
  )
}
