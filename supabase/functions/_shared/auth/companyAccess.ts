import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function forbiddenResponse(
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Company staff or superuser may act on that company's email sends. */
export async function userIsCompanyMemberOrSuperuser(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<boolean> {
  if (!companyId) return false

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('superuser')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  return Boolean(membership) || profile?.superuser === true
}
