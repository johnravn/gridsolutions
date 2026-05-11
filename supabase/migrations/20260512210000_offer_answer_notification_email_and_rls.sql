-- Offer accepted / rejected → project lead notification + email (same issues as crew answer):
-- 1) email_force_send so matter_update is not skipped when prefs off.
-- 2) created_by_user_id: coalesce(auth.uid(), creator_user_id, project_lead_id) so internal
--    updates match RLS; public_offer_accept RPC often has auth.uid() null → use creator.
-- 3) INSERT policy: allow auth.uid() IS NULL branch when created_by_user_id is the actor
--    (DB trigger path only; authenticated clients cannot satisfy auth.uid() IS NULL).

DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;

CREATE POLICY "Company members can create notifications for company users"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR (
      auth.uid() IS NOT NULL
      AND created_by_user_id IS NOT DISTINCT FROM auth.uid()
      AND public.notification_insert_allowed_for_actor(
        company_id,
        user_id,
        auth.uid()
      )
    )
    OR (
      auth.uid() IS NULL
      AND created_by_user_id IS NOT NULL
      AND public.notification_insert_allowed_for_actor(
        company_id,
        user_id,
        created_by_user_id
      )
    )
  );

CREATE OR REPLACE FUNCTION public.handle_offer_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  previous_status public.job_status;
  job_title TEXT;
  project_lead_id UUID;
  creator_user_id UUID;
  new_matter_id UUID;
  status_metadata JSONB;
  accepted_by_name TEXT;
  accepted_phone TEXT;
  matter_body TEXT;
  notif_creator uuid;
BEGIN
  SELECT status, title, project_lead_user_id
  INTO previous_status, job_title, project_lead_id
  FROM jobs
  WHERE id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF previous_status IS DISTINCT FROM 'confirmed' THEN
    UPDATE jobs
    SET status = 'confirmed'
    WHERE id = NEW.job_id;
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

  status_metadata := jsonb_build_object(
    'job_id', NEW.job_id,
    'job_title', job_title,
    'previous_status', previous_status,
    'new_status', 'confirmed',
    'offer_id', NEW.id
  );

  IF creator_user_id IS NOT NULL THEN
    INSERT INTO activity_log (
      company_id,
      activity_type,
      created_by_user_id,
      title,
      metadata
    ) VALUES (
      NEW.company_id,
      'job_status_changed',
      creator_user_id,
      job_title,
      status_metadata
    );
  END IF;

  IF project_lead_id IS NOT NULL THEN
    accepted_by_name := coalesce(nullif(trim(NEW.accepted_by_name), ''), 'Customer');
    accepted_phone := coalesce(nullif(trim(NEW.accepted_by_phone), ''), NULL);

    matter_body := CASE
      WHEN accepted_phone IS NULL THEN
        accepted_by_name || ' accepted the offer for "' || coalesce(job_title, 'Untitled job') || '".'
      ELSE
        accepted_by_name || ' accepted the offer for "' || coalesce(job_title, 'Untitled job') || '". Contact phone: ' || accepted_phone || '.'
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
      'Offer accepted: ' || coalesce(job_title, 'Untitled job'),
      matter_body,
      NEW.job_id,
      TRUE,
      jsonb_build_object(
        'offer_id', NEW.id,
        'offer_version', NEW.version_number,
        'accepted_at', NEW.accepted_at,
        'accepted_by_name', NEW.accepted_by_name,
        'accepted_by_phone', NEW.accepted_by_phone
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

    notif_creator := coalesce(auth.uid(), creator_user_id, project_lead_id);

    INSERT INTO public.notifications (
      company_id,
      user_id,
      created_by_user_id,
      email_force_send,
      type,
      title,
      body_text,
      action_url,
      entity_type,
      entity_id
    ) VALUES (
      NEW.company_id,
      project_lead_id,
      notif_creator,
      TRUE,
      'matter_update'::public.notification_type,
      'Offer accepted: ' || coalesce(job_title, 'Untitled job'),
      matter_body,
      '/matters?matterId=' || new_matter_id::text,
      'matter',
      new_matter_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_offer_rejection_notify_project_lead()
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
  rejected_by_name TEXT;
  rejected_phone TEXT;
  rejection_comment TEXT;
  matter_body TEXT;
  matter_title TEXT;
  notif_creator uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'rejected' OR OLD.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT j.title, j.project_lead_user_id
  INTO job_title, project_lead_id
  FROM jobs j
  WHERE j.id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND OR project_lead_id IS NULL THEN
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

  rejected_by_name := coalesce(nullif(trim(NEW.rejected_by_name), ''), 'Customer');
  rejected_phone := coalesce(nullif(trim(NEW.rejected_by_phone), ''), NULL);
  rejection_comment := nullif(trim(NEW.rejection_comment), '');

  matter_body := CASE
    WHEN rejection_comment IS NULL AND rejected_phone IS NULL THEN
      rejected_by_name || ' rejected the offer for "' || coalesce(job_title, 'Untitled job') || '".'
    WHEN rejection_comment IS NULL THEN
      rejected_by_name || ' rejected the offer for "' || coalesce(job_title, 'Untitled job') || '". Contact phone: ' || rejected_phone || '.'
    WHEN rejected_phone IS NULL THEN
      rejected_by_name || ' rejected the offer for "' || coalesce(job_title, 'Untitled job') || '". Message: ' || rejection_comment || '.'
    ELSE
      rejected_by_name || ' rejected the offer for "' || coalesce(job_title, 'Untitled job') || '". Message: ' || rejection_comment || '. Contact phone: ' || rejected_phone || '.'
  END;

  matter_title := 'Offer rejected: ' || coalesce(job_title, 'Untitled job');

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
    matter_title,
    matter_body,
    NEW.job_id,
    TRUE,
    jsonb_build_object(
      'offer_id', NEW.id,
      'offer_version', NEW.version_number,
      'rejected_at', NEW.rejected_at,
      'rejected_by_name', NEW.rejected_by_name,
      'rejected_by_phone', NEW.rejected_by_phone
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

  notif_creator := coalesce(auth.uid(), creator_user_id, project_lead_id);

  INSERT INTO public.notifications (
    company_id,
    user_id,
    created_by_user_id,
    email_force_send,
    type,
    title,
    body_text,
    action_url,
    entity_type,
    entity_id
  ) VALUES (
    NEW.company_id,
    project_lead_id,
    notif_creator,
    TRUE,
    'matter_update'::public.notification_type,
    matter_title,
    matter_body,
    '/matters?matterId=' || new_matter_id::text,
    'matter',
    new_matter_id::text
  );

  RETURN NEW;
END;
$$;
