-- Realtime filtered subscriptions on jobs.company_id require replica identity that
-- includes filter columns for UPDATE/DELETE (Supabase Realtime / Postgres logical replication).
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

-- Ensure jobs changes are published to supabase_realtime (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END $$;
