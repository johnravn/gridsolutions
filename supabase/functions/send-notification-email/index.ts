// Supabase Edge Function: send a single notification by email via Resend.
// Invoke with body: { notification_id: string, force_email?: boolean }
// Requires RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailDocument,
  greetingFirstName,
  greetingFirstNamePlain,
  hiddenPreheader,
  primaryButton,
} from '../_shared/email/layout.ts'
import {
  emailFunctionCorsHeaders,
  escapeHtml,
  getResendApiKey,
  isNonDeliverableTestEmail,
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
          error:
            'Missing RESEND_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY',
        }),
        {
          status: 500,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const body = await req.json().catch(() => ({}))
    const notificationId = body?.notification_id
    const forceFromRequestBody = body?.force_email === true
    if (!notificationId || typeof notificationId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include notification_id' }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
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
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const forceEmail =
      forceFromRequestBody ||
      (notification as { email_force_send?: boolean }).email_force_send === true

    if (notification.email_sent_at) {
      return new Response(JSON.stringify({ ok: true, already_sent: true }), {
        status: 200,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const [{ data: profile }, { data: company }] = await Promise.all([
      supabase
        .from('profiles')
        .select('email, display_name, first_name')
        .eq('user_id', notification.user_id)
        .single(),
      supabase
        .from('companies')
        .select('name')
        .eq('id', notification.company_id)
        .maybeSingle(),
    ])

    const toEmail = profile?.email
    if (!toEmail) {
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 400,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    if (isNonDeliverableTestEmail(toEmail)) {
      await supabase
        .from('notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', notificationId)
      return new Response(
        JSON.stringify({ ok: true, skipped: 'test_recipient' }),
        {
          status: 200,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
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
      forceEmail ||
      (Object.hasOwn(sendByType, t) ? sendByType[t] : on('email_offer_updates'))

    if (!sendEmail) {
      await supabase
        .from('notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', notificationId)
      return new Response(
        JSON.stringify({ ok: true, skipped: 'preferences' }),
        {
          status: 200,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const baseUrl = appUrl.replace(/\/$/, '')
    const actionLink = notification.action_url
      ? notification.action_url.startsWith('http')
        ? notification.action_url
        : `${baseUrl}${notification.action_url}`
      : `${baseUrl}/matters`

    const companyName = company?.name?.trim() || 'Your team'
    const hi = greetingFirstName({
      display_name: profile?.display_name,
      first_name: profile?.first_name,
    })
    const preheaderText = notification.body_text?.trim()
      ? notification.body_text.trim().slice(0, 140)
      : `${companyName} — ${notification.title}`

    const bodyBlock = notification.body_text?.trim()
      ? `<p style="margin:16px 0 0 0;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;color:#334155;line-height:1.6;white-space:pre-wrap;">${escapeHtml(notification.body_text.trim())}</p>`
      : ''

    const innerHtml = `
${hiddenPreheader(preheaderText)}
<p style="margin:0;color:#334155;line-height:1.6;">Hi ${hi},</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.6;">
  You have a new notification from <strong>${escapeHtml(companyName)}</strong> in <strong>Grid</strong>. Here is what it says:
</p>
<h2 style="margin:20px 0 0 0;font-size:18px;font-weight:600;color:#0f172a;line-height:1.35;">${escapeHtml(notification.title)}</h2>
${bodyBlock}
${primaryButton(actionLink, 'Open in Grid')}
<p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
  You received this email because notifications are enabled for this company in your Grid profile.
</p>
`

    const html = emailDocument(innerHtml)

    const textLines = [
      `Hi ${greetingFirstNamePlain({
        display_name: profile?.display_name,
        first_name: profile?.first_name,
      })},`,
      '',
      `You have a new notification from ${companyName} in Grid.`,
      '',
      notification.title,
      '',
      notification.body_text?.trim() ?? '',
      '',
      `Open: ${actionLink}`,
      '',
      'You received this because notifications are enabled for this company.',
    ]
    const text = textLines.join('\n')

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
      subject: notification.title,
      html,
      text,
      fromDisplayName: companyName,
    })

    if (!sent.ok) {
      return new Response(
        JSON.stringify({ error: 'Resend failed', details: sent.bodyText }),
        {
          status: 502,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (updateError) {
      return new Response(
        JSON.stringify({
          ok: true,
          email_sent: true,
          warning: 'Could not update email_sent_at',
        }),
        {
          status: 200,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(JSON.stringify({ ok: true, email_sent: true }), {
      status: 200,
      headers: {
        ...emailFunctionCorsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: {
        ...emailFunctionCorsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
})
