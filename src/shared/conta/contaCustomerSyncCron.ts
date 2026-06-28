/**
 * Conta customer sync orchestration for cron / super manual trigger.
 * No path aliases — safe for Vercel serverless.
 */

import { makeContaFetch, syncCustomersWithContaCore } from './customerSyncCore'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const contaBaseUrl =
  process.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
const contaSandboxUrl =
  process.env.VITE_CONTA_API_URL_SANDBOX ||
  'https://api.gateway.conta-sandbox.no'

export type ContaSyncCompanyResult = {
  companyId: string
  updated: number
  created: number
  skipped: number
  skippedReason?: string
  errors: Array<string>
}

export type ScheduledJobRunStatus = 'running' | 'success' | 'partial' | 'failed'

export type ContaSyncTriggerSource =
  | 'vercel_cron'
  | 'github_actions'
  | 'manual'
  | 'pg_cron'

export function deriveContaSyncStatus(
  results: Array<ContaSyncCompanyResult>,
  topLevelError?: string | null,
): ScheduledJobRunStatus {
  if (topLevelError) return 'failed'
  if (results.length === 0) return 'success'

  const allFailed = results.every(
    (r) =>
      r.errors.length > 0 &&
      r.updated === 0 &&
      r.created === 0 &&
      !r.skippedReason,
  )
  if (allFailed) return 'failed'

  const hasPartial = results.some(
    (r) => r.errors.length > 0 || Boolean(r.skippedReason),
  )
  if (hasPartial) return 'partial'

  return 'success'
}

export function summarizeContaSyncResults(
  results: Array<ContaSyncCompanyResult>,
): string {
  const updated = results.reduce((n, r) => n + r.updated, 0)
  const created = results.reduce((n, r) => n + r.created, 0)
  const skipped = results.reduce((n, r) => n + r.skipped, 0)
  const errors = results.reduce((n, r) => n + r.errors.length, 0)
  return `${updated} updated, ${created} created, ${skipped} skipped${errors > 0 ? `, ${errors} errors` : ''}`
}

async function startJobRun(
  supabase: SupabaseClient<Database>,
  triggerSource: ContaSyncTriggerSource,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('scheduled_job_runs')
    .insert({
      job_key: 'conta_customer_sync',
      status: 'running',
      trigger_source: triggerSource,
      details: {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to start scheduled_job_runs row:', error.message)
    return null
  }
  return data.id
}

async function finishJobRun(
  supabase: SupabaseClient<Database>,
  runId: string | null,
  status: ScheduledJobRunStatus,
  details: Record<string, unknown>,
  errorMessage?: string | null,
): Promise<void> {
  if (!runId) return

  const { error } = await supabase
    .from('scheduled_job_runs')
    .update({
      finished_at: new Date().toISOString(),
      status,
      details,
      error_message: errorMessage ?? null,
    })
    .eq('id', runId)

  if (error) {
    console.error('Failed to finish scheduled_job_runs row:', error.message)
  }
}

export type RunContaCustomerSyncResult = {
  ok: boolean
  runId: string | null
  companies: number
  syncedAt: string
  status: ScheduledJobRunStatus
  results: Array<ContaSyncCompanyResult>
  error?: string
}

export async function runContaCustomerSyncForAllCompanies(
  supabase: SupabaseClient<Database>,
  opts?: { triggerSource?: ContaSyncTriggerSource },
): Promise<RunContaCustomerSyncResult> {
  const triggerSource = opts?.triggerSource ?? 'vercel_cron'
  const syncedAt = new Date().toISOString()
  const runId = await startJobRun(supabase, triggerSource)

  const { data: companies, error: companiesError } = await supabase
    .from('company_expansions')
    .select(
      'company_id, accounting_organization_id, accounting_api_environment',
    )
    .not('accounting_organization_id', 'is', null)
    .eq('accounting_software', 'conta')

  if (companiesError) {
    const status: ScheduledJobRunStatus = 'failed'
    await finishJobRun(
      supabase,
      runId,
      status,
      { companies: 0, results: [] },
      companiesError.message,
    )
    return {
      ok: false,
      runId,
      companies: 0,
      syncedAt,
      status,
      results: [],
      error: companiesError.message,
    }
  }

  const results: Array<ContaSyncCompanyResult> = []

  for (const row of companies ?? []) {
    const orgId = row.accounting_organization_id
    if (!orgId) continue

    const { data: apiKey, error: keyError } = await supabase.rpc(
      'get_conta_api_key_for_sync',
      { p_company_id: row.company_id },
    )
    if (keyError) {
      results.push({
        companyId: row.company_id,
        updated: 0,
        created: 0,
        skipped: 0,
        errors: [keyError.message],
      })
      continue
    }
    if (!apiKey) {
      results.push({
        companyId: row.company_id,
        updated: 0,
        created: 0,
        skipped: 0,
        skippedReason: 'No active Conta API key for company',
        errors: [],
      })
      continue
    }

    const isSandbox = row.accounting_api_environment === 'sandbox'
    const baseUrl = isSandbox ? contaSandboxUrl : contaBaseUrl

    try {
      const r = await syncCustomersWithContaCore(
        row.company_id,
        orgId,
        makeContaFetch({ apiKey, baseUrl }),
        supabase,
      )
      results.push({
        companyId: row.company_id,
        updated: r.updated,
        created: r.created,
        skipped: r.skipped,
        errors: r.errors,
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sync failed'
      results.push({
        companyId: row.company_id,
        updated: 0,
        created: 0,
        skipped: 0,
        errors: [message],
      })
    }
  }

  const status = deriveContaSyncStatus(results)
  const details = {
    companies: results.length,
    syncedAt,
    results,
    summary: summarizeContaSyncResults(results),
  }
  await finishJobRun(supabase, runId, status, details)

  return {
    ok: status !== 'failed',
    runId,
    companies: results.length,
    syncedAt,
    status,
    results,
  }
}
