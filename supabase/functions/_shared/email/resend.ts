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

/** When true, sendResendHtmlEmail skips the Resend HTTP call (local/staging only). */
export function isResendDryRun(): boolean {
  const v = Deno.env.get('RESEND_DRY_RUN')?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

export function getResendApiKey(): string | null {
  const key = Deno.env.get('RESEND_API_KEY') ?? null
  if (key) return key
  // Edge functions require a key before calling sendResendHtmlEmail; placeholder when dry-run only.
  if (isResendDryRun()) return 'dry-run'
  return null
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

/** Domains used by seeds, demos, and tests — never deliver real mail to these. */
const NON_DELIVERABLE_EMAIL_SUFFIXES = [
  '@test.grid.local',
  '@example.com',
  '@grid.local',
  '@demo.internal',
] as const

/**
 * True for seeded / fixture addresses that must not receive Resend mail
 * (e.g. owner@test.grid.local, user@example.com, demo+uuid@demo.internal).
 * Real inboxes such as john.ravndal@gmail.com are not blocked.
 */
export function isNonDeliverableTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return true
  return NON_DELIVERABLE_EMAIL_SUFFIXES.some((suffix) =>
    normalized.endsWith(suffix),
  )
}

export type ResendSendResult =
  | {
      ok: true
      messageId: string | null
      raw: unknown
      dryRun?: boolean
      skippedTestRecipient?: boolean
    }
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

  const deliverableTo = params.to.filter(
    (addr) => !isNonDeliverableTestEmail(addr),
  )
  if (deliverableTo.length === 0) {
    console.log(
      '[resend] skipped send to test/non-deliverable recipients',
      JSON.stringify({
        from: formatFromHeader(fromName, fromEmail),
        to: params.to,
        subject: params.subject,
      }),
    )
    return {
      ok: true,
      messageId: null,
      skippedTestRecipient: true,
      raw: { id: null, skipped: 'test_recipient' },
    }
  }

  if (isResendDryRun()) {
    console.log(
      '[resend] RESEND_DRY_RUN: skipped send',
      JSON.stringify({
        from: formatFromHeader(fromName, fromEmail),
        to: params.to,
        subject: params.subject,
      }),
    )
    return {
      ok: true,
      messageId: null,
      dryRun: true,
      raw: { id: null, dry_run: true },
    }
  }

  const payload: Record<string, unknown> = {
    from: formatFromHeader(fromName, fromEmail),
    to: deliverableTo,
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

export type ResendEmailListItem = {
  id: string
  message_id: string | null
  to: Array<string>
  from: string
  created_at: string
  subject: string
  bcc: Array<string> | null
  cc: Array<string> | null
  reply_to: Array<string> | null
  last_event: string | null
  scheduled_at: string | null
}

export type ResendEmailListResponse = {
  object: 'list'
  has_more: boolean
  data: Array<ResendEmailListItem>
}

export type ResendListResult =
  | { ok: true; page: ResendEmailListResponse }
  | { ok: false; status: number; bodyText: string }

/** List sent emails from Resend (source of truth — not app DB). */
export async function listResendSentEmails(params: {
  apiKey: string
  limit?: number
  after?: string
  before?: string
}): Promise<ResendListResult> {
  const search = new URLSearchParams()
  const limit = Math.min(100, Math.max(1, params.limit ?? 50))
  search.set('limit', String(limit))
  if (params.after) search.set('after', params.after)
  if (params.before) search.set('before', params.before)

  const res = await fetch(`${RESEND_API_URL}?${search.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'User-Agent': 'Grid-App/1.0',
    },
  })

  const bodyText = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, bodyText }
  }

  let page: ResendEmailListResponse
  try {
    page = JSON.parse(bodyText) as ResendEmailListResponse
  } catch {
    return {
      ok: false,
      status: res.status,
      bodyText: 'Invalid JSON from Resend',
    }
  }

  return { ok: true, page }
}

export type ResendEmailDetail = ResendEmailListItem & {
  html?: string | null
  text?: string | null
}

export type ResendRetrieveResult =
  | { ok: true; email: ResendEmailDetail }
  | { ok: false; status: number; bodyText: string }

/** Retrieve a single sent email (includes html/text when available). */
export async function retrieveResendSentEmail(params: {
  apiKey: string
  id: string
}): Promise<ResendRetrieveResult> {
  const res = await fetch(`${RESEND_API_URL}/${params.id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'User-Agent': 'Grid-App/1.0',
    },
  })

  const bodyText = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, bodyText }
  }

  try {
    const email = JSON.parse(bodyText) as ResendEmailDetail
    return { ok: true, email }
  } catch {
    return {
      ok: false,
      status: res.status,
      bodyText: 'Invalid JSON from Resend',
    }
  }
}
