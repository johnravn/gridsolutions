-- Personal inbox read state, independent of viewed_at.
-- viewed_at remains the sender-visible "opened" signal.
-- inbox_read_at drives the recipient's blue dot and notification badge only.

ALTER TABLE public.matter_recipients
  ADD COLUMN IF NOT EXISTS inbox_read_at timestamptz;

COMMENT ON COLUMN public.matter_recipients.inbox_read_at IS
  'Recipient''s personal inbox read state. Independent of viewed_at (sender-visible opened) and of status/responded_at (accept/decline).';

-- Already-opened rows should stay read in the inbox after this ships.
UPDATE public.matter_recipients
SET inbox_read_at = viewed_at
WHERE inbox_read_at IS NULL
  AND viewed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matter_recipients_inbox_unread
  ON public.matter_recipients (user_id)
  WHERE inbox_read_at IS NULL;
