-- Project lead: update matters + notification rows (bell + email via dispatch) when
-- a crew invitation is answered or an offer is rejected. Offer acceptance already
-- created a matter; add the missing notifications row. Email respects email_matter_updates.

-- ---------------------------------------------------------------------------
-- Offer accepted: keep existing behavior; add Notification Center row
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Offer rejected: matter + recipient + notification for project lead only
-- ---------------------------------------------------------------------------
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
    matter_title,
    matter_body,
    '/matters?matterId=' || new_matter_id::text,
    'matter',
    new_matter_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_offer_rejection_notify ON public.job_offers;
CREATE TRIGGER trigger_handle_offer_rejection_notify
  AFTER UPDATE ON public.job_offers
  FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected')
  EXECUTE FUNCTION public.handle_offer_rejection_notify_project_lead();

-- ---------------------------------------------------------------------------
-- Crew invite answered (recipient accepted / declined): notify project lead
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_project_lead_crew_invite_answered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m_company_id UUID;
  m_job_id UUID;
  m_time_period_id UUID;
  m_matter_type public.matter_type;
  project_lead_id UUID;
  creator_user_id UUID;
  job_title TEXT;
  tp_title TEXT;
  new_matter_id UUID;
  actor_display TEXT;
  outcome_phrase TEXT;
  matter_title TEXT;
  matter_body TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;

  SELECT m.company_id, m.job_id, m.time_period_id, m.matter_type
  INTO m_company_id, m_job_id, m_time_period_id, m_matter_type
  FROM matters m
  WHERE m.id = NEW.matter_id;

  IF m_matter_type <> 'crew_invite'::public.matter_type THEN
    RETURN NEW;
  END IF;

  IF m_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT j.title, j.project_lead_user_id
  INTO job_title, project_lead_id
  FROM jobs j
  WHERE j.id = m_job_id;

  IF NOT FOUND OR project_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = project_lead_id THEN
    RETURN NEW;
  END IF;

  SELECT cu.user_id
  INTO creator_user_id
  FROM company_users cu
  WHERE cu.company_id = m_company_id
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

  SELECT coalesce(nullif(trim(p.display_name), ''), 'Team member')
  INTO actor_display
  FROM profiles p
  WHERE p.user_id = NEW.user_id;

  outcome_phrase := CASE NEW.status
    WHEN 'accepted' THEN 'accepted the crew invitation'
    ELSE 'declined the crew invitation'
  END;

  matter_title := 'Crew invite ' || CASE NEW.status WHEN 'accepted' THEN 'accepted' ELSE 'declined' END
    || ': ' || coalesce(job_title, 'Untitled job');

  SELECT coalesce(nullif(trim(tp.title), ''), 'Role')
  INTO tp_title
  FROM time_periods tp
  WHERE tp.id = m_time_period_id;

  matter_body := actor_display || ' ' || outcome_phrase || ' for "'
    || coalesce(job_title, 'Untitled job') || '" (' || coalesce(tp_title, 'role') || ').';

  INSERT INTO matters (
    company_id,
    created_by_user_id,
    matter_type,
    title,
    content,
    job_id,
    time_period_id,
    created_as_company,
    metadata
  ) VALUES (
    m_company_id,
    coalesce(creator_user_id, project_lead_id),
    'update',
    matter_title,
    matter_body,
    m_job_id,
    m_time_period_id,
    TRUE,
    jsonb_build_object(
      'source_crew_invite_matter_id', NEW.matter_id,
      'answered_by_user_id', NEW.user_id,
      'recipient_status', NEW.status::text
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
    m_company_id,
    project_lead_id,
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

DROP TRIGGER IF EXISTS trigger_notify_project_lead_crew_invite_answered ON public.matter_recipients;
CREATE TRIGGER trigger_notify_project_lead_crew_invite_answered
  AFTER UPDATE ON public.matter_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_project_lead_crew_invite_answered();
