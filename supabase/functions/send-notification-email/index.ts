// Supabase Edge Function: send a single notification by email via Resend.
// Invoke with body: { notification_id: string, force_email?: boolean }
// Requires RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailFunctionCorsHeaders,
  escapeHtml,
  getResendApiKey,
  sendResendHtmlEmail,
} from '../_shared/email/resend.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: emailFunctionCorsHeaders })
  }

  try {
    const resendApiKey = getResendApiKey()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing RESEND_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY',
        }),
        { status: 500, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const notificationId = body?.notification_id
    const forceEmail =
      body?.force_email === true ||
      (notification as { email_force_send?: boolean }).email_force_send === true
    if (!notificationId || typeof notificationId !== 'string') {
      return new Response(JSON.stringify({ error: 'Body must include notification_id' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select(
        'id, user_id, company_id, type, title, body_text, action_url, email_sent_at, email_force_send',
      )
      .eq('id', notificationId)
      .single()

    if (notifError || !notification) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (notification.email_sent_at) {
      return new Response(JSON.stringify({ ok: true, already_sent: true }), {
        status: 200,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', notification.user_id)
      .single()

    const toEmail = profile?.email
    if (!toEmail) {
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(
        'email_offer_updates, email_crew_invites, email_matter_replies, email_reminders, email_announcements, email_matter_announcements, email_matter_updates, email_matter_invites',
      )
      .eq('user_id', notification.user_id)
      .eq('company_id', notification.company_id)
      .maybeSingle()

    type Prefs = Record<string, boolean | undefined>
    const prefsRow = (prefs || {}) as Prefs

    const on = (primary: string, legacy?: string): boolean => {
      const v = prefsRow[primary]
      if (typeof v === 'boolean') return v !== false
      if (legacy) {
        const w = prefsRow[legacy]
        if (typeof w === 'boolean') return w !== false
      }
      return true
    }

    const sendByType: Record<string, boolean> = {
      offer_sent: on('email_offer_updates'),
      offer_accepted: on('email_offer_updates'),
      offer_rejected: on('email_offer_updates'),
      offer_revision_requested: on('email_offer_updates'),
      crew_invite: on('email_matter_invites', 'email_crew_invites'),
      matter_reply: on('email_matter_updates', 'email_matter_replies'),
      matter_mention: on('email_matter_updates', 'email_matter_replies'),
      matter_update: on('email_matter_updates', 'email_matter_replies'),
      reminder: on('email_reminders'),
      announcement: on('email_matter_announcements', 'email_announcements'),
      other: on('email_matter_updates', 'email_matter_replies'),
    }
    const t = String(notification.type)
    const sendEmail =
      forceEmail || (Object.hasOwn(sendByType, t) ? sendByType[t] : on('email_offer_updates'))

    if (!sendEmail) {
      await supabase
        .from('notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', notificationId)
      return new Response(JSON.stringify({ ok: true, skipped: 'preferences' }), {
        status: 200,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const actionLink = notification.action_url
      ? notification.action_url.startsWith('http')
        ? notification.action_url
        : `${appUrl}${notification.action_url}`
      : `${appUrl}/matters`

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

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
      subject: notification.title,
      html,
    })

    if (!sent.ok) {
      return new Response(
        JSON.stringify({ error: 'Resend failed', details: sent.bodyText }),
        { status: 502, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (updateError) {
      return new Response(
        JSON.stringify({ ok: true, email_sent: true, warning: 'Could not update email_sent_at' }),
        { status: 200, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ ok: true, email_sent: true }), {
      status: 200,
      headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
