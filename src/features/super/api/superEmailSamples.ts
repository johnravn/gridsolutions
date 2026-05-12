/**
 * Super admin only: send each transactional email type to the signed-in user's profile email.
 * Uses the same Edge Functions as production; creates minimal DB rows where needed.
 */
import { supabase } from '@shared/api/supabase'
import {
  sendCrewPositionInviteEmail,
  sendMatterEmailTest,
  sendOfferByEmail,
  sendWelcomeEmailForPendingInvite,
} from '@shared/email/supabaseEdgeEmail'

export type SuperEmailSampleKind =
  | 'matter_test'
  | 'notification'
  | 'welcome'
  | 'offer'
  | 'crew_position_invite'

async function requireSession() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not signed in')
  }
  return user
}

async function profileEmail(userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!profile) throw new Error('Your profile has no email address')
  const email = profile.email.trim()
  if (!email) throw new Error('Your profile has no email address')
  return email
}

async function companyIdsForUser(userId: string): Promise<Array<string>> {
  const { data, error } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
  if (error) throw error
  return data.map((r) => r.company_id).filter(Boolean)
}

function matchesProfileEmail(
  stored: string | null | undefined,
  expectedEmail: string,
): boolean {
  const s = typeof stored === 'string' ? stored.trim().toLowerCase() : ''
  const p = expectedEmail.trim().toLowerCase()
  return s.length > 0 && s === p
}

/** Reusable super-email fixture so samples work without manual job setup. */
const SUPER_SAMPLE_CREW_JOB_TITLE = '[Super sample] Crew invite fixture'

async function findPlannedEmailOnlyReservedCrew(
  companyIds: Array<string>,
): Promise<{ id: string; placeholder_email: string | null } | null> {
  const { data: row, error: rcErr } = await supabase
    .from('reserved_crew')
    .select(
      'id, placeholder_email, time_periods!reserved_crew_time_period_id_fkey!inner(company_id)',
    )
    .eq('status', 'planned')
    .is('user_id', null)
    .in('time_periods.company_id', companyIds)
    .limit(1)
    .maybeSingle()

  if (rcErr) {
    throw new Error(rcErr.message)
  }
  if (!row?.id) return null
  return { id: row.id, placeholder_email: row.placeholder_email }
}

/**
 * Creates a draft job, crew time period, and email-only planned crew row for this company
 * so send-crew-position-invite-email has valid context (job + placeholder email).
 */
async function ensureSuperSampleCrewInviteReservedCrew(params: {
  companyId: string
  profileEmail: string
}): Promise<{ id: string; placeholder_email: string | null }> {
  const { companyId, profileEmail: profileEmailForPlaceholder } = params
  const windowStart = new Date()
  const windowEnd = new Date(windowStart.getTime() + 8 * 60 * 60 * 1000)
  const startIso = windowStart.toISOString()
  const endIso = windowEnd.toISOString()

  const { data: existingJob, error: jobSelErr } = await supabase
    .from('jobs')
    .select('id')
    .eq('company_id', companyId)
    .eq('title', SUPER_SAMPLE_CREW_JOB_TITLE)
    .limit(1)
    .maybeSingle()
  if (jobSelErr) throw jobSelErr

  let jobId: string
  if (existingJob?.id) {
    jobId = existingJob.id
  } else {
    const { data: createdJob, error: jobInsErr } = await supabase
      .from('jobs')
      .insert({
        company_id: companyId,
        title: SUPER_SAMPLE_CREW_JOB_TITLE,
        status: 'draft',
        start_at: startIso,
        end_at: endIso,
      })
      .select('id')
      .single()
    if (jobInsErr) throw jobInsErr
    jobId = createdJob.id
  }

  const { data: existingTp, error: tpSelErr } = await supabase
    .from('time_periods')
    .select('id')
    .eq('job_id', jobId)
    .eq('category', 'crew')
    .eq('deleted', false)
    .limit(1)
    .maybeSingle()
  if (tpSelErr) throw tpSelErr

  let timePeriodId: string
  if (existingTp?.id) {
    timePeriodId = existingTp.id
  } else {
    const { data: createdTp, error: tpInsErr } = await supabase
      .from('time_periods')
      .insert({
        job_id: jobId,
        company_id: companyId,
        category: 'crew',
        title: 'Sample crew role',
        start_at: startIso,
        end_at: endIso,
        needed_count: 1,
      })
      .select('id')
      .single()
    if (tpInsErr) throw tpInsErr
    timePeriodId = createdTp.id
  }

  const { data: existingRc, error: rcSelErr } = await supabase
    .from('reserved_crew')
    .select('id, placeholder_email')
    .eq('time_period_id', timePeriodId)
    .eq('status', 'planned')
    .is('user_id', null)
    .maybeSingle()
  if (rcSelErr) throw rcSelErr

  if (existingRc?.id) {
    return {
      id: existingRc.id,
      placeholder_email: existingRc.placeholder_email,
    }
  }

  const trimmedEmail = profileEmailForPlaceholder.trim()
  const { data: createdRc, error: rcInsErr } = await supabase
    .from('reserved_crew')
    .insert({
      time_period_id: timePeriodId,
      status: 'planned',
      user_id: null,
      placeholder_name: 'Sample invite',
      placeholder_email: trimmedEmail,
    })
    .select('id, placeholder_email')
    .single()
  if (rcInsErr) throw rcInsErr
  return {
    id: createdRc.id,
    placeholder_email: createdRc.placeholder_email,
  }
}

export async function sendSuperSampleEmail(
  kind: SuperEmailSampleKind,
): Promise<void> {
  const user = await requireSession()
  const companyIds = await companyIdsForUser(user.id)
  if (companyIds.length === 0) {
    throw new Error('Join at least one company to send sample emails')
  }
  const companyId = companyIds[0]
  const email = await profileEmail(user.id)

  switch (kind) {
    case 'matter_test': {
      const r = await sendMatterEmailTest({ companyId })
      if (!r.ok) throw new Error(r.failure.message)
      return
    }
    case 'notification': {
      const { error } = await supabase.from('notifications').insert({
        company_id: companyId,
        user_id: user.id,
        created_by_user_id: user.id,
        type: 'matter_update',
        title: '[Super test] Notification email',
        body_text:
          'This sample uses the same template as in-app notifications (matters, offers, etc.). Delivery is queued by the database when vault/pg_net is configured.',
        action_url: '/matters',
        email_force_send: true,
      })
      if (error) throw error
      return
    }
    case 'welcome': {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { data: inserted, error: insErr } = await supabase
        .from('pending_invites')
        .insert({
          company_id: companyId,
          inviter_user_id: user.id,
          email,
          role: 'employee',
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .maybeSingle()

      const errStatus = (insErr as { status?: number } | null)?.status
      const duplicateKey =
        insErr?.code === '23505' ||
        errStatus === 409 ||
        (typeof insErr?.message === 'string' &&
          /duplicate|unique|already exists|violates unique constraint/i.test(
            insErr.message,
          ))

      let pendingInviteId: string | null = inserted?.id ?? null

      if (insErr && !duplicateKey) {
        throw insErr
      }

      if (!pendingInviteId && duplicateKey) {
        const { data: existing, error: selErr } = await supabase
          .from('pending_invites')
          .select('id')
          .eq('company_id', companyId)
          .eq('email', email)
          .maybeSingle()

        if (selErr) throw selErr
        if (!existing?.id) {
          throw new Error('Invite exists but could not be loaded — try again')
        }
        pendingInviteId = existing.id
      }

      if (!pendingInviteId) {
        throw insErr ?? new Error('Could not create or resolve pending invite')
      }

      const r = await sendWelcomeEmailForPendingInvite(pendingInviteId)
      if (!r.ok) throw new Error(r.failure.message)
      return
    }
    case 'offer': {
      const { data: offer, error: offErr } = await supabase
        .from('job_offers')
        .select('id')
        .eq('locked', true)
        .in('company_id', companyIds)
        .limit(1)
        .maybeSingle()
      if (offErr) throw offErr
      if (!offer?.id) {
        throw new Error(
          'No locked job offer found in a company you belong to. Lock an offer first.',
        )
      }
      const r = await sendOfferByEmail({ offerId: offer.id, toEmail: email })
      if (!r.ok) throw new Error(r.failure.message)
      return
    }
    case 'crew_position_invite': {
      const row =
        (await findPlannedEmailOnlyReservedCrew(companyIds)) ??
        (await ensureSuperSampleCrewInviteReservedCrew({
          companyId,
          profileEmail: email,
        }))

      const previousPlaceholder = row.placeholder_email
      const alreadyTarget = matchesProfileEmail(previousPlaceholder, email)

      if (!alreadyTarget) {
        const { error: upErr } = await supabase
          .from('reserved_crew')
          .update({ placeholder_email: email })
          .eq('id', row.id)
        if (upErr) throw upErr
      }

      try {
        const r = await sendCrewPositionInviteEmail({ reservedCrewId: row.id })
        if (!r.ok) throw new Error(r.failure.message)
      } finally {
        if (!alreadyTarget) {
          const { error: restoreErr } = await supabase
            .from('reserved_crew')
            .update({ placeholder_email: previousPlaceholder })
            .eq('id', row.id)
          if (restoreErr && import.meta.env.DEV) {
            console.warn(
              '[superEmailSamples] could not restore placeholder_email',
              restoreErr,
            )
          }
        }
      }
      return
    }
  }
}
