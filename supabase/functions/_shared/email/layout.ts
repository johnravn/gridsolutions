/**
 * Shared HTML fragments for transactional emails (Edge Functions).
 * Inline styles only; table wrappers for common clients.
 */

import { escapeHtml } from './resend.ts'

/** Improves inbox preview/snippet text without showing a duplicate line at the top of the body. */
export function hiddenPreheader(visiblePreviewText: string): string {
  const t = visiblePreviewText.trim()
  if (!t) return ''
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(t)}</div>`
}

export function emailHeaderLogo(params: {
  imageUrl: string
  alt: string
}): string {
  const { imageUrl, alt } = params
  const safeUrl = escapeHtml(imageUrl)
  const safeAlt = escapeHtml(alt)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;"><tr><td align="left"><img src="${safeUrl}" alt="${safeAlt}" style="display:block;border:0;outline:none;text-decoration:none;max-width:200px;max-height:72px;width:auto;height:auto;" /></td></tr></table>`
}

export function primaryButton(href: string, label: string): string {
  return `<p style="margin:24px 0 0 0;">
  <a href="${escapeHtml(href)}" style="background:#3b82f6;color:#ffffff;padding:10px 16px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">${escapeHtml(label)}</a>
</p>`
}

export function secondaryButton(href: string, label: string): string {
  return `<p style="margin:12px 0 0 0;">
  <a href="${escapeHtml(href)}" style="color:#475569;padding:8px 0;text-decoration:underline;font-weight:500;">${escapeHtml(label)}</a>
</p>`
}

/** First name for “Hi …,” (already HTML-escaped). */
export function greetingFirstName(profile: {
  display_name?: string | null
  first_name?: string | null
}): string {
  return escapeHtml(greetingFirstNamePlain(profile))
}

/** Plain-text first name for multipart `text` parts. */
export function greetingFirstNamePlain(profile: {
  display_name?: string | null
  first_name?: string | null
}): string {
  const dn = profile.display_name?.trim()
  if (dn) {
    const first = dn.split(/\s+/)[0]
    if (first) return first
  }
  const fn = profile.first_name?.trim()
  if (fn) return fn
  return 'there'
}

/**
 * Single-column centered layout, max 560px (matches existing notification emails).
 */
export function emailDocument(innerHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
        <tr>
          <td style="padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#334155;line-height:1.5;">
            ${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}
