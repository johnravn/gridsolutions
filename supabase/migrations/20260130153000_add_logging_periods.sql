-- Add logging periods for monthly time entry locking

CREATE TABLE IF NOT EXISTS logging_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logging_periods_unique UNIQUE (company_id, period_start),
  CONSTRAINT logging_periods_month_start CHECK (
    date_trunc('month', period_start)::date = period_start
  )
);

CREATE INDEX IF NOT EXISTS idx_logging_periods_company_id
  ON logging_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_logging_periods_period_start
  ON logging_periods(period_start);

ALTER TABLE logging_periods ENABLE ROW LEVEL SECURITY;

-- Users can view logging periods for their company
DROP POLICY IF EXISTS "Users can view logging periods" ON logging_periods;
CREATE POLICY "Users can view logging periods"
  ON logging_periods
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'employee', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Owners can manage logging periods
DROP POLICY IF EXISTS "Owners can insert logging periods" ON logging_periods;
CREATE POLICY "Owners can insert logging periods"
  ON logging_periods
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Owners can update logging periods" ON logging_periods;
CREATE POLICY "Owners can update logging periods"
  ON logging_periods
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Owners can delete logging periods" ON logging_periods;
CREATE POLICY "Owners can delete logging periods"
  ON logging_periods
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_logging_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS logging_periods_updated_at ON logging_periods;
CREATE TRIGGER logging_periods_updated_at
  BEFORE UPDATE ON logging_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_logging_periods_updated_at();

COMMENT ON TABLE logging_periods IS 'Monthly lock periods for time logging';

-- Enforce unlocked periods for time entries
DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
CREATE POLICY "Users can insert their own time entries"
  ON time_entries
  FOR INSERT
  WITH CHECK (
    (
      (
        user_id = auth.uid()
        AND company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'employee', 'super_user')
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.superuser = true
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM logging_periods lp
      WHERE lp.company_id = time_entries.company_id
        AND lp.period_start = date_trunc('month', time_entries.start_at)::date
        AND lp.is_locked = true
    )
  );

DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;
CREATE POLICY "Users can update their own time entries"
  ON time_entries
  FOR UPDATE
  USING (
    (
      (
        user_id = auth.uid()
        AND company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'employee', 'super_user')
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.superuser = true
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM logging_periods lp
      WHERE lp.company_id = time_entries.company_id
        AND lp.period_start = date_trunc('month', time_entries.start_at)::date
        AND lp.is_locked = true
    )
  )
  WITH CHECK (
    (
      (
        user_id = auth.uid()
        AND company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'employee', 'super_user')
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.superuser = true
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM logging_periods lp
      WHERE lp.company_id = time_entries.company_id
        AND lp.period_start = date_trunc('month', time_entries.start_at)::date
        AND lp.is_locked = true
    )
  );

DROP POLICY IF EXISTS "Users can delete their own time entries" ON time_entries;
CREATE POLICY "Users can delete their own time entries"
  ON time_entries
  FOR DELETE
  USING (
    (
      (
        user_id = auth.uid()
        AND company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'employee', 'super_user')
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.superuser = true
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM logging_periods lp
      WHERE lp.company_id = time_entries.company_id
        AND lp.period_start = date_trunc('month', time_entries.start_at)::date
        AND lp.is_locked = true
    )
  );
