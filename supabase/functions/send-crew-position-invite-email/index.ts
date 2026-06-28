// Supabase Edge Function: crew invite by email for placeholder slots (no user_id on reserved_crew).
// Invoke with Authorization: Bearer <user JWT> and body: { reserved_crew_id: string, invitation_message?: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailDocument,
  hiddenPreheader,
  primaryButton,
  secondaryButton,
} from '../_shared/email/layout.ts'
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

/** Human-readable span between two ISO timestamps (email copy). */
function formatDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return '—'
  const totalMins = Math.round(diffMs / (1000 * 60))
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m} minute${m === 1 ? '' : 's'}`
  if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`
  return `${h} h ${m} min`
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

    if (
      !resendApiKey ||
      !supabaseUrl ||
      !supabaseServiceKey ||
      !supabaseAnonKey
    ) {
      return new Response(
        JSON.stringify({
          error:
            'Missing RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY',
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
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
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const body = await req.json().catch(() => ({}))
    const reservedCrewId = body?.reserved_crew_id
    const invitationMessage =
      typeof body?.invitation_message === 'string'
        ? body.invitation_message.trim()
        : ''

    if (!reservedCrewId || typeof reservedCrewId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include reserved_crew_id' }),
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

    const { data: rc, error: rcErr } = await supabase
      .from('reserved_crew')
      .select(
        'id, placeholder_email, placeholder_name, user_id, status, notes, time_period_id',
      )
      .eq('id', reservedCrewId)
      .maybeSingle()

    if (rcErr || !rc) {
      return new Response(
        JSON.stringify({ error: 'Reserved crew row not found' }),
        {
          status: 404,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (rc.user_id) {
      return new Response(
        JSON.stringify({
          error:
            'This crew slot is linked to a user account; use in-app crew invite.',
        }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const toEmail = rc.placeholder_email?.trim()
    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: 'No placeholder email on this crew slot' }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (rc.status !== 'planned') {
      return new Response(
        JSON.stringify({
          error: 'Only planned crew slots can receive this invite email',
        }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const { data: tp, error: tpErr } = await supabase
      .from('time_periods')
      .select('id, title, start_at, end_at, job_id, company_id')
      .eq('id', rc.time_period_id)
      .maybeSingle()

    if (tpErr || !tp || !tp.job_id) {
      return new Response(
        JSON.stringify({ error: 'Time period or job not found' }),
        {
          status: 404,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
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
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    if (job.company_id !== tp.company_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid job/time period' }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
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
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const [{ data: company }, { data: inviterProfile }, { data: matterRow }] =
      await Promise.all([
        supabase
          .from('companies')
          .select('name')
          .eq('id', job.company_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('display_name, first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('matters')
          .select('id')
          .eq('company_id', job.company_id)
          .eq('job_id', job.id)
          .eq('time_period_id', tp.id)
          .eq('matter_type', 'crew_invite')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const companyName = company?.name?.trim() || 'Your team'
    const inviterFromParts = [
      inviterProfile?.first_name,
      inviterProfile?.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
    const inviterName =
      (inviterProfile?.display_name?.trim() ?? inviterFromParts) || 'Someone'

    const roleTitle = tp.title || 'Role'
    const subject = `Crew invitation: ${roleTitle}`

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const baseUrl = appUrl.replace(/\/$/, '')
    const signupLink = `${baseUrl}/signup`
    const mattersBase = `${baseUrl}/matters`
    const inviteMatterId =
      matterRow && typeof matterRow.id === 'string' ? matterRow.id : null
    const mattersUrl = inviteMatterId
      ? `${mattersBase}?matterId=${encodeURIComponent(inviteMatterId)}`
      : mattersBase

    const greetingName = rc.placeholder_name?.trim()
      ? escapeHtml(rc.placeholder_name.trim())
      : 'there'

    const addr = job.address as {
      address_line?: string | null
      zip_code?: string | null
      city?: string | null
      country?: string | null
    } | null

    const addressLine =
      addr && typeof addr === 'object'
        ? [addr.address_line, addr.zip_code, addr.city, addr.country]
            .filter(Boolean)
            .join(', ')
        : ''

    let timeHtml = ''
    let timePlain = ''
    if (tp.start_at && tp.end_at) {
      const startStr = formatDateTime24h(tp.start_at)
      const stopStr = formatDateTime24h(tp.end_at)
      const durationStr = formatDuration(tp.start_at, tp.end_at)
      timeHtml = `<div style="margin:12px 0 0 0;color:#475569;line-height:1.65;">
<p style="margin:0;"><strong>Start:</strong> ${escapeHtml(startStr)}</p>
<p style="margin:6px 0 0 0;"><strong>Stop:</strong> ${escapeHtml(stopStr)}</p>
<p style="margin:6px 0 0 0;"><strong>Duration:</strong> ${escapeHtml(durationStr)}</p>
</div>`
      timePlain = `\nStart: ${startStr}\nStop: ${stopStr}\nDuration: ${durationStr}`
    }

    const notesHtml = rc.notes?.trim()
      ? `<p style="margin:12px 0 0 0;color:#475569;line-height:1.65;"><strong>Notes:</strong> ${escapeHtml(rc.notes.trim())}</p>`
      : ''
    const notesPlain = rc.notes?.trim() ? `\nNotes: ${rc.notes.trim()}` : ''

    const msgHtml = invitationMessage
      ? `<p style="margin:16px 0 0 0;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;color:#334155;line-height:1.65;white-space:pre-wrap;"><strong>Message from ${escapeHtml(inviterName)}:</strong><br/>${escapeHtml(invitationMessage)}</p>`
      : ''
    const msgPlain = invitationMessage
      ? `\n\nMessage from ${inviterName}:\n${invitationMessage}`
      : ''

    const addrHtml = addressLine
      ? `<p style="margin:12px 0 0 0;color:#475569;line-height:1.65;"><strong>Location:</strong> ${escapeHtml(addressLine)}</p>`
      : ''
    const addrPlain = addressLine ? `\nLocation: ${addressLine}` : ''

    const preheaderText = `${companyName} — ${job.title} · ${roleTitle}`

    const innerHtml = `
${hiddenPreheader(preheaderText)}
<p style="margin:0;color:#334155;line-height:1.65;">Hi ${greetingName},</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  <strong>${escapeHtml(inviterName)}</strong> from <strong>${escapeHtml(companyName)}</strong> invited you to crew on <strong>${escapeHtml(job.title)}</strong> as <strong>${escapeHtml(roleTitle)}</strong>.
</p>
<p style="margin:12px 0 0 0;color:#475569;line-height:1.65;"><strong>Job:</strong> ${escapeHtml(job.title)}</p>
<p style="margin:4px 0 0 0;color:#475569;line-height:1.65;"><strong>Role:</strong> ${escapeHtml(roleTitle)}</p>
${timeHtml}
${addrHtml}
${notesHtml}
${msgHtml}
${primaryButton(mattersUrl, 'Open invite in Grid')}
${secondaryButton(signupLink, 'Create a Grid account')}
<p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.55;">
  Already use Grid? Sign in at ${escapeHtml(baseUrl)} — once this email is linked to your account, the invitation appears in <strong>Matters</strong>${inviteMatterId ? ' and opens from the button above when you have access.' : '.'}
</p>
`

    const html = emailDocument(innerHtml)

    const textBody = [
      `Hi ${rc.placeholder_name?.trim() || 'there'},`,
      '',
      `${inviterName} from ${companyName} invited you to crew on "${job.title}" as ${roleTitle}.`,
      timePlain,
      addrPlain,
      notesPlain,
      msgPlain,
      '',
      `Open invite in Grid: ${mattersUrl}`,
      '',
      `New to Grid? Create an account: ${signupLink}`,
      '',
      `— ${inviterName}, ${companyName}`,
    ]
      .filter((line) => line !== undefined)
      .join('\n')

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
      subject,
      html,
      text: textBody,
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
