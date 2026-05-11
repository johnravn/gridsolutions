-- Add email sending / delivery tracking for job offers.
-- Used by TechnicalOfferEditor "Send via email" flow.

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS sent_via_email_at TIMESTAMPTZ;

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS sent_via_email_to TEXT;

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS email_provider_message_id TEXT;

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS delivered_via_email_at TIMESTAMPTZ;

COMMENT ON COLUMN public.job_offers.sent_via_email_at IS
  'When the offer email was sent via Resend (or other provider).';

COMMENT ON COLUMN public.job_offers.sent_via_email_to IS
  'Recipient email address used when sending the offer by email.';

COMMENT ON COLUMN public.job_offers.email_provider_message_id IS
  'Provider message id returned when sending offer email (e.g. Resend id).';

COMMENT ON COLUMN public.job_offers.delivered_via_email_at IS
  'When provider indicated delivery (best-effort; may be NULL if not tracked).';
