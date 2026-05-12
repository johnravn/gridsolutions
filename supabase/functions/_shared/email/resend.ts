/**
 * Shared Resend HTTP client for Edge Functions.
 * Keep all outbound transactional email going through this helper.
 */

export const RESEND_API_URL = 'https://api.resend.com/emails'

export const emailFunctionCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getResendApiKey(): string | null {
  return Deno.env.get('RESEND_API_KEY') ?? null
}

/** Default "Name" part of the From header (falls back to app name). */
export function getDefaultFromName(): string {
  return Deno.env.get('RESEND_FROM_NAME') ?? 'Grid'
}

/** Must be a sender Resend has verified for your project. */
export function getDefaultFromEmail(): string {
  return Deno.env.get('RESEND_FROM_EMAIL') ?? 'notifications@resend.dev'
}

export function formatFromHeader(displayName: string, email: string): string {
  return `${displayName} <${email}>`
}

export type ResendSendResult =
  | { ok: true; messageId: string | null; raw: unknown }
  | { ok: false; status: number; bodyText: string }

/**
 * POST a single HTML email to Resend.
 * @param fromDisplayName - Overrides RESEND_FROM_NAME when set (e.g. company name on offer emails).
 */
export async function sendResendHtmlEmail(params: {
  apiKey: string
  to: Array<string>
  subject: string
  html: string
  /** Plain-text alternative for multipart emails. */
  text?: string
  fromDisplayName?: string | null
}): Promise<ResendSendResult> {
  const fromEmail = getDefaultFromEmail()
  const fromName = params.fromDisplayName ?? getDefaultFromName()

  const payload: Record<string, unknown> = {
    from: formatFromHeader(fromName, fromEmail),
    to: params.to,
    subject: params.subject,
    html: params.html,
  }
  if (params.text?.trim()) {
    payload.text = params.text.trim()
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      'User-Agent': 'Grid-App/1.0',
    },
    body: JSON.stringify(payload),
  })

  const bodyText = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, bodyText }
  }

  let raw: unknown = bodyText
  try {
    raw = JSON.parse(bodyText) as unknown
  } catch {
    // non-JSON success body — ignore
  }
  const messageId =
    raw &&
    typeof raw === 'object' &&
    raw !== null &&
    'id' in raw &&
    typeof (raw as { id: unknown }).id === 'string'
      ? (raw as { id: string }).id
      : null

  return { ok: true, messageId, raw }
}
