/**
 * Cron: Sync Subb customers with Conta.
 * Triggered daily by Vercel Cron (production). GET /api/cron/sync-conta
 */
import { createClient } from '@supabase/supabase-js'
import { runContaCustomerSyncForAllCompanies } from '../../src/shared/conta/contaCustomerSyncCron'
import type { ContaSyncTriggerSource } from '../../src/shared/conta/contaCustomerSyncCron'
import type { Database } from '../../src/shared/types/database.types'

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
  const isVercelCron = req.headers?.['user-agent']?.includes('vercel-cron')

  if (!cronSecret && !isVercelCron) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (cronSecret && bearer !== cronSecret && !isVercelCron) {
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
  const outcome = await runContaCustomerSyncForAllCompanies(supabase, {
    triggerSource,
  })

  if (outcome.error && outcome.results.length === 0) {
    res.status(500).json({ error: outcome.error, runId: outcome.runId })
    return
  }

  res.status(200).json({
    ok: outcome.ok,
    runId: outcome.runId,
    status: outcome.status,
    companies: outcome.companies,
    syncedAt: outcome.syncedAt,
    results: outcome.results,
  })
}
