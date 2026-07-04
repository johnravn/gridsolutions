# Outbound email (Resend + Supabase Edge Functions)

This document is the **canonical reference** for how transactional email works in this repo and how agents should extend it.

## Architecture

1. **Provider**: [Resend](https://resend.com) (`RESEND_API_KEY`).
2. **Runtime**: **Supabase Edge Functions** under `supabase/functions/`. The browser **never** calls Resend directly.
3. **Shared HTTP layer**: `supabase/functions/_shared/email/resend.ts` — all Edge Functions that send mail should use `sendResendHtmlEmail()` (or extend that module) so headers, From formatting, and error handling stay consistent. Pass optional **`text`** for a plain-text part alongside HTML when it improves accessibility or deliverability.

### Shared HTML and assets

- **`_shared/email/layout.ts`** — reusable fragments: hidden preheader (inbox snippet), table-based wrapper, primary button, optional header logo block (`emailHeaderLogo`).
- **`_shared/email/gridWordmarkSvg.ts`** — inlined Grid wordmark for emails where remote assets are blocked (Matter **test** email).
- **`_shared/email/publicStorageUrl.ts`** — build public URLs for Storage objects without the browser client (`publicLogoUrl`, `preferredCompanyLogoPath` for `companies.logo_*` fields).
- Company **logos** in email use the **`logos`** bucket (same as the app). Images load only if those objects are **publicly readable** (same assumption as the public offer page). Many clients block remote images until the user chooses to load them.

### Active Edge Functions

| Function                          | Purpose                                                                                                                              | Typical caller                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `send-notification-email`         | One notification → profile email; **From** = company name; greeting + card layout.                                                   | Client via `sendNotificationEmailNow()`; **after each `notifications` INSERT** a DB trigger queues `pg_net` → this function (needs vault `project_url` + `anon_key`, same as cron); plus `dispatch-notification-emails` (cron) as backup |
| `send-welcome-email`              | Pending company invite; **From** = company name; longer copy + what Grid is.                                                         | Client via `fireAndForgetWelcomeEmail()`, or DB trigger + `pg_net` + vault `anon_key`                                                                                                                                                    |
| `send-offer-email`                | Locked job offer; **From** = company name; hello + thank-you intro.                                                                  | Client via `sendOfferByEmail()`                                                                                                                                                                                                          |
| `send-crew-position-invite-email` | Email-only crew slot; **From** = company; **Open invite in Grid** → `/matters?matterId=…` when a matching crew-invite matter exists. | Client via `sendCrewPositionInviteEmail()`                                                                                                                                                                                               |
| `send-test-email`                 | Matter notifications **test** only; **From** = **Grid**; wordmark is **inline SVG** (no remote image).                               | Client via `sendMatterEmailTest()`                                                                                                                                                                                                       |
| `dispatch-notification-emails`    | Batch: pending `notifications` with `email_sent_at` null                                                                             | `pg_cron` / server                                                                                                                                                                                                                       |
| `list-resend-emails`              | Super admin: list/retrieve sent emails from **Resend API** (source of truth)                                                         | Super Monitor tab via `supabase.functions.invoke`                                                                                                                                                                                        |

**Matter-related notification email:** `send-notification-email` reads `public.notification_preferences` columns `email_matter_announcements`, `email_matter_updates`, and `email_matter_invites` (with fallback to the older `email_announcements`, `email_matter_replies`, and `email_crew_invites` when needed). Notification rows use `notification_type` values including `announcement`, `matter_update` (activity-driven matter emails), and `crew_invite`. Users edit the three toggles on **Profile → Matter notifications** (email today; PWA push planned).

## Web app module (`src/shared/email/`)

Use **`@shared/email/supabaseEdgeEmail`** (or `@shared/email` if you add barrel exports) for all `supabase.functions.invoke` email calls:

- **`sendOfferByEmail({ offerId, toEmail })`** — user-facing offer send; throws path should surface `failure.message` / `failure.details`.
- **`sendWelcomeEmailForPendingInvite(id)`** — await when you need success/failure.
- **`fireAndForgetWelcomeEmail(id)`** — after creating a pending invite; logs a **dev-only** `console.warn` on failure.
- **`sendNotificationEmailNow({ notificationId, forceEmail? })`** — after inserting a notification when email should go out immediately.
- **`sendMatterEmailTest({ companyId })`** — Profile → Matter notifications: sends a test email to the signed-in user’s profile email (validates `company_id` membership server-side).
- **`invokeEmailEdgeFunction()`** — escape hatch for new shapes; prefer adding a typed wrapper next to the others.

**Do not** call `supabase.functions.invoke('send-…')` ad hoc in feature code unless you are adding a new function and have not yet added a wrapper.

## Environment variables (Edge secrets)

Set these in the **Supabase project** (Dashboard → Edge Functions → Secrets, or CLI secrets), not only in Vercel:

| Variable                    | Required   | Notes                                                                                          |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`            | Yes*       | Resend dashboard. *Optional when `RESEND_DRY_RUN=true` (local/staging).                        |
| `RESEND_DRY_RUN`            | No         | Set to `true` on a Supabase project to exercise email flows **without** calling Resend. **Never set on production.** |
| `RESEND_FROM_EMAIL`         | Production | Must be a **verified sender/domain** in Resend; dev may use `notifications@resend.dev` default |
| `RESEND_FROM_NAME`          | No         | Display name; defaults to `Grid`                                                               |
| `APP_URL`                   | No         | Public links in emails; defaults to production app URL                                         |
| `SUPABASE_URL`              | Yes        | Injected in hosted env                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes        | Edge Functions use service role for DB                                                         |

## Development vs production

Email behavior is **not** controlled by Vite’s `DEV` / `PROD` alone. It follows **whichever Supabase project** your app uses (`VITE_SUPABASE_URL` + anon key): that project’s **Edge Function secrets** (`RESEND_*`, `APP_URL`) and deployed functions decide what gets sent.

### Practical setups

| Goal                           | Typical setup                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Local full stack**           | `VITE_SUPABASE_URL=http://127.0.0.1:54321` (see `LOCAL_SUPABASE_WORKFLOW.md`). Set Edge secrets on **local** Supabase: `supabase secrets set RESEND_API_KEY=…` (and optionally `RESEND_FROM_EMAIL`, `APP_URL`). Run `supabase functions serve` or rely on `supabase start` depending on your workflow. |
| **Local UI → hosted Supabase** | Same as any remote consumer: secrets live in the **hosted** project (Dashboard → Edge Functions → Secrets). Emails are real for that project’s data; use a **non-production** Supabase project if you must avoid touching prod.                                                                        |
| **Vercel preview / staging**   | Prefer a **dedicated Supabase project** (staging) + its own Resend key / verified sending domain (or Resend’s test domain for internal checks). Point preview env vars at that project so previews never use production `RESEND_*` or prod user data by accident.                                      |
| **Production**                 | Production Supabase project only. `RESEND_FROM_EMAIL` must use your **verified** domain in Resend. `APP_URL` should match the public app URL (`https://gridsolutions.app` or your canonical host).                                                                                                     |

### `APP_URL` per environment

Edge templates build links (offers, signup, “view in app”) from **`APP_URL`**. If it is wrong, dev emails open production (or the reverse).

- **Local**: e.g. `APP_URL=http://127.0.0.1:5173` (or your Vite port).
- **Staging**: staging web URL.
- **Production**: production web URL.

Set **`APP_URL` in the same Supabase project** whose functions are invoked (local secrets vs Dashboard secrets per project).

### Resend keys and “From”

- **Quick local experiments**: omitting `RESEND_FROM_EMAIL` falls back to Resend’s test sender (`notifications@resend.dev`); Resend may restrict who you can send to—check their docs for the current test rules.
- **Staging / prod**: use a verified domain and a dedicated API key per Resend environment if you want clear separation and easier key rotation.

### Dry run (no Resend HTTP calls)

Set **`RESEND_DRY_RUN=true`** as an Edge Function secret on the **local** (or staging) Supabase project:

```bash
supabase secrets set RESEND_DRY_RUN=true
npm run supabase:restart   # or redeploy functions on hosted projects
```

`sendResendHtmlEmail()` in `_shared/email/resend.ts` then returns success without POSTing to Resend. DB triggers, UI flows, and `email_sent_at` updates behave as if mail was sent. Edge logs include `[resend] RESEND_DRY_RUN: skipped send` with to/subject.

- **`RESEND_API_KEY` is optional** while dry run is on (functions still need `SUPABASE_*`).
- **Production is unaffected** unless you set this secret on the production Supabase project — secrets are per project; leave `RESEND_DRY_RUN` unset in prod.
- Turn off: `supabase secrets unset RESEND_DRY_RUN` and restart.

### Same code path everywhere

The app always calls **`@shared/email/supabaseEdgeEmail`**. Do not branch “real Resend vs mock” in the Vite app; use **`RESEND_DRY_RUN`** on the Supabase project instead of scattered `if (import.meta.env.DEV)` sends.

`import.meta.env.DEV` in this repo is only used for **extra logging** (e.g. `fireAndForgetWelcomeEmail` warns on failure in dev); it does not change whether mail is sent.

## Local development

- `supabase/config.toml` sets **`verify_jwt = false`** on email-related functions (workaround for Edge JWT / crypto issues during local serve). **Add the same block** when introducing a **new** email-invoked function name.
- If emails “do nothing” locally, confirm **`supabase secrets set RESEND_API_KEY=…`** for the local stack (or use staging keys).
- DB-triggered welcome email needs **Vault** secrets `project_url` and `anon_key` (see `supabase/migrations/20260425100500_pending_invite_welcome_email.sql`). Client-side `fireAndForgetWelcomeEmail` exists so invites still work when `pg_net`/vault are not set up.

## Adding a new transactional email

1. Prefer **one bounded use case per Edge Function** (same pattern as `send-offer-email`).
2. Implement sending only through **`_shared/email/resend.ts`** (`sendResendHtmlEmail`).
3. Register **`[functions.<name>]`** with **`verify_jwt = false`** in `supabase/config.toml` if the app or cron invokes it like the others (until the upstream JWT issue is resolved project-wide).
4. Add a **typed wrapper** in `src/shared/email/supabaseEdgeEmail.ts` and use it from features.
5. Document new secrets and function names in this file.

## Security note

With **`verify_jwt = false`**, the Edge endpoint does not authenticate the caller. Authorization must be enforced **inside** the function (service role + checks on rows the user is allowed to affect) or via a secret header for cron-only functions. When adding flows, review who can trigger the function and what data they can exfiltrate or spam.

## Troubleshooting checklist

1. **502 / `Resend failed`** — Read `details` in JSON; common causes: unverified `RESEND_FROM_EMAIL`, invalid API key, Resend account limits.
2. **Offer email / invoke errors locally** — Confirm `send-offer-email` has `verify_jwt = false` in `config.toml` and redeploy / restart `supabase functions serve`.
3. **Welcome email never fires from DB** — Vault + `pg_net`; use client `fireAndForgetWelcomeEmail` path to verify Resend works independently.
4. **Notification email skipped** — Expected when `notification_preferences` disables that channel; function returns `{ ok: true, skipped: 'preferences' }` and sets `email_sent_at`.
