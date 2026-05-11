/**
 * Standard way to invoke transactional-email Edge Functions from the web app.
 * All outbound email goes through Supabase Edge + Resend — never call Resend from the browser.
 */
import { supabase } from '@shared/api/supabase'

export type SendOfferEmailResponse = { ok: true; message_id?: string | null } | { error: string; details?: string }
export type SendWelcomeEmailResponse = { ok: true } | { error: string; details?: string }
export type SendNotificationEmailResponse =
  | { ok: true; email_sent?: boolean; already_sent?: boolean; skipped?: string; warning?: string }
  | { error: string; details?: string }

export type SendTestEmailResponse =
  | { ok: true; message_id?: string | null }
  | { error: string; details?: string }

export type SendCrewPositionInviteEmailResponse = { ok: true } | { error: string; details?: string }

export type EmailEdgeInvokeFailure = {
  message: string
  /** JSON `details` from the function body when present */
  details?: string
  /** Set when the Functions gateway returned an error (often includes HTTP status context). */
  invokeError?: string
}

function parseBodyError(data: unknown): { error: string; details?: string } | null {
  if (!data || typeof data !== 'object') return null
  const err = (data as { error?: unknown }).error
  if (err === undefined || err === null) return null
  const details = (data as { details?: unknown }).details
  return {
    error: String(err),
    ...(typeof details === 'string' ? { details } : {}),
  }
}

function httpStatusFromFunctionsInvokeError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const ctx = (error as { context?: unknown }).context
  if (ctx instanceof Response && typeof ctx.status === 'number') return ctx.status
  return null
}

function hintForFunctionsHttp404(functionName: string): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const local = url && /127\.0\.0\.1|localhost/i.test(url)
  return local
    ? `Local gateway has no route for "${functionName}" (often after adding it). Run: npm run supabase:restart — Edge Functions register when the stack starts.`
    : `Deploy this function: supabase functions deploy ${functionName}`
}

/**
 * Invokes a named email Edge Function and normalizes Supabase client + JSON error shapes.
 */
export async function invokeEmailEdgeFunction<T extends Record<string, unknown>>(
  functionName:
    | 'send-offer-email'
    | 'send-welcome-email'
    | 'send-notification-email'
    | 'send-test-email'
    | 'send-crew-position-invite-email',
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; failure: EmailEdgeInvokeFailure; data: T | null }> {
  const { data, error } = await supabase.functions.invoke<T>(functionName, { body })

  if (error) {
    const bodyErr = parseBodyError(data)
    const status = httpStatusFromFunctionsInvokeError(error)
    const baseMessage = bodyErr?.error ?? error.message
    const hint404 = status === 404 ? hintForFunctionsHttp404(functionName) : undefined
    return {
      ok: false,
      data: data ?? null,
      failure: {
        message: hint404 ? `${baseMessage} — ${hint404}` : baseMessage,
        details: bodyErr?.details,
        invokeError: error.message,
      },
    }
  }

  const bodyErr = parseBodyError(data)
  if (bodyErr) {
    return {
      ok: false,
      data: data ?? null,
      failure: { message: bodyErr.error, details: bodyErr.details },
    }
  }

  return { ok: true, data: data as T }
}

export async function sendOfferByEmail(params: {
  offerId: string
  toEmail: string
}): Promise<{ ok: true; messageId: string | null } | { ok: false; failure: EmailEdgeInvokeFailure }> {
  const res = await invokeEmailEdgeFunction<SendOfferEmailResponse>('send-offer-email', {
    offer_id: params.offerId,
    to_email: params.toEmail,
  })
  if (!res.ok) return { ok: false, failure: res.failure }
  const messageId = (res.data as { message_id?: string | null }).message_id ?? null
  return { ok: true, messageId }
}

export async function sendWelcomeEmailForPendingInvite(pendingInviteId: string): Promise<
  { ok: true } | { ok: false; failure: EmailEdgeInvokeFailure }
> {
  const res = await invokeEmailEdgeFunction<SendWelcomeEmailResponse>('send-welcome-email', {
    pending_invite_id: pendingInviteId,
  })
  if (!res.ok) return { ok: false, failure: res.failure }
  return { ok: true }
}

export async function sendNotificationEmailNow(params: {
  notificationId: string
  forceEmail?: boolean
}): Promise<{ ok: true } | { ok: false; failure: EmailEdgeInvokeFailure }> {
  const res = await invokeEmailEdgeFunction<SendNotificationEmailResponse>('send-notification-email', {
    notification_id: params.notificationId,
    force_email: params.forceEmail ?? false,
  })
  if (!res.ok) return { ok: false, failure: res.failure }
  return { ok: true }
}

/** Profile → Matter notifications: send a test email to the signed-in user's profile email. */
export async function sendMatterEmailTest(params: {
  companyId: string
}): Promise<{ ok: true; messageId: string | null } | { ok: false; failure: EmailEdgeInvokeFailure }> {
  const res = await invokeEmailEdgeFunction<SendTestEmailResponse>('send-test-email', {
    company_id: params.companyId,
  })
  if (!res.ok) return { ok: false, failure: res.failure }
  const messageId = (res.data as { message_id?: string | null }).message_id ?? null
  return { ok: true, messageId }
}

/** Email-only invite for placeholder crew (no Grid account yet). Authenticated caller must belong to the job’s company. */
export async function sendCrewPositionInviteEmail(params: {
  reservedCrewId: string
  invitationMessage?: string | null
}): Promise<{ ok: true } | { ok: false; failure: EmailEdgeInvokeFailure }> {
  const res = await invokeEmailEdgeFunction<SendCrewPositionInviteEmailResponse>(
    'send-crew-position-invite-email',
    {
      reserved_crew_id: params.reservedCrewId,
      ...(params.invitationMessage?.trim()
        ? { invitation_message: params.invitationMessage.trim() }
        : {}),
    },
  )
  if (!res.ok) return { ok: false, failure: res.failure }
  return { ok: true }
}

export function fireAndForgetCrewPositionInviteEmail(
  reservedCrewId: string,
  invitationMessage?: string | null,
): void {
  void sendCrewPositionInviteEmail({ reservedCrewId, invitationMessage }).then((r) => {
    if (!r.ok && import.meta.env.DEV) {
      console.warn('[email] send-crew-position-invite-email failed', r.failure)
    }
  })
}

/**
 * Invite flows should not block the UI on email delivery; call this after a pending invite is created.
 * Logs a console warning in dev when sending fails so misconfigured Resend is visible.
 */
export function fireAndForgetWelcomeEmail(pendingInviteId: string): void {
  void sendWelcomeEmailForPendingInvite(pendingInviteId).then((r) => {
    if (!r.ok && import.meta.env.DEV) {
      console.warn('[email] send-welcome-email failed', r.failure)
    }
  })
}
