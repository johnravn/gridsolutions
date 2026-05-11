-- Realtime: time_periods filtered by company_id needs FULL replica identity.
ALTER TABLE public.time_periods REPLICA IDENTITY FULL;

-- reserved_* subscriptions are unfiltered on the client; RLS limits which rows each user receives.
-- Default replica identity (PK) is sufficient when not using a Postgres filter on those tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'time_periods'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.time_periods;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reserved_crew'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reserved_crew;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reserved_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reserved_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reserved_vehicles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reserved_vehicles;
  END IF;
END $$;
