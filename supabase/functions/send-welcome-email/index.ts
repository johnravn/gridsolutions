// Supabase Edge Function: send welcome email for a pending invite via Resend.
// Invoke with body: { pending_invite_id: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailFunctionCorsHeaders,
  escapeHtml,
  getResendApiKey,
  sendResendHtmlEmail,
} from '../_shared/email/resend.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: emailFunctionCorsHeaders })

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
    const pendingInviteId = body?.pending_invite_id
    if (!pendingInviteId || typeof pendingInviteId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include pending_invite_id' }),
        { status: 400, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: invite, error: inviteErr } = await supabase
      .from('pending_invites')
      .select('id, company_id, inviter_user_id, email, role, created_at, expires_at')
      .eq('id', pendingInviteId)
      .single()

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: 'Pending invite not found' }),
        { status: 404, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const [{ data: company }, { data: inviterProfile }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', invite.company_id).maybeSingle(),
      supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('user_id', invite.inviter_user_id)
        .maybeSingle(),
    ])

    const companyName = company?.name ?? 'a company on Grid'
    const inviterName =
      inviterProfile?.display_name ??
      [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(' ') ??
      'someone'

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const signupLink = `${appUrl}/signup`

    const roleNice =
      invite.role === 'freelancer' ? 'freelancer' : invite.role === 'employee' ? 'employee' : 'member'
    const subject = `Welcome to Grid — invited to ${companyName}`

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Grid</h2>
        <p style="color: #555; line-height: 1.5;">
          You’ve been invited to <b>${escapeHtml(companyName)}</b> as a ${escapeHtml(roleNice)} by <b>${escapeHtml(inviterName)}</b>.
        </p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(signupLink)}" style="background: #3b82f6; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; display: inline-block;">Get started</a>
        </p>
        <p style="margin-top: 24px; font-size: 12px; color: #888;">
          If you weren’t expecting this invitation, you can ignore this email.
        </p>
      </div>
    `

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [String(invite.email)],
      subject,
      html,
    })

    if (!sent.ok) {
      return new Response(
        JSON.stringify({ error: 'Resend failed', details: sent.bodyText }),
        { status: 502, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
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
