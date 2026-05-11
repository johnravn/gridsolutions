-- Persist packing/loading confirmations (including partial loads) per job & vehicle.

CREATE TABLE IF NOT EXISTS public.job_packing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_booking_id UUID NOT NULL REFERENCES public.reserved_vehicles(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  all_loaded BOOLEAN NOT NULL DEFAULT FALSE,
  packed_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  slip_signature TEXT NOT NULL,
  slip_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_job_packing_sessions_job_id
  ON public.job_packing_sessions(job_id);

CREATE INDEX IF NOT EXISTS idx_job_packing_sessions_vehicle_booking_id
  ON public.job_packing_sessions(vehicle_booking_id);

CREATE INDEX IF NOT EXISTS idx_job_packing_sessions_confirmed_at
  ON public.job_packing_sessions(job_id, confirmed_at DESC);

-- RLS
ALTER TABLE public.job_packing_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can view packing sessions for their company jobs"
  ON public.job_packing_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_users cu ON cu.company_id = j.company_id
      WHERE j.id = public.job_packing_sessions.job_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can create packing sessions for their company jobs"
  ON public.job_packing_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_users cu ON cu.company_id = j.company_id
      WHERE j.id = public.job_packing_sessions.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

DROP POLICY IF EXISTS "Users can update packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can update packing sessions for their company jobs"
  ON public.job_packing_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_users cu ON cu.company_id = j.company_id
      WHERE j.id = public.job_packing_sessions.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_users cu ON cu.company_id = j.company_id
      WHERE j.id = public.job_packing_sessions.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

DROP POLICY IF EXISTS "Users can delete packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can delete packing sessions for their company jobs"
  ON public.job_packing_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_users cu ON cu.company_id = j.company_id
      WHERE j.id = public.job_packing_sessions.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

COMMENT ON TABLE public.job_packing_sessions IS
  'User-confirmed packing/loading sessions per job vehicle booking. Stores partial loads to resume and audit later.';
