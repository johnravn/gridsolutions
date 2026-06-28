// Supabase Edge Function: dispatch pending notification emails server-side.
// Intended to be invoked by pg_cron + pg_net on a schedule.
//
// It scans for notifications that have not been processed (email_sent_at is null)
// and calls the existing send-notification-email function for each.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailFunctionCorsHeaders } from '../_shared/email/resend.ts'

const corsHeaders = emailFunctionCorsHeaders

type DispatchResult = {
  ok: true
  runId?: string | null
  scanned: number
  attempted: number
  sentOrProcessed: number
  errors: number
}

type JobRunStatus = 'running' | 'success' | 'partial' | 'failed'

async function startJobRun(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('scheduled_job_runs')
    .insert({
      job_key: 'notification_email_dispatch',
      status: 'running',
      trigger_source: 'pg_cron',
      details: {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to start scheduled_job_runs row:', error.message)
    return null
  }
  return data.id as string
}

async function finishJobRun(
  supabase: ReturnType<typeof createClient>,
  runId: string | null,
  status: JobRunStatus,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const runId = await startJobRun(supabase)

  try {
    const { data: pending, error } = await supabase
      .from('notifications')
      .select('id, created_at, email_force_send')
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
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          notification_id: n.id,
          force_email:
            (n as { email_force_send?: boolean }).email_force_send === true,
        }),
      }).catch(() => null)

      if (!res) {
        errors++
        continue
      }
      if (!res.ok) {
        errors++
        continue
      }
      sentOrProcessed++
    }

    const details = { scanned, attempted, sentOrProcessed, errors }
    const status: JobRunStatus = errors > 0 ? 'partial' : 'success'
    await finishJobRun(supabase, runId, status, details)

    const out: DispatchResult = {
      ok: true,
      runId,
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
    const message = e instanceof Error ? e.message : String(e)
    await finishJobRun(
      supabase,
      runId,
      'failed',
      { scanned: 0, attempted: 0, sentOrProcessed: 0, errors: 0 },
      message,
    )
    return new Response(JSON.stringify({ error: message, runId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
