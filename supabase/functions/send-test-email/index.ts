// Supabase Edge Function: send a one-off test email to the signed-in user's profile email.
// Used from Profile → Matter notifications to verify Resend / inbox delivery.
// Body: { company_id: string } (required — must be a company the user belongs to).
//
// Env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL (optional)

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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing RESEND_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY',
        }),
        {
          status: 500,
          headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!anonKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_ANON_KEY' }), {
        status: 500,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const companyId = body?.company_id
    if (!companyId || typeof companyId !== 'string') {
      return new Response(JSON.stringify({ error: 'Body must include company_id' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: membership, error: memError } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memError || !membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this company' }), {
        status: 403,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile?.email?.trim()) {
      return new Response(JSON.stringify({ error: 'No email on your profile' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const toEmail = profile.email.trim()

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle()

    const companyName = company?.name?.trim() || 'your company'
    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const mattersUrl = `${appUrl.replace(/\/$/, '')}/matters`

    const subject = 'Grid: matter email test'
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #333;">${escapeHtml(subject)}</h2>
        <p style="color: #555; line-height: 1.5;">
          This is a test message from <strong>Grid</strong>. If you received it, outbound email
          is working for your account.
        </p>
        <p style="color: #555; line-height: 1.5;">
          Company context: <strong>${escapeHtml(companyName)}</strong>.
        </p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(mattersUrl)}" style="background: #3b82f6; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; display: inline-block;">Open Matters</a>
        </p>
        <p style="margin-top: 24px; font-size: 12px; color: #888;">
          You requested this email from Profile → Matter notifications. It does not change your preferences.
        </p>
      </div>
    `

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
      subject,
      html,
    })

    if (!sent.ok) {
      return new Response(
        JSON.stringify({ error: 'Resend failed', details: sent.bodyText }),
        {
          status: 502,
          headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, message_id: sent.messageId }),
      { status: 200, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
