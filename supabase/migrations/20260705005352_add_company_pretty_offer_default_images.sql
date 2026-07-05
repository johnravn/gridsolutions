-- Company-scoped default images for pretty offer editor (image + title)

CREATE TABLE IF NOT EXISTS public.company_pretty_offer_default_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_pretty_offer_default_images_company_sort
  ON public.company_pretty_offer_default_images(company_id, sort_order);

DROP TRIGGER IF EXISTS trigger_update_company_pretty_offer_default_images_updated_at
  ON public.company_pretty_offer_default_images;
CREATE TRIGGER trigger_update_company_pretty_offer_default_images_updated_at
BEFORE UPDATE ON public.company_pretty_offer_default_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_pretty_offer_default_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company pretty offer default images"
  ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can view company pretty offer default images"
  ON public.company_pretty_offer_default_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_pretty_offer_default_images.company_id
        AND cu.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create company pretty offer default images"
  ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can create company pretty offer default images"
  ON public.company_pretty_offer_default_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_pretty_offer_default_images.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update company pretty offer default images"
  ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can update company pretty offer default images"
  ON public.company_pretty_offer_default_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_pretty_offer_default_images.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_pretty_offer_default_images.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete company pretty offer default images"
  ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can delete company pretty offer default images"
  ON public.company_pretty_offer_default_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_pretty_offer_default_images.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );
