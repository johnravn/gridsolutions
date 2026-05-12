// Supabase Edge Function: send a one-off test email to the signed-in user's profile email.
// Used from Profile → Matter notifications to verify Resend / inbox delivery.
// Body: { company_id: string } (required — must be a company the user belongs to).
//
// Env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailHeaderGridWordmark } from '../_shared/email/gridWordmarkSvg.ts'
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

    if (!anonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_ANON_KEY' }),
        {
          status: 500,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const body = await req.json().catch(() => ({}))
    const companyId = body?.company_id
    if (!companyId || typeof companyId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include company_id' }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
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
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
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
      return new Response(
        JSON.stringify({ error: 'Not a member of this company' }),
        {
          status: 403,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile?.email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'No email on your profile' }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const toEmail = profile.email.trim()

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const baseUrl = appUrl.replace(/\/$/, '')
    const mattersUrl = `${baseUrl}/matters`

    const subject = 'Test: Matter notifications (Grid)'
    const headline = 'Matter notifications test'
    const preheaderText =
      'Outbound email is working for your account. Open Matters in Grid to continue.'

    const innerHtml = `
${hiddenPreheader(preheaderText)}
${emailHeaderGridWordmark()}
<h1 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#0f172a;line-height:1.3;">${escapeHtml(headline)}</h1>
<p style="margin:0;color:#475569;line-height:1.6;">
  This is a test message from <strong>Grid</strong>. If you received it, outbound email
  is working for your account.
</p>
${primaryButton(mattersUrl, 'Open Matters')}
<p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
  You requested this email from Profile → Matter notifications. It does not change your preferences.
</p>
`

    const html = emailDocument(innerHtml)

    const text = [
      subject,
      '',
      headline,
      '',
      'This is a test message from Grid. If you received it, outbound email is working for your account.',
      '',
      `Open Matters: ${mattersUrl}`,
      '',
      'You requested this email from Profile → Matter notifications. It does not change your preferences.',
    ].join('\n')

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
      subject,
      html,
      text,
      /** Only this test path forces the literal “Grid” sender name. */
      fromDisplayName: 'Grid',
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

    return new Response(
      JSON.stringify({ ok: true, message_id: sent.messageId }),
      {
        status: 200,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
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
