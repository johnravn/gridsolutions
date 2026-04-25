// Supabase Edge Function: dispatch pending notification emails server-side.
// Intended to be invoked by pg_cron + pg_net on a schedule.
//
// It scans for notifications that have not been processed (email_sent_at is null)
// and calls the existing send-notification-email function for each.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type DispatchResult = {
  ok: true
  scanned: number
  attempted: number
  sentOrProcessed: number
  errors: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Service role: bypass RLS so this can run unattended.
    const supabase = createClient(supabaseUrl, serviceKey)

    // Keep batches small to stay within function limits.
    const { data: pending, error } = await supabase
      .from('notifications')
      .select('id, created_at')
      .is('email_sent_at', null)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error

    const scanned = pending?.length ?? 0
    let attempted = 0
    let sentOrProcessed = 0
    let errors = 0

    const fnUrl = `${supabaseUrl}/functions/v1/send-notification-email`
    for (const n of pending ?? []) {
      attempted++
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // use service role to invoke without relying on anon keys/vault
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ notification_id: n.id, force_email: false }),
      }).catch(() => null)

      if (!res) {
        errors++
        continue
      }
      if (!res.ok) {
        errors++
        continue
      }
      // send-notification-email marks email_sent_at when sent AND when skipped-by-preferences.
      sentOrProcessed++
    }

    const out: DispatchResult = {
      ok: true,
      scanned,
      attempted,
      sentOrProcessed,
      errors,
    }

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

