// Super admin: list sent emails directly from Resend (source of truth).
// Body: { limit?: number, after?: string, before?: string, email_id?: string }
// When email_id is set, returns a single email with html/text.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUserFromBearer } from '../_shared/auth/requireUser.ts'
import {
  describeResendUpstreamFailure,
  emailFunctionCorsHeaders,
  getResendApiKey,
  listResendSentEmails,
  retrieveResendSentEmail,
} from '../_shared/email/resend.ts'

type ListBody = {
  limit?: number
  after?: string
  before?: string
  email_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: emailFunctionCorsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...emailFunctionCorsHeaders,
        'Content-Type': 'application/json',
      },
    })
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

    const auth = await requireUserFromBearer({
      req,
      supabaseUrl,
      anonKey,
      corsHeaders: emailFunctionCorsHeaders,
    })
    if (!auth.ok) return auth.response

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('superuser')
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }
    if (!profile?.superuser) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const body = (await req.json().catch(() => ({}))) as ListBody

    if (body.email_id && typeof body.email_id === 'string') {
      const detail = await retrieveResendSentEmail({
        apiKey: resendApiKey,
        id: body.email_id,
      })
      if (!detail.ok) {
        const mapped = describeResendUpstreamFailure(detail.bodyText)
        return new Response(
          JSON.stringify({
            error: mapped?.error ?? 'Resend request failed',
            details: mapped?.details ?? detail.bodyText,
          }),
          {
            // Never proxy Resend 401 — that looks like caller auth failed.
            status:
              mapped?.httpStatus ??
              (detail.status === 401
                ? 502
                : detail.status >= 400
                  ? detail.status
                  : 502),
            headers: {
              ...emailFunctionCorsHeaders,
              'Content-Type': 'application/json',
            },
          },
        )
      }
      return new Response(JSON.stringify({ ok: true, email: detail.email }), {
        status: 200,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const list = await listResendSentEmails({
      apiKey: resendApiKey,
      limit: typeof body.limit === 'number' ? body.limit : 50,
      after: typeof body.after === 'string' ? body.after : undefined,
      before: typeof body.before === 'string' ? body.before : undefined,
    })

    if (!list.ok) {
      const mapped = describeResendUpstreamFailure(list.bodyText)
      return new Response(
        JSON.stringify({
          error: mapped?.error ?? 'Resend request failed',
          details: mapped?.details ?? list.bodyText,
        }),
        {
          status:
            mapped?.httpStatus ??
            (list.status === 401
              ? 502
              : list.status >= 400
                ? list.status
                : 502),
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        has_more: list.page.has_more,
        data: list.page.data,
      }),
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
