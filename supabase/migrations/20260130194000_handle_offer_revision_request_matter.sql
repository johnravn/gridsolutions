-- Create a matter for the project lead when a customer requests an offer revision.
-- This is triggered from public offer updates (anon) and runs as SECURITY DEFINER.

CREATE OR REPLACE FUNCTION handle_offer_revision_request()
RETURNS TRIGGER AS $$
DECLARE
  job_title TEXT;
  project_lead_id UUID;
  creator_user_id UUID;
  new_matter_id UUID;
  requester_name TEXT;
  requester_phone TEXT;
  requester_comment TEXT;
BEGIN
  -- Only proceed when revision_requested_at is set for the first time
  IF NEW.revision_requested_at IS NULL OR OLD.revision_requested_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch job details
  SELECT title, project_lead_user_id
  INTO job_title, project_lead_id
  FROM jobs
  WHERE id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- If there's no project lead, we cannot route the notification
  IF project_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Choose a creator user (prefer owner, then super_user, then employee, fallback to project lead)
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
    CASE
      WHEN requester_phone IS NULL AND requester_comment IS NULL THEN
        requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '".'
      WHEN requester_phone IS NULL THEN
        requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '". Message: ' || requester_comment || '.'
      WHEN requester_comment IS NULL THEN
        requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '". Contact phone: ' || requester_phone || '.'
      ELSE
        requester_name || ' requested a revision on the offer for "' || coalesce(job_title, 'Untitled job') || '". Message: ' || requester_comment || '. Contact phone: ' || requester_phone || '.'
    END,
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_handle_offer_revision_request ON job_offers;
CREATE TRIGGER trigger_handle_offer_revision_request
  AFTER UPDATE ON job_offers
  FOR EACH ROW
  WHEN (NEW.revision_requested_at IS NOT NULL AND OLD.revision_requested_at IS NULL)
  EXECUTE FUNCTION handle_offer_revision_request();

