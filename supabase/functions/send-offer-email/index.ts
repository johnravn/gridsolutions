// Supabase Edge Function: send a job offer link by email via Resend.
// Invoke with body: { offer_id: string, to_email: string }
//
// Env:
// - RESEND_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - APP_URL (optional)
// - RESEND_FROM_EMAIL (optional)
// - RESEND_FROM_NAME (optional)

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
    const offerId = body?.offer_id
    const toEmail = body?.to_email

    if (!offerId || typeof offerId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include offer_id' }),
        {
          status: 400,
          headers: {
            ...emailFunctionCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }
    if (!toEmail || typeof toEmail !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Body must include to_email' }),
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

    const { data: offer, error: offerErr } = await supabase
      .from('job_offers')
      .select(
        `
          id,
          title,
          access_token,
          locked,
          job_id,
          sent_via_email_at,
          job:jobs!job_offers_job_id_fkey (
            id,
            title,
            customer:customers!jobs_customer_id_fkey ( id, name )
          ),
          company:companies!job_offers_company_id_fkey ( id, name )
        `,
      )
      .eq('id', offerId)
      .maybeSingle()

    if (offerErr || !offer) {
      return new Response(JSON.stringify({ error: 'Offer not found' }), {
        status: 404,
        headers: {
          ...emailFunctionCorsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    if (!offer.locked) {
      return new Response(
        JSON.stringify({
          error: 'Offer must be locked before sending by email',
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

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const baseUrl = appUrl.replace(/\/$/, '')
    const offerUrl = `${baseUrl}/offer/${offer.access_token}`

    const company = Array.isArray((offer as any).company)
      ? (offer as any).company[0]
      : (offer as any).company
    const job = Array.isArray((offer as any).job)
      ? (offer as any).job[0]
      : (offer as any).job
    const customer = Array.isArray(job?.customer)
      ? job?.customer[0]
      : job?.customer

    const companyName = (company?.name as string | undefined)?.trim() || 'Our team'
    const subject = `Offer: ${offer.title ?? 'Offer'}`
    const customerName = customer?.name ?? null
    const jobTitle = job?.title ?? null

    const preheaderText = `${companyName} — view and respond to your offer in one click.`

    const innerHtml = `
${hiddenPreheader(preheaderText)}
<p style="margin:0;color:#334155;line-height:1.65;">Hello,</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  Thank you for the opportunity to work together. <strong>${escapeHtml(companyName)}</strong> is pleased to share the following offer${customerName ? ` for <strong>${escapeHtml(customerName)}</strong>` : ''}${jobTitle ? ` — <strong>${escapeHtml(jobTitle)}</strong>` : ''}.
</p>
<p style="margin:16px 0 0 0;color:#475569;line-height:1.65;">
  You can review the full details, including scope and pricing, using the secure link below. If you have questions, reply to your contact at ${escapeHtml(companyName)} as you normally would.
</p>
${primaryButton(offerUrl, 'View offer')}
<p style="margin:18px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
  If the button does not work, copy this link into your browser:<br/>
  <span style="word-break:break-all;">${escapeHtml(offerUrl)}</span>
</p>
`

    const html = emailDocument(innerHtml)

    const text = [
      'Hello,',
      '',
      `Thank you for the opportunity to work together. ${companyName} is pleased to share an offer${customerName ? ` for ${customerName}` : ''}${jobTitle ? ` (${jobTitle})` : ''}.`,
      '',
      `View offer: ${offerUrl}`,
    ].join('\n')

    const sent = await sendResendHtmlEmail({
      apiKey: resendApiKey,
      to: [toEmail],
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

    const messageId = sent.messageId

    await supabase
      .from('job_offers')
      .update({
        sent_via_email_at: new Date().toISOString(),
        sent_via_email_to: toEmail,
        email_provider_message_id: messageId,
        delivered_via_email_at: new Date().toISOString(),
      })
      .eq('id', offerId)

    return new Response(JSON.stringify({ ok: true, message_id: messageId }), {
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
