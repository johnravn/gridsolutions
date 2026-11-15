import { supabase } from '@shared/api/supabase'
import { unwrapRelation } from '@shared/api/unwrapRelation'

export type CrewInviteAddress = {
  id: string
  name: string | null
  address_line: string | null
  zip_code: string | null
  city: string | null
  country: string | null
}

export type CrewInviteDetails = {
  job: {
    id: string
    title: string
    job_address_id: string | null
    address: CrewInviteAddress | null
  }
  timePeriod: {
    id: string
    title: string | null
    start_at: string
    end_at: string
    role_category: string | null
  }
  notes: string | null
}

export function crewInviteDetailsQuery({
  matterId,
  jobId,
  timePeriodId,
}: {
  matterId: string
  jobId: string
  timePeriodId: string
}) {
  return {
    queryKey: ['matters', 'crew-invite-details', matterId] as const,
    queryFn: async (): Promise<CrewInviteDetails> => {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(
          'id, title, job_address_id, address:job_address_id ( id, name, address_line, zip_code, city, country )',
        )
        .eq('id', jobId)
        .single()

      if (jobError) throw jobError

      const { data: timePeriod, error: tpError } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, role_category')
        .eq('id', timePeriodId)
        .single()

      if (tpError) throw tpError

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      let notes: string | null = null
      if (authUser) {
        const { data: crewRow } = await supabase
          .from('reserved_crew')
          .select('notes')
          .eq('time_period_id', timePeriodId)
          .eq('user_id', authUser.id)
          .maybeSingle()
        notes = crewRow?.notes || null
      }

      if (!job || !timePeriod) {
        throw new Error('Crew invite job or time period not found')
      }

      return {
        job: {
          id: job.id,
          title: job.title,
          job_address_id: job.job_address_id,
          address: unwrapRelation<CrewInviteAddress>(job.address),
        },
        timePeriod,
        notes,
      }
    },
  }
}
