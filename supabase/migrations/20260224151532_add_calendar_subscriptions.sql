-- Migration: Calendar subscription feeds for phone/external calendars
-- Purpose: Store per-user, per-company subscription preferences and a secret
-- token used in the feed URL. Feed returns iCalendar (ICS) for time_periods
-- filtered by selected categories and optional "only my assignments".

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  categories text[] NOT NULL DEFAULT ARRAY['program', 'equipment', 'crew', 'transport'],
  only_my_assignments boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_subscriptions_company_user_unique UNIQUE (company_id, user_id)
);

COMMENT ON TABLE public.calendar_subscriptions
  IS 'Per-user calendar feed preferences; token is used in the public feed URL.';
COMMENT ON COLUMN public.calendar_subscriptions.token
  IS 'Secret token for the feed URL; must be unguessable.';
COMMENT ON COLUMN public.calendar_subscriptions.categories
  IS 'time_period_category values to include: program, equipment, crew, transport.';
COMMENT ON COLUMN public.calendar_subscriptions.only_my_assignments
  IS 'If true, only include events where the user is assigned (e.g. crew).';

CREATE INDEX IF NOT EXISTS calendar_subscriptions_token_idx
  ON public.calendar_subscriptions(token);
CREATE INDEX IF NOT EXISTS calendar_subscriptions_company_user_idx
  ON public.calendar_subscriptions(company_id, user_id);

-- ============================================================================
-- TRIGGER: updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_calendar_subscriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_subscriptions_touch ON public.calendar_subscriptions;
CREATE TRIGGER trg_calendar_subscriptions_touch
  BEFORE UPDATE ON public.calendar_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_calendar_subscriptions();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.calendar_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own subscription per company.
DROP POLICY IF EXISTS "Users can view own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can view own calendar subscription"
  ON public.calendar_subscriptions
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = calendar_subscriptions.company_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can insert own calendar subscription"
  ON public.calendar_subscriptions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = calendar_subscriptions.company_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can update own calendar subscription"
  ON public.calendar_subscriptions
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = calendar_subscriptions.company_id
        AND cu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = calendar_subscriptions.company_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can delete own calendar subscription"
  ON public.calendar_subscriptions
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = calendar_subscriptions.company_id
        AND cu.user_id = auth.uid()
    )
  );

-- Service role can read by token (for the public feed endpoint).
GRANT ALL ON TABLE public.calendar_subscriptions TO anon;
GRANT ALL ON TABLE public.calendar_subscriptions TO authenticated;
GRANT ALL ON TABLE public.calendar_subscriptions TO service_role;
