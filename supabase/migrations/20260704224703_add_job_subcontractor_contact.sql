-- Add optional contact person to job subcontractors
ALTER TABLE public.job_subcontractors
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_subcontractors_contact_id_idx
  ON public.job_subcontractors (contact_id);
