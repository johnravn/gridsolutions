-- Crew invite answered → in-app + email for project lead.
-- Prod: notifications INSERT RLS requires created_by_user_id = auth.uid(); the answering
-- crew member is the session user. Local often bypasses RLS for SECURITY DEFINER / owner,
-- so the old INSERT (no created_by_user_id) appeared to work only locally.
-- Also set email_force_send so send-notification-email is not skipped when the lead has
-- matter-update email prefs off.

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
    created_by_user_id,
    email_force_send,
    type,
    title,
    body_text,
    action_url,
    entity_type,
    entity_id
  ) VALUES (
    m_company_id,
    project_lead_id,
    NEW.user_id,
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
