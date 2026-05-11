-- Matters: block authenticated users from INSERTing matter_type = 'update' (system/triggers only).
-- Announcements: only owner and employee (company super_user keeps crew_invite / legacy types only).
-- Offer revision: ensure one notification row when the revision matter is created from the DB trigger.

-- ---------------------------------------------------------------------------
-- Revision request matter: add notification row (bell + email dispatch pipeline)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_offer_revision_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_title TEXT;
  project_lead_id UUID;
  creator_user_id UUID;
  new_matter_id UUID;
  requester_name TEXT;
  requester_phone TEXT;
  requester_comment TEXT;
  matter_body TEXT;
BEGIN
  IF NEW.revision_requested_at IS NULL OR OLD.revision_requested_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT title, project_lead_user_id
  INTO job_title, project_lead_id
  FROM jobs
  WHERE id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF project_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cu.user_id
  INTO creator_user_id
  FROM company_users cu
  WHERE cu.company_id = NEW.company_id
  ORDER BY
    CASE cu.role
      WHEN 'owner' THEN 1
      WHEN 'super_user' THEN 2
      WHEN 'employee' THEN 3
      WHEN 'freelancer' THEN 4
      ELSE 5
    END
  LIMIT 1;

  IF creator_user_id IS NULL THEN
    creator_user_id := project_lead_id;
  END IF;

  requester_name := coalesce(nullif(trim(NEW.revision_requested_by_name), ''), 'Customer');
  requester_phone := coalesce(nullif(trim(NEW.revision_requested_by_phone), ''), NULL);
  requester_comment := coalesce(nullif(trim(NEW.revision_comment), ''), NULL);

  matter_body := CASE
    WHEN requester_phone IS NULL AND requester_comment IS NULL THEN
      requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '".'
    WHEN requester_phone IS NULL THEN
      requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '". Message: ' || requester_comment || '.'
    WHEN requester_comment IS NULL THEN
      requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '". Contact phone: ' || requester_phone || '.'
    ELSE
      requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '". Message: ' || requester_comment || '. Contact phone: ' || requester_phone || '.'
  END;

  INSERT INTO matters (
    company_id,
    created_by_user_id,
    matter_type,
    title,
    content,
    job_id,
    created_as_company,
    metadata
  ) VALUES (
    NEW.company_id,
    coalesce(creator_user_id, project_lead_id),
    'update',
    'Offer revision requested: ' || coalesce(job_title, 'Untitled job'),
    matter_body,
    NEW.job_id,
    TRUE,
    jsonb_build_object(
      'offer_id', NEW.id,
      'offer_version', NEW.version_number,
      'revision_requested_at', NEW.revision_requested_at,
      'revision_requested_by_name', NEW.revision_requested_by_name,
      'revision_requested_by_phone', NEW.revision_requested_by_phone
    )
  )
  RETURNING id INTO new_matter_id;

  INSERT INTO matter_recipients (
    matter_id,
    user_id,
    status
  ) VALUES (
    new_matter_id,
    project_lead_id,
    'pending'
  );

  INSERT INTO public.notifications (
    company_id,
    user_id,
    type,
    title,
    body_text,
    action_url,
    entity_type,
    entity_id
  ) VALUES (
    NEW.company_id,
    project_lead_id,
    'matter_update'::public.notification_type,
    'Offer revision requested: ' || coalesce(job_title, 'Untitled job'),
    matter_body,
    '/matters?matterId=' || new_matter_id::text,
    'matter',
    new_matter_id::text
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- matters INSERT RLS: no client-created "update"; announcements for owner/employee only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create matters for their company" ON public.matters;
CREATE POLICY "Users can create matters for their company"
  ON public.matters
  FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND (
      public.is_superuser(auth.uid())
      OR (
        EXISTS (
          SELECT 1
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.company_id = matters.company_id
            AND cu.role IN ('owner', 'employee')
        )
        AND matters.matter_type IN ('announcement', 'crew_invite', 'vote', 'chat')
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.company_id = matters.company_id
            AND cu.role = 'super_user'
        )
        AND matters.matter_type IN ('crew_invite', 'vote', 'chat')
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.company_id = matters.company_id
            AND cu.role = 'freelancer'
        )
        AND matters.matter_type = 'crew_invite'
      )
    )
  );
