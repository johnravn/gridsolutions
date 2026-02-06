-- Migration: Add internal one-liners for crew members
-- Created: 2026-01-31
--
-- Purpose:
-- Companies want an INTERNAL one-liner about each company member (employee/freelancer/owner),
-- visible only to employees and upwards (employee, owner, super_user, or global superuser).
-- Freelancers should never be able to read these notes.

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_user_internal_notes (
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid DEFAULT auth.uid(),
  CONSTRAINT company_user_internal_notes_pkey PRIMARY KEY (company_id, user_id),
  CONSTRAINT company_user_internal_notes_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT company_user_internal_notes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.company_user_internal_notes
  IS 'Internal one-liner notes for company members (visible to employees+ only).';
COMMENT ON COLUMN public.company_user_internal_notes.note
  IS 'Internal one-liner about a company member. Never visible to freelancers.';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.company_user_internal_notes ENABLE ROW LEVEL SECURITY;

-- Helper: keep updated_* in sync
CREATE OR REPLACE FUNCTION public.touch_company_user_internal_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by_user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_user_internal_notes_touch
  ON public.company_user_internal_notes;

CREATE TRIGGER trg_company_user_internal_notes_touch
BEFORE UPDATE ON public.company_user_internal_notes
FOR EACH ROW
EXECUTE FUNCTION public.touch_company_user_internal_notes();

-- Only employees+ (or global superusers) can read/write internal notes.
-- Also enforce that the target user is a member of the company.

DROP POLICY IF EXISTS "Employees can view company member internal notes"
  ON public.company_user_internal_notes;
CREATE POLICY "Employees can view company member internal notes"
  ON public.company_user_internal_notes
  FOR SELECT
  USING (
    public.user_has_company_role(
      company_id,
      auth.uid(),
      ARRAY[
        'owner'::public.company_role,
        'employee'::public.company_role,
        'super_user'::public.company_role
      ]
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Employees can insert company member internal notes"
  ON public.company_user_internal_notes;
CREATE POLICY "Employees can insert company member internal notes"
  ON public.company_user_internal_notes
  FOR INSERT
  WITH CHECK (
    public.user_has_company_role(
      company_id,
      auth.uid(),
      ARRAY[
        'owner'::public.company_role,
        'employee'::public.company_role,
        'super_user'::public.company_role
      ]
    )
    AND public.user_is_company_member(company_id, user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Employees can update company member internal notes"
  ON public.company_user_internal_notes;
CREATE POLICY "Employees can update company member internal notes"
  ON public.company_user_internal_notes
  FOR UPDATE
  USING (
    public.user_has_company_role(
      company_id,
      auth.uid(),
      ARRAY[
        'owner'::public.company_role,
        'employee'::public.company_role,
        'super_user'::public.company_role
      ]
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  )
  WITH CHECK (
    public.user_has_company_role(
      company_id,
      auth.uid(),
      ARRAY[
        'owner'::public.company_role,
        'employee'::public.company_role,
        'super_user'::public.company_role
      ]
    )
    AND public.user_is_company_member(company_id, user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Employees can delete company member internal notes"
  ON public.company_user_internal_notes;
CREATE POLICY "Employees can delete company member internal notes"
  ON public.company_user_internal_notes
  FOR DELETE
  USING (
    public.user_has_company_role(
      company_id,
      auth.uid(),
      ARRAY[
        'owner'::public.company_role,
        'employee'::public.company_role,
        'super_user'::public.company_role
      ]
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

-- Permissions (keep consistent with base schema; RLS still restricts access)
GRANT ALL ON TABLE public.company_user_internal_notes TO anon;
GRANT ALL ON TABLE public.company_user_internal_notes TO authenticated;
GRANT ALL ON TABLE public.company_user_internal_notes TO service_role;

