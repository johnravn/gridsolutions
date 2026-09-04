-- Allow global superusers to list and revoke calendar subscription tokens.

DROP POLICY IF EXISTS "Superusers can view all calendar subscriptions"
  ON public.calendar_subscriptions;
CREATE POLICY "Superusers can view all calendar subscriptions"
  ON public.calendar_subscriptions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (public.is_superuser((select auth.uid())));

DROP POLICY IF EXISTS "Superusers can delete any calendar subscription"
  ON public.calendar_subscriptions;
CREATE POLICY "Superusers can delete any calendar subscription"
  ON public.calendar_subscriptions
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (public.is_superuser((select auth.uid())));
