// Supabase Edge Function: send welcome email for a pending invite via Resend.
// Invoke with body: { pending_invite_id: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailDocument,
  hiddenPreheader,
  primaryButton,
} from '../_shared/email/layout.ts'
import {
  emailFunctionCorsHeaders,
  escapeHtml,
  getResendApiKey,
  sendResendHtmlEmail,
} from '../_shared/email/resend.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: emailFunctionCorsHeaders })

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
    const pendingInviteId = body?.pending_invite_id
    if (!pendingInviteId || typeof pendingInviteId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include pending_invite_id' }),
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

    const { data: invite, error: inviteErr } = await supabase
      .from('pending_invites')
      .select(
        'id, company_id, inviter_user_id, email, role, created_at, expires_at',
      )
      .eq('id', pendingInviteId)
      .single()

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: 'Pending invite not found' }),
        {
          status: 404,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const [{ data: company }, { data: inviterProfile }] = await Promise.all([
      supabase
        .from('companies')
        .select('name')
        .eq('id', invite.company_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('user_id', invite.inviter_user_id)
        .maybeSingle(),
    ])

    const companyName = company?.name?.trim() || 'a team on Grid'
    const inviterFromParts = [
      inviterProfile?.first_name,
      inviterProfile?.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
    const inviterName =
      (inviterProfile?.display_name?.trim() ?? inviterFromParts) ||
      'Someone on your new team'

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const baseUrl = appUrl.replace(/\/$/, '')
    const signupLink = `${baseUrl}/signup`

    const roleNice =
      invite.role === 'freelancer'
        ? 'freelancer'
        : invite.role === 'employee'
          ? 'employee'
          : 'member'

    const subject = `You're invited to ${companyName} on Grid`

    const preheaderText = `${inviterName} invited you to collaborate in Grid — accept to get started.`

    const innerHtml = `
${hiddenPreheader(preheaderText)}
<p style="margin:0;color:#334155;line-height:1.65;font-size:16px;">Hello,</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  <strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(companyName)}</strong> on Grid as a <strong>${escapeHtml(roleNice)}</strong>.
</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  <strong>What is Grid?</strong> Grid is the workspace where your team plans jobs, crew, equipment, offers, and day-to-day communication — so everyone stays aligned from first quote to invoice.
</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  When you accept this invitation you'll get access to the right projects and matters for <strong>${escapeHtml(companyName)}</strong>, using the same email address this message was sent to.
</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  If you were not expecting this email, you can safely ignore it — no account will be created unless you complete signup.
</p>
${primaryButton(signupLink, 'Accept invitation & get started')}
<p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
  Sent on behalf of ${escapeHtml(companyName)} via Grid.
</p>
`

    const html = emailDocument(innerHtml)

    const text = [
      'Hello,',
      '',
      `${inviterName} has invited you to join ${companyName} on Grid as a ${roleNice}.`,
      '',
      'What is Grid? Grid is the workspace where teams plan jobs, crew, equipment, offers, and communication.',
      '',
      `Accept the invitation: ${signupLink}`,
      '',
      'If you were not expecting this email, you can ignore it.',
    ].join('\n')

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [String(invite.email)],
      subject,
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

    return new Response(JSON.stringify({ ok: true }), {
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
