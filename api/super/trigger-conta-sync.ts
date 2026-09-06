/**
 * Super admin: manually trigger Conta customer sync + invoice paid sync.
 * POST /api/super/trigger-conta-sync
 */
import { createClient } from '@supabase/supabase-js'
import { runContaCustomerSyncForAllCompanies } from '../../src/shared/conta/contaCustomerSyncCron.js'
import { runContaInvoicePaidSyncForAllCompanies } from '../../src/shared/conta/contaInvoicePaidSyncCron.js'
import type { Database } from '../../src/shared/types/database.types.js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = req.headers?.authorization
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ')
      ? auth.slice(7)
      : null
  if (!bearer) {
    res.status(401).json({ error: 'Missing authorization' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    res.status(500).json({ error: 'Missing Supabase config' })
    return
  }

  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(bearer)
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('superuser')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    res.status(500).json({ error: profileError.message })
    return
  }
  if (!profile?.superuser) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const customerOutcome = await runContaCustomerSyncForAllCompanies(
    serviceClient,
    { triggerSource: 'manual' },
  )

  if (customerOutcome.error && customerOutcome.results.length === 0) {
    res.status(500).json({
      error: customerOutcome.error,
      runId: customerOutcome.runId,
    })
    return
  }

  const invoicePaidOutcome = await runContaInvoicePaidSyncForAllCompanies(
    serviceClient,
    { triggerSource: 'manual' },
  )

  res.status(200).json({
    ok: customerOutcome.ok && invoicePaidOutcome.ok,
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
    // Back-compat top-level fields
    runId: customerOutcome.runId,
    status: customerOutcome.status,
    companies: customerOutcome.companies,
    syncedAt: customerOutcome.syncedAt,
    results: customerOutcome.results,
  })
}
