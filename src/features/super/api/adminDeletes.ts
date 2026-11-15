import { supabase } from '@shared/api/supabase'

/**
 * Cascade-delete a company and dependent rows that lack ON DELETE CASCADE.
 * Order is intentional — child tables first.
 */
export async function adminDeleteCompany(companyId: string): Promise<void> {
  const { data: timePeriods } = await supabase
    .from('time_periods')
    .select('id')
    .eq('company_id', companyId)

  const timePeriodIds = timePeriods?.map((tp) => tp.id) ?? []

  if (timePeriodIds.length > 0) {
    const { error: riError } = await supabase
      .from('reserved_items')
      .delete()
      .in('time_period_id', timePeriodIds)
    if (riError) throw riError

    const { error: rcError } = await supabase
      .from('reserved_crew')
      .delete()
      .in('time_period_id', timePeriodIds)
    if (rcError) throw rcError

    const { error: rvError } = await supabase
      .from('reserved_vehicles')
      .delete()
      .in('time_period_id', timePeriodIds)
    if (rvError) throw rvError
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('company_id', companyId)

  const jobIds = jobs?.map((j) => j.id) ?? []

  const { error: tpError } = await supabase
    .from('time_periods')
    .delete()
    .eq('company_id', companyId)
  if (tpError) throw tpError

  if (jobIds.length > 0) {
    const { error: jnError } = await supabase
      .from('job_notes')
      .delete()
      .in('job_id', jobIds)
    if (jnError) throw jnError

    const { error: jfError } = await supabase
      .from('job_files')
      .delete()
      .in('job_id', jobIds)
    if (jfError) throw jfError

    const { error: jcError } = await supabase
      .from('job_contacts')
      .delete()
      .in('job_id', jobIds)
    if (jcError) throw jcError

    const { error: jshError } = await supabase
      .from('job_status_history')
      .delete()
      .in('job_id', jobIds)
    if (jshError) throw jshError

    const { error: jiError } = await supabase
      .from('job_invoices')
      .delete()
      .in('job_id', jobIds)
    if (jiError) throw jiError
  }

  const { error: jobsError } = await supabase
    .from('jobs')
    .delete()
    .eq('company_id', companyId)
  if (jobsError) throw jobsError

  const { error: contactsError } = await supabase
    .from('contacts')
    .delete()
    .eq('company_id', companyId)
  if (contactsError) throw contactsError

  const { error: customersError } = await supabase
    .from('customers')
    .delete()
    .eq('company_id', companyId)
  if (customersError) throw customersError

  const { error: addressesError } = await supabase
    .from('addresses')
    .delete()
    .eq('company_id', companyId)
  if (addressesError) throw addressesError

  const { error: vehiclesError } = await supabase
    .from('vehicles')
    .delete()
    .eq('company_id', companyId)
  if (vehiclesError) throw vehiclesError

  const { error: gphError } = await supabase
    .from('group_price_history')
    .delete()
    .eq('company_id', companyId)
  if (gphError) throw gphError

  const { error: profilesError } = await supabase
    .from('profiles')
    .update({ selected_company_id: null })
    .eq('selected_company_id', companyId)
  if (profilesError) throw profilesError

  // Cascades: activity_log, company_expansions, company_users, item_*,
  // job_offers, matters, pending_invites, …
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId)

  if (error) throw error
}

/**
 * Cascade-delete a user profile and dependent rows that lack ON DELETE CASCADE.
 * Does not remove auth.users (requires Admin API).
 */
export async function adminDeleteUser(userId: string): Promise<void> {
  const { error: rcError } = await supabase
    .from('reserved_crew')
    .delete()
    .eq('user_id', userId)
  if (rcError) throw rcError

  const { error: cuError } = await supabase
    .from('company_users')
    .delete()
    .eq('user_id', userId)
  if (cuError) throw cuError

  const { error: matError } = await supabase
    .from('matters')
    .delete()
    .eq('created_by_user_id', userId)
  if (matError) throw matError

  const { error: mfError } = await supabase
    .from('matter_files')
    .delete()
    .eq('uploaded_by_user_id', userId)
  if (mfError) throw mfError

  const { error: mmError } = await supabase
    .from('matter_messages')
    .delete()
    .eq('user_id', userId)
  if (mmError) throw mmError

  const { error: mrError } = await supabase
    .from('matter_recipients')
    .delete()
    .eq('user_id', userId)
  if (mrError) throw mrError

  const { error: mrespError } = await supabase
    .from('matter_responses')
    .delete()
    .eq('user_id', userId)
  if (mrespError) throw mrespError

  const { error: jnError } = await supabase
    .from('job_notes')
    .delete()
    .eq('author_user_id', userId)
  if (jnError) throw jnError

  await supabase
    .from('job_files')
    .update({ uploaded_by_user_id: null })
    .eq('uploaded_by_user_id', userId)

  await supabase
    .from('jobs')
    .update({ project_lead_user_id: null })
    .eq('project_lead_user_id', userId)

  await supabase
    .from('companies')
    .update({ contact_person_id: null })
    .eq('contact_person_id', userId)

  await supabase
    .from('time_periods')
    .update({ reserved_by_user_id: null })
    .eq('reserved_by_user_id', userId)

  await supabase
    .from('time_periods')
    .update({ updated_by_user_id: null })
    .eq('updated_by_user_id', userId)

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}

export async function mergeUsers({
  keepUserId,
  absorbUserId,
}: {
  keepUserId: string
  absorbUserId: string
}): Promise<void> {
  const { error } = await supabase.rpc('merge_users', {
    p_keep_user_id: keepUserId,
    p_absorb_user_id: absorbUserId,
  })
  if (error) throw error
}
