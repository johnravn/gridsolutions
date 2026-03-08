/**
 * Cron: Sync Subb customers with Conta.
 * Triggered weekly by Vercel Cron. Requires CRON_SECRET in env.
 * GET /api/cron/sync-conta
 * Header: Authorization: Bearer <CRON_SECRET>
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/shared/types/database.types'
import { syncCustomersWithConta } from '../../src/features/customers/api/contaCustomerSync'

const contaBaseUrl =
  process.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
const contaSandboxUrl =
  process.env.VITE_CONTA_API_URL_SANDBOX || 'https://api.gateway.conta-sandbox.no'

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

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Missing Supabase config' })
    return
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: companies } = await supabase
    .from('company_expansions')
    .select('company_id, accounting_organization_id, accounting_api_environment')
    .not('accounting_organization_id', 'is', null)
    .eq('accounting_software', 'conta')

  const results: Array<{
    companyId: string
    updated: number
    created: number
    skipped: number
    errors: string[]
  }> = []

  for (const row of companies ?? []) {
    const orgId = row.accounting_organization_id
    if (!orgId) continue

    const { data: apiKey } = await supabase.rpc('get_conta_api_key_for_sync', {
      p_company_id: row.company_id,
    })
    if (!apiKey) continue

    const isSandbox = row.accounting_api_environment === 'sandbox'
    const baseUrl = isSandbox ? contaSandboxUrl : contaBaseUrl

    try {
      const r = await syncCustomersWithConta(
        row.company_id,
        orgId,
        { apiKey, baseUrl },
        supabase,
      )
      results.push({
        companyId: row.company_id,
        updated: r.updated,
        created: r.created,
        skipped: r.skipped,
        errors: r.errors,
      })
    } catch (e: any) {
      results.push({
        companyId: row.company_id,
        updated: 0,
        created: 0,
        skipped: 0,
        errors: [e?.message ?? 'Sync failed'],
      })
    }
  }

  res.status(200).json({
    ok: true,
    companies: results.length,
    results,
  })
}
