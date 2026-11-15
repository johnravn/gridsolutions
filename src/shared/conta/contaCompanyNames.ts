/**
 * Resolve Conta sync company display names for scheduled_job_runs details.
 * No path aliases — safe for Vercel serverless.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types.js'

export async function loadContaCompanyNames(
  supabase: SupabaseClient<Database>,
  companyIds: Array<string>,
): Promise<Map<string, string>> {
  const ids = [...new Set(companyIds.filter(Boolean))]
  const map = new Map<string, string>()
  if (ids.length === 0) return map

  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', ids)

  if (error) {
    console.error('Failed to load Conta company names:', error.message)
    return map
  }

  for (const row of data ?? []) {
    if (row.id && row.name) map.set(row.id, row.name)
  }
  return map
}

export function withCompanyName<T extends { companyId: string }>(
  result: T,
  names: Map<string, string>,
): T & { companyName: string | null } {
  return {
    ...result,
    companyName: names.get(result.companyId) ?? null,
  }
}
