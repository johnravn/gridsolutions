-- Add program_group to time_periods for grouping program periods (e.g. Day 1, Day 2, Setup)
ALTER TABLE public.time_periods
  ADD COLUMN IF NOT EXISTS program_group text;

COMMENT ON COLUMN public.time_periods.program_group IS 'Optional group label for program periods (e.g. Day 1, Day 2, Setup). Used for visual separation in the Program tab.';
