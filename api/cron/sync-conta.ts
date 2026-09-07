/**
 * Cron: Sync Subb customers with Conta, then pull Conta paid invoice status into Grid.
 * Triggered daily by Vercel Cron (production). GET /api/cron/sync-conta
 * Requires Authorization: Bearer ${CRON_SECRET}. User-Agent is logging only.
 */
import { createClient } from '@supabase/supabase-js'
import { runContaCustomerSyncForAllCompanies } from '../../src/shared/conta/contaCustomerSyncCron.js'
import { runContaInvoicePaidSyncForAllCompanies } from '../../src/shared/conta/contaInvoicePaidSyncCron.js'
import type { ContaSyncTriggerSource } from '../../src/shared/conta/contaCustomerSyncCron.js'
import type { Database } from '../../src/shared/types/database.types.js'

function resolveTriggerSource(req: {
  headers?: Record<string, string | Array<string> | undefined>
}): ContaSyncTriggerSource {
  const raw = req.headers?.['x-trigger-source']
  const header = Array.isArray(raw) ? raw[0] : raw
  if (header === 'github_actions') return 'github_actions'
  if (req.headers?.['user-agent']?.includes('vercel-cron')) return 'vercel_cron'
  return 'manual'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers?.authorization
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null

  // Fail closed: User-Agent is not auth (vercel-cron is trivial to forge).
  if (!cronSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (bearer !== cronSecret) {
    res.status(401).json({ error: 'Invalid CRON_SECRET' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({
      error: 'Missing Supabase config',
      detail:
        'Set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL on Vercel (Production).',
    })
    return
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const triggerSource = resolveTriggerSource(req)
  const customerOutcome = await runContaCustomerSyncForAllCompanies(supabase, {
    triggerSource,
  })

  if (customerOutcome.error && customerOutcome.results.length === 0) {
    res.status(500).json({
      error: customerOutcome.error,
      runId: customerOutcome.runId,
    })
    return
  }

  const invoicePaidOutcome = await runContaInvoicePaidSyncForAllCompanies(
    supabase,
    { triggerSource },
  )

  const ok = customerOutcome.ok && invoicePaidOutcome.ok

  res.status(200).json({
    ok,
    customerSync: {
      ok: customerOutcome.ok,
      runId: customerOutcome.runId,
      status: customerOutcome.status,
      companies: customerOutcome.companies,
      syncedAt: customerOutcome.syncedAt,
      results: customerOutcome.results,
    },
    invoicePaidSync: {
      ok: invoicePaidOutcome.ok,
      runId: invoicePaidOutcome.runId,
      status: invoicePaidOutcome.status,
      companies: invoicePaidOutcome.companies,
      syncedAt: invoicePaidOutcome.syncedAt,
      results: invoicePaidOutcome.results,
      error: invoicePaidOutcome.error,
    },
    // Back-compat top-level fields for existing monitors / tests
    runId: customerOutcome.runId,
    status: customerOutcome.status,
    companies: customerOutcome.companies,
    syncedAt: customerOutcome.syncedAt,
    results: customerOutcome.results,
  })
}
