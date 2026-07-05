/**
 * Reset accept/reject/revision public-offer fixtures to "sent" between E2E runs.
 * Chromium and mobile-chrome projects run in parallel and share the same tokens.
 */
import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnv } from '../../scripts/loadLocalSupabaseEnv.mjs'

const MUTABLE_TOKENS = [
  'e2e-test-accept-offer-token',
  'e2e-test-reject-offer-token',
  'e2e-test-revision-offer-token',
]

const RESET_FIELDS = {
  status: 'sent',
  accepted_at: null,
  accepted_by_email: null,
  accepted_by_name: null,
  accepted_by_phone: null,
  rejected_at: null,
  rejected_by_name: null,
  rejected_by_phone: null,
  rejection_comment: null,
  revision_requested_at: null,
  revision_requested_by_name: null,
  revision_requested_by_phone: null,
  revision_comment: null,
}

export async function resetMutablePublicOffers() {
  const loaded = loadLocalSupabaseEnv()
  const url =
    loaded?.url ??
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    'http://127.0.0.1:54321'
  const serviceRoleKey =
    loaded?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required to reset public offer fixtures.',
    )
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const accessToken of MUTABLE_TOKENS) {
    const { error } = await admin
      .from('job_offers')
      .update(RESET_FIELDS)
      .eq('access_token', accessToken)

    if (error) throw error
  }
}
