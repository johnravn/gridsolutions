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
}

export type MonitorNotificationBacklog = {
  pendingCount: number
  oldestPendingAt: string | null
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
    jobKey: 'notification_email_dispatch',
    name: 'Notification email dispatch',
    schedule: 'Every minute (pg_cron)',
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
]

export function systemMonitorSnapshotQuery() {
  return {
    queryKey: ['super', 'monitor', 'snapshot'] as const,
    queryFn: async (): Promise<SystemMonitorSnapshot> => {
      const { data, error } = await supabase.rpc('get_system_monitor_snapshot')
      if (error) throw error
      return data as SystemMonitorSnapshot
    },
    refetchInterval: 60_000,
  }
}

export type TriggerContaSyncResult = {
  ok: boolean
  runId: string | null
  status: ScheduledJobRunStatus
  companies: number
  syncedAt: string
  results: Array<{
    companyId: string
    updated: number
    created: number
    skipped: number
    skippedReason?: string
    errors: Array<string>
  }>
  error?: string
}

export async function triggerContaSyncNow(): Promise<TriggerContaSyncResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) {
    throw new Error('Not signed in')
  }

  const res = await fetch('/api/super/trigger-conta-sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const body = (await res.json()) as TriggerContaSyncResult & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Sync failed (${res.status})`)
  }
  return body
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
  if (jobKey === 'conta_customer_sync') {
    const summary = details.summary
    if (typeof summary === 'string') return summary
    return 'Conta sync completed'
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

export async function fetchResendSentEmails(params?: {
  after?: string
  limit?: number
}): Promise<ResendSentEmailsPage> {
  const { data, error } = await supabase.functions.invoke(
    'list-resend-emails',
    {
      body: {
        limit: params?.limit ?? RESEND_EMAILS_PAGE_SIZE,
        ...(params?.after ? { after: params.after } : {}),
      },
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  const body = data as ResendSentEmailsPage & {
    error?: string
    details?: string
  }
  if (!body || body.ok !== true) {
    throw new Error(
      body?.details ?? body?.error ?? 'Failed to load Resend emails',
    )
  }
  return body
}

export async function fetchResendSentEmailDetail(
  emailId: string,
): Promise<ResendSentEmailDetail> {
  const { data, error } = await supabase.functions.invoke(
    'list-resend-emails',
    {
      body: { email_id: emailId },
    },
  )

  if (error) {
    throw new Error(error.message)
  }

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
