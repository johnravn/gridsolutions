// Supabase Edge Function: send a single notification by email via Resend.
// Invoke with body: { notification_id: string }
// Requires RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY (or use request JWT + anon to read notification if RLS allows).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com/emails'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEBUG_LOG = (m: string, d: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7242/ingest/2d91110b-5d7c-457b-b926-3a30c5abf539', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '63b6c4' },
    body: JSON.stringify({ sessionId: '63b6c4', location: 'send-notification-email', message: m, data: d, timestamp: Date.now() }),
  }).catch(() => {})
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      DEBUG_LOG('Env vars missing', { hasResend: !!resendApiKey, hasUrl: !!supabaseUrl, hasServiceKey: !!supabaseServiceKey, hypothesisId: 'H3' })
      return new Response(
        JSON.stringify({
          error: 'Missing RESEND_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const notificationId = body?.notification_id
    const forceEmail = body?.force_email === true
    if (!notificationId || typeof notificationId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include notification_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    DEBUG_LOG('Edge Function entry', { notificationId, forceEmail, hypothesisId: 'H3' })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('id, user_id, company_id, type, title, body_text, action_url, email_sent_at')
      .eq('id', notificationId)
      .single()

    if (notifError || !notification) {
      return new Response(
        JSON.stringify({ error: 'Notification not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (notification.email_sent_at) {
      return new Response(
        JSON.stringify({ ok: true, already_sent: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', notification.user_id)
      .single()

    const toEmail = profile?.email
    if (!toEmail) {
      DEBUG_LOG('User email not found', { userId: notification.user_id, hypothesisId: 'H4' })
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_offer_updates, email_crew_invites, email_matter_replies, email_reminders, email_announcements')
      .eq('user_id', notification.user_id)
      .eq('company_id', notification.company_id)
      .maybeSingle()

    const prefsRow = prefs || {}
    const shouldSendByType: Record<string, keyof typeof prefsRow> = {
      offer_sent: 'email_offer_updates',
      offer_accepted: 'email_offer_updates',
      offer_rejected: 'email_offer_updates',
      offer_revision_requested: 'email_offer_updates',
      crew_invite: 'email_crew_invites',
      matter_reply: 'email_matter_replies',
      matter_mention: 'email_matter_replies',
      reminder: 'email_reminders',
      announcement: 'email_announcements',
      other: 'email_offer_updates',
    }
    const prefKey = shouldSendByType[notification.type] || 'email_offer_updates'
    const sendEmail = forceEmail || prefsRow[prefKey] !== false

    if (!sendEmail) {
      DEBUG_LOG('Skipped by preferences', { type: notification.type, prefKey, prefValue: prefsRow[prefKey], forceEmail, hypothesisId: 'H4' })
      return new Response(
        JSON.stringify({ ok: true, skipped: 'preferences' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const actionLink = notification.action_url
      ? (notification.action_url.startsWith('http') ? notification.action_url : `${appUrl}${notification.action_url}`)
      : `${appUrl}/notifications`

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #333;">${escapeHtml(notification.title)}</h2>
        ${notification.body_text ? `<p style="color: #555; line-height: 1.5;">${escapeHtml(notification.body_text)}</p>` : ''}
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(actionLink)}" style="background: #3b82f6; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; display: inline-block;">View in app</a>
        </p>
        <p style="margin-top: 24px; font-size: 12px; color: #888;">You received this email because you have notifications enabled for this company.</p>
      </div>
    `

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@resend.dev'
    const fromName = Deno.env.get('RESEND_FROM_NAME') || 'Grid'

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
        'User-Agent': 'Grid-App/1.0',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        subject: notification.title,
        html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      DEBUG_LOG('Resend API failed', { status: res.status, errText, hypothesisId: 'H5' })
      return new Response(
        JSON.stringify({ error: 'Resend failed', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    DEBUG_LOG('Email sent successfully', { toEmail, hypothesisId: 'H5' })

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (updateError) {
      return new Response(
        JSON.stringify({ ok: true, email_sent: true, warning: 'Could not update email_sent_at' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, email_sent: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
