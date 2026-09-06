import { supabase } from '@shared/api/supabase'

export type ScheduledJobRunStatus = 'running' | 'success' | 'partial' | 'failed'

export type MonitorJobLastRun = {
  job_key: string
  last_run_id: string
  last_started_at: string
  last_finished_at: string | null
  last_status: ScheduledJobRunStatus
  last_trigger_source: string | null
  last_details: Record<string, unknown> | null
  last_error_message: string | null
}

export type MonitorRecentRun = {
  id: string
  job_key: string
  started_at: string
  finished_at: string | null
  status: ScheduledJobRunStatus
  trigger_source: string | null
  details: Record<string, unknown> | null
  error_message: string | null
}

export type MonitorContaCompany = {
  company_id: string
  company_name: string
  api_key_active: boolean
  accounting_organization_id: string
  accounting_api_environment: string | null
  last_customer_sync_at: string | null
  linked_customer_count: number
  stale_customer_count: number
  open_conta_invoice_count: number
}

export type MonitorNotificationBacklog = {
  pendingCount: number
  oldestPendingAt: string | null
}

export type MonitorPendingNotification = {
  id: string
  created_at: string
  type: string
  title: string
}

export type MonitorPlatformCounts = {
  companies: number
  users: number
  inProgressJobs: number
}

export type SystemMonitorSnapshot = {
  jobs: Array<MonitorJobLastRun>
  recentRuns: Array<MonitorRecentRun>
  contaCompanies: Array<MonitorContaCompany>
  notificationBacklog: MonitorNotificationBacklog
  pendingNotifications: Array<MonitorPendingNotification>
  platformCounts: MonitorPlatformCounts
}

export const MONITOR_JOB_DEFINITIONS: Array<{
  jobKey: string
  name: string
  schedule: string
  description: string
}> = [
  {
    jobKey: 'conta_customer_sync',
    name: 'Conta customer sync',
    schedule: 'Daily at 03:00 UTC (Vercel) + 03:15 UTC backup (GitHub Actions)',
    description:
      'Syncs Subb customers with Conta for all companies using Conta accounting.',
  },
  {
    jobKey: 'conta_invoice_paid_sync',
    name: 'Conta invoice paid sync',
    schedule: 'Daily at 03:00 UTC (Vercel) + 03:15 UTC backup (GitHub Actions)',
    description:
      'Pulls Conta invoice paid status into Grid job_invoices and linked jobs (read-only).',
  },
  {
    jobKey: 'notification_email_dispatch',
    name: 'Notification email dispatch',
    schedule: 'Every 5 minutes (pg_cron)',
    description:
      'Processes pending notification emails via send-notification-email.',
  },
  {
    jobKey: 'job_status_auto_update',
    name: 'Job status auto-update',
    schedule: 'Hourly at :00 (pg_cron)',
    description:
      'Moves confirmed/planned/requested jobs to in_progress when start_at has passed.',
  },
  {
    jobKey: 'demo_timeline_advance',
    name: 'Demo timeline advance',
    schedule: 'Weekly on Monday at 04:00 UTC (pg_cron)',
    description:
      'Shifts all non-archived demo company jobs and related schedules forward by 7 days.',
  },
]

function asObjectArray<T extends Record<string, unknown>>(
  value: unknown,
): Array<T> {
  if (Array.isArray(value)) return value as Array<T>
  return []
}

export function systemMonitorSnapshotQuery() {
  return {
    queryKey: ['super', 'monitor', 'snapshot'] as const,
    queryFn: async (): Promise<SystemMonitorSnapshot> => {
      const { data, error } = await supabase.rpc('get_system_monitor_snapshot')
      if (error) throw error

      const raw =
        typeof data === 'string'
          ? (JSON.parse(data) as Record<string, unknown>)
          : ((data ?? {}) as Record<string, unknown>)

      const notificationBacklogRaw =
        (raw.notificationBacklog as MonitorNotificationBacklog | null) ?? null
      const platformCountsRaw =
        (raw.platformCounts as MonitorPlatformCounts | null) ?? null

      return {
        jobs: asObjectArray<MonitorJobLastRun>(raw.jobs),
        recentRuns: asObjectArray<MonitorRecentRun>(raw.recentRuns),
        contaCompanies: asObjectArray<MonitorContaCompany>(
          raw.contaCompanies,
        ).map((row) => ({
          ...row,
          open_conta_invoice_count: Number(row.open_conta_invoice_count ?? 0),
          linked_customer_count: Number(row.linked_customer_count ?? 0),
          stale_customer_count: Number(row.stale_customer_count ?? 0),
          api_key_active: Boolean(row.api_key_active ?? true),
        })),
        notificationBacklog: {
          pendingCount: Number(notificationBacklogRaw?.pendingCount ?? 0),
          oldestPendingAt: notificationBacklogRaw?.oldestPendingAt ?? null,
        },
        pendingNotifications: asObjectArray<MonitorPendingNotification>(
          raw.pendingNotifications,
        ),
        platformCounts: {
          companies: Number(platformCountsRaw?.companies ?? 0),
          users: Number(platformCountsRaw?.users ?? 0),
          inProgressJobs: Number(platformCountsRaw?.inProgressJobs ?? 0),
        },
      }
    },
    refetchInterval: 60_000,
  }
}

export type ContaSyncLegResult = {
  ok: boolean
  runId: string | null
  status: ScheduledJobRunStatus
  companies: number
  syncedAt: string
  results: Array<{
    companyId: string
    updated?: number
    created?: number
    checked?: number
    invoicesMarkedPaid?: number
    jobsMarkedPaid?: number
    skipped: number
    skippedReason?: string
    errors: Array<string>
  }>
  error?: string
}

export type TriggerContaSyncResult = {
  ok: boolean
  customerSync: ContaSyncLegResult
  invoicePaidSync: ContaSyncLegResult
  /** Back-compat top-level fields (customer sync) */
  runId: string | null
  status: ScheduledJobRunStatus
  companies: number
  syncedAt: string
  results: ContaSyncLegResult['results']
  error?: string
}

export type AdvanceDemoTimelineResult = {
  intervalDays: number
  jobsUpdated: number
  timePeriodsUpdated: number
  reservedItemsUpdated: number
  reservedVehiclesUpdated: number
  offerCrewItemsUpdated: number
  offerTransportItemsUpdated: number
  offerBlockItemsUpdated: number
  timeEntriesUpdated: number
  message?: string
}

export type TriggerJobStatusAutoUpdateResult = {
  rowsUpdated: number
}

export type TriggerEmailDispatchResult = {
  ok: true
  runId?: string | null
  scanned: number
  attempted: number
  sentOrProcessed: number
  errors: number
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) {
    throw new Error('Not signed in')
  }
  return session.access_token
}

export async function triggerDemoTimelineAdvance(): Promise<AdvanceDemoTimelineResult> {
  const { data, error } = await supabase.rpc('advance_demo_company_timeline')
  if (error) {
    throw new Error(error.message || 'Demo timeline advance failed')
  }
  return data as AdvanceDemoTimelineResult
}

export async function triggerJobStatusAutoUpdate(): Promise<TriggerJobStatusAutoUpdateResult> {
  const { data, error } = await supabase.rpc('trigger_job_status_auto_update')
  if (error) throw error
  return data as TriggerJobStatusAutoUpdateResult
}

export async function triggerContaSyncNow(): Promise<TriggerContaSyncResult> {
  const accessToken = await getAccessToken()

  const res = await fetch('/api/super/trigger-conta-sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = (await res.json()) as TriggerContaSyncResult & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Sync failed (${res.status})`)
  }
  return body
}

export async function triggerEmailDispatchNow(): Promise<TriggerEmailDispatchResult> {
  const accessToken = await getAccessToken()

  const res = await fetch('/api/super/trigger-email-dispatch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = (await res.json()) as TriggerEmailDispatchResult & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(body.error ?? `Dispatch failed (${res.status})`)
  }
  return body
}

export function summarizeContaCustomerSyncResults(
  results: ContaSyncLegResult['results'],
): string {
  const updated = results.reduce((n, r) => n + (r.updated ?? 0), 0)
  const created = results.reduce((n, r) => n + (r.created ?? 0), 0)
  const skipped = results.reduce((n, r) => n + r.skipped, 0)
  const errors = results.reduce((n, r) => n + r.errors.length, 0)
  return `${updated} updated, ${created} created, ${skipped} skipped${errors > 0 ? `, ${errors} errors` : ''}`
}

export function summarizeContaInvoicePaidSyncResults(
  results: ContaSyncLegResult['results'],
): string {
  const checked = results.reduce((n, r) => n + (r.checked ?? 0), 0)
  const invoices = results.reduce((n, r) => n + (r.invoicesMarkedPaid ?? 0), 0)
  const jobs = results.reduce((n, r) => n + (r.jobsMarkedPaid ?? 0), 0)
  const skipped = results.reduce((n, r) => n + r.skipped, 0)
  const errors = results.reduce((n, r) => n + r.errors.length, 0)
  return `${checked} checked, ${invoices} invoices paid, ${jobs} jobs paid, ${skipped} skipped${errors > 0 ? `, ${errors} errors` : ''}`
}

export function formatMonitorDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDurationMs(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
): string {
  if (!startedAt || !finishedAt) return '—'
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

export function statusBadgeColor(
  status: ScheduledJobRunStatus | null | undefined,
): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  switch (status) {
    case 'success':
      return 'green'
    case 'partial':
      return 'amber'
    case 'failed':
      return 'red'
    case 'running':
      return 'blue'
    default:
      return 'gray'
  }
}

export function summarizeRunDetails(
  jobKey: string,
  details: Record<string, unknown> | null,
): string {
  if (!details) return '—'
  if (
    jobKey === 'conta_customer_sync' ||
    jobKey === 'conta_invoice_paid_sync'
  ) {
    const summary = details.summary
    if (typeof summary === 'string') return summary
    return jobKey === 'conta_invoice_paid_sync'
      ? 'Conta invoice paid sync completed'
      : 'Conta sync completed'
  }
  if (jobKey === 'notification_email_dispatch') {
    const scanned = details.scanned
    const errors = details.errors
    if (typeof scanned === 'number') {
      const errPart =
        typeof errors === 'number' && errors > 0 ? `, ${errors} errors` : ''
      return `${scanned} scanned${errPart}`
    }
  }
  if (jobKey === 'job_status_auto_update') {
    const rows = details.rowsUpdated
    if (typeof rows === 'number') return `${rows} jobs updated`
  }
  if (jobKey === 'demo_timeline_advance') {
    const jobs = details.jobsUpdated
    const periods = details.timePeriodsUpdated
    if (typeof jobs === 'number' && typeof periods === 'number') {
      return `${jobs} jobs, ${periods} time periods +${details.intervalDays ?? 7}d`
    }
    const message = details.message
    if (typeof message === 'string') return message
  }
  return 'Completed'
}

export function formatTriggerSource(source: string | null | undefined): string {
  if (!source) return '—'
  return source.replace(/_/g, ' ')
}

export function ageInMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

export function shortenOrgId(orgId: string | null | undefined): string {
  if (!orgId) return '—'
  if (orgId.length <= 12) return orgId
  return `${orgId.slice(0, 6)}…${orgId.slice(-4)}`
}

export type ResendSentEmail = {
  id: string
  message_id: string | null
  to: Array<string>
  from: string
  created_at: string
  subject: string
  bcc: Array<string> | null
  cc: Array<string> | null
  reply_to: Array<string> | null
  last_event: string | null
  scheduled_at: string | null
}

export type ResendSentEmailDetail = ResendSentEmail & {
  html?: string | null
  text?: string | null
}

export type ResendSentEmailsPage = {
  ok: true
  has_more: boolean
  data: Array<ResendSentEmail>
}

const RESEND_EMAILS_PAGE_SIZE = 50

async function invokeListResendEmails(
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: Error | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) return { data: null, error: new Error(userError.message) }
  if (!userData.user) return { data: null, error: new Error('Not signed in') }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (sessionError)
    return { data: null, error: new Error(sessionError.message) }
  const token = sessionData.session?.access_token
  if (!token) return { data: null, error: new Error('Not signed in') }

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(
    /\/$/,
    '',
  )
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const response = await fetch(`${baseUrl}/functions/v1/list-resend-emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const details =
      data && typeof data === 'object'
        ? ((data as { details?: string; error?: string }).details ??
          (data as { error?: string }).error)
        : null
    return {
      data,
      error: new Error(
        details
          ? `list-resend-emails failed (${response.status}): ${details}`
          : `list-resend-emails failed (${response.status})`,
      ),
    }
  }

  return { data, error: null }
}

export async function fetchResendSentEmails(params?: {
  after?: string
  limit?: number
}): Promise<ResendSentEmailsPage> {
  const { data, error } = await invokeListResendEmails({
    limit: params?.limit ?? RESEND_EMAILS_PAGE_SIZE,
    ...(params?.after ? { after: params.after } : {}),
  })

  if (error) throw error

  const body = data as ResendSentEmailsPage & {
    error?: string
    details?: string
  }
  if (!body || body.ok !== true) {
    throw new Error(
      body?.details ??
        body?.error ??
        'Failed to load Resend emails. Check RESEND_API_KEY and docs/EMAIL.md.',
    )
  }
  return body
}

export async function fetchResendSentEmailDetail(
  emailId: string,
): Promise<ResendSentEmailDetail> {
  const { data, error } = await invokeListResendEmails({ email_id: emailId })

  if (error) throw error

  const body = data as {
    ok?: boolean
    email?: ResendSentEmailDetail
    error?: string
    details?: string
  }
  if (!body?.ok || !body.email) {
    throw new Error(
      body?.details ?? body?.error ?? 'Failed to load email detail',
    )
  }
  return body.email
}

export function formatResendRecipients(
  to: Array<string> | null | undefined,
): string {
  if (!to?.length) return '—'
  if (to.length <= 2) return to.join(', ')
  return `${to.slice(0, 2).join(', ')} +${to.length - 2}`
}

export function resendEventBadgeColor(
  event: string | null | undefined,
): 'green' | 'amber' | 'red' | 'blue' | 'gray' {
  const e = (event ?? '').toLowerCase()
  if (e === 'delivered' || e === 'sent') return 'green'
  if (e === 'bounced' || e === 'failed' || e === 'complained') return 'red'
  if (e === 'opened' || e === 'clicked') return 'blue'
  if (e === 'delivery_delayed' || e === 'scheduled') return 'amber'
  return 'gray'
}
