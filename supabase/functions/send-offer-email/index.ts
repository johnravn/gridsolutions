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

const RESEND_API_URL = 'https://api.resend.com/emails'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const body = await req.json().catch(() => ({}))
    const offerId = body?.offer_id
    const toEmail = body?.to_email

    if (!offerId || typeof offerId !== 'string') {
      return new Response(JSON.stringify({ error: 'Body must include offer_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!toEmail || typeof toEmail !== 'string') {
      return new Response(JSON.stringify({ error: 'Body must include to_email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!offer.locked) {
      return new Response(
        JSON.stringify({ error: 'Offer must be locked before sending by email' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://gridsolutions.app'
    const offerUrl = `${appUrl}/offer/${offer.access_token}`

    const company = Array.isArray((offer as any).company)
      ? (offer as any).company[0]
      : (offer as any).company
    const job = Array.isArray((offer as any).job) ? (offer as any).job[0] : (offer as any).job
    const customer = Array.isArray(job?.customer) ? job?.customer[0] : job?.customer

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@resend.dev'
    const fromName = Deno.env.get('RESEND_FROM_NAME') || (company?.name ?? 'Grid')

    const subject = `Offer: ${offer.title ?? 'Offer'}`
    const heading = company?.name ? `Offer from ${company.name}` : 'Offer from Grid'
    const customerName = customer?.name ?? null
    const jobTitle = job?.title ?? null

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #333;">${escapeHtml(heading)}</h2>
        <p style="color: #555; line-height: 1.5;">
          You have received an offer${customerName ? ` for <b>${escapeHtml(customerName)}</b>` : ''}${jobTitle ? ` (${escapeHtml(jobTitle)})` : ''}.
        </p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(offerUrl)}"
             style="background: #3b82f6; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; display: inline-block;">
             View offer
          </a>
        </p>
        <p style="margin-top: 18px; font-size: 12px; color: #888;">
          If the button doesn’t work, copy this link: ${escapeHtml(offerUrl)}
        </p>
      </div>
    `

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
        'User-Agent': 'Grid-App/1.0',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new Response(
        JSON.stringify({ error: 'Resend failed', details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const payload = await res.json().catch(() => ({}))
    const messageId = payload?.id ?? null

    // Mark as sent. (Delivery tracking is best-effort; delivered_via_email_at stays null for now.)
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

