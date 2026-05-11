// Supabase Edge Function: crew invite by email for placeholder slots (no user_id on reserved_crew).
// Invoke with Authorization: Bearer <user JWT> and body: { reserved_crew_id: string, invitation_message?: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailFunctionCorsHeaders,
  escapeHtml,
  getResendApiKey,
  sendResendHtmlEmail,
} from '../_shared/email/resend.ts'

function formatDateTime24h(dateString: string): string {
  const d = new Date(dateString)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function calculateHours(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: emailFunctionCorsHeaders })
  }

  try {
    const resendApiKey = getResendApiKey()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY',
        }),
        { status: 500, headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const reservedCrewId = body?.reserved_crew_id
    const invitationMessage =
      typeof body?.invitation_message === 'string' ? body.invitation_message.trim() : ''

    if (!reservedCrewId || typeof reservedCrewId !== 'string') {
      return new Response(JSON.stringify({ error: 'Body must include reserved_crew_id' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: rc, error: rcErr } = await supabase
      .from('reserved_crew')
      .select('id, placeholder_email, placeholder_name, user_id, status, notes, time_period_id')
      .eq('id', reservedCrewId)
      .maybeSingle()

    if (rcErr || !rc) {
      return new Response(JSON.stringify({ error: 'Reserved crew row not found' }), {
        status: 404,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (rc.user_id) {
      return new Response(JSON.stringify({ error: 'This crew slot is linked to a user account; use in-app crew invite.' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const toEmail = rc.placeholder_email?.trim()
    if (!toEmail) {
      return new Response(JSON.stringify({ error: 'No placeholder email on this crew slot' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (rc.status !== 'planned') {
      return new Response(JSON.stringify({ error: 'Only planned crew slots can receive this invite email' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: tp, error: tpErr } = await supabase
      .from('time_periods')
      .select('id, title, start_at, end_at, job_id, company_id')
      .eq('id', rc.time_period_id)
      .maybeSingle()

    if (tpErr || !tp || !tp.job_id) {
      return new Response(JSON.stringify({ error: 'Time period or job not found' }), {
        status: 404,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select(
        'id, title, company_id, job_address_id, address:job_address_id ( address_line, zip_code, city, country )',
      )
      .eq('id', tp.job_id)
      .maybeSingle()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (job.company_id !== tp.company_id) {
      return new Response(JSON.stringify({ error: 'Invalid job/time period' }), {
        status: 400,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: membership } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', job.company_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...emailFunctionCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: company }, { data: inviterProfile }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', job.company_id).maybeSingle(),
      supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const companyName = company?.name ?? 'Grid'
    const inviterName =
      inviterProfile?.display_name ??
      [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(' ') ??
      'Someone'

    const roleTitle = tp.title || 'Role'
    const subject = `Crew invitation: ${roleTitle}`

    let bodyText = `You have been invited to work on "${job.title}" as ${roleTitle}.`
    if (tp.start_at && tp.end_at) {
      const roleTimeStr = `${formatDateTime24h(tp.start_at)} - ${formatDateTime24h(tp.end_at)}`
      const hours = calculateHours(tp.start_at, tp.end_at)
      bodyText += `\n\nRole Time: ${roleTimeStr} (${hours} hours)`
    }

    const addr = job.address as {
      address_line?: string | null
      zip_code?: string | null
      city?: string | null
      country?: string | null
    } | null
    if (addr && typeof addr === 'object') {
      const parts = [addr.address_line, addr.zip_code, addr.city, addr.country].filter(Boolean)
      if (parts.length) {
        bodyText += `\n\nAddress: ${parts.join(', ')}`
      }
    }

    if (rc.notes?.trim()) {
      bodyText += `\n\nNotes: ${rc.notes.trim()}`
    }

    if (invitationMessage) {
      bodyText += `\n\nMessage from the organizer:\n${invitationMessage}`
    }

    bodyText += `\n\n— ${inviterName}, ${companyName}`

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const signupLink = `${appUrl}/signup`

    const greetingName = rc.placeholder_name?.trim() ? escapeHtml(rc.placeholder_name.trim()) : 'there'

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #333;">${escapeHtml(subject)}</h2>
        <p style="color: #555; line-height: 1.5;">Hi ${greetingName},</p>
        <p style="color: #555; line-height: 1.5;">${escapeHtml(bodyText).replace(/\n/g, '<br/>')}</p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(signupLink)}" style="background: #3b82f6; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; display: inline-block;">Create an account on Grid</a>
        </p>
        <p style="margin-top: 18px; font-size: 12px; color: #888;">
          If you already have an account, sign in at ${escapeHtml(appUrl)} — your invitation will appear in Matters when your email is linked to the crew role.
        </p>
      </div>
    `

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
      subject,
      html,
      fromDisplayName: companyName,
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
