// src/features/calendar/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import type { CalendarRecord } from '../components/domain'

/** Fetch time periods for a specific vehicle (category = 'transport') */
export function vehicleCalendarQuery({
  companyId,
  vehicleId,
  limit,
  offset = 0,
  fromDate,
}: {
  companyId: string
  vehicleId: string
  limit?: number
  offset?: number
  fromDate?: string // ISO date string to filter to future events
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: [
      'company',
      companyId,
      'vehicle-calendar',
      vehicleId,
      limit,
      offset,
      fromDate,
    ] as const,
    queryFn: async () => {
      // First, find all reserved_vehicles for this vehicle
      const { data: reservations, error: resErr } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id')
        .eq('vehicle_id', vehicleId)

      if (resErr) throw resErr

      if (!reservations || reservations.length === 0) return []

      const timePeriodIds = reservations.map((r) => r.time_period_id)

      // Then fetch the time_periods
      let query = supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'transport')
        .in('id', timePeriodIds)
        .eq('deleted', false)

      // Filter to future events if fromDate is provided
      if (fromDate) {
        query = query.gte('start_at', fromDate)
      }

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1)
      }

      const { data, error } = await query.order('start_at', { ascending: true })

      if (error) throw error

      if (!data || data.length === 0) return []

      // Get unique job IDs for fetching job titles
      const jobIds = Array.from(
        new Set(data.map((tp) => tp.job_id).filter((id): id is string => !!id)),
      )

      // Fetch job titles
      const jobTitles = new Map<string, string>()
      if (jobIds.length > 0) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title')
          .in('id', jobIds)

        if (jobsError) throw jobsError
        ;(jobsData || []).forEach((job: any) => {
          if (job.id && job.title) {
            jobTitles.set(job.id, job.title)
          }
        })
      }

      return data.map((tp: any): CalendarRecord => {
        const jobTitle = tp.job_id
          ? jobTitles.get(tp.job_id) || undefined
          : undefined

        return {
          id: tp.id,
          title: tp.title || 'Transport',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'vehicle',
          ref: {
            vehicleId,
            jobId: tp.job_id || undefined,
          },
          notes: undefined,
          jobTitle: jobTitle || undefined,
        }
      })
    },
  })
}

/** Fetch time periods for a specific item (category = 'equipment') */
export function itemCalendarQuery({
  companyId,
  itemId,
}: {
  companyId: string
  itemId: string
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: ['company', companyId, 'item-calendar', itemId] as const,
    queryFn: async () => {
      // First, find all reserved_items for this item
      const { data: reservations, error: resErr } = await supabase
        .from('reserved_items')
        .select('time_period_id')
        .eq('item_id', itemId)

      if (resErr) throw resErr

      if (!reservations || reservations.length === 0) return []

      const timePeriodIds = reservations.map((r) => r.time_period_id)

      // Then fetch the time_periods
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'equipment')
        .in('id', timePeriodIds)
        .eq('deleted', false)
        .order('start_at', { ascending: true })

      if (error) throw error

      if (!data || data.length === 0) return []

      // Fetch all items for each time period to populate itemIds array
      const { data: allItemsRes, error: itemsError } = await supabase
        .from('reserved_items')
        .select('time_period_id, item_id')
        .in('time_period_id', timePeriodIds)

      if (itemsError) throw itemsError

      // Create a map of time_period_id to array of item_ids
      const itemMap = new Map<string, Array<string>>()
      ;(allItemsRes || []).forEach((i: any) => {
        if (!itemMap.has(i.time_period_id)) {
          itemMap.set(i.time_period_id, [])
        }
        itemMap.get(i.time_period_id)!.push(i.item_id)
      })

      return (data || []).map(
        (tp: any): CalendarRecord => ({
          id: tp.id,
          title: tp.title || 'Equipment',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'item',
          ref: {
            itemId, // Keep backward compatibility
            itemIds: itemMap.get(tp.id) || [], // All items in this period
            jobId: tp.job_id || undefined,
          },
          notes: undefined,
        }),
      )
    },
  })
}

/** Fetch time periods for a specific crew member (category = 'crew') */
export function crewCalendarQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: ['company', companyId, 'crew-calendar', userId] as const,
    queryFn: async () => {
      // First, find all reserved_crew for this user
      const { data: reservations, error: resErr } = await supabase
        .from('reserved_crew')
        .select('time_period_id')
        .eq('user_id', userId)

      if (resErr) throw resErr

      if (!reservations || reservations.length === 0) return []

      const timePeriodIds = reservations.map((r) => r.time_period_id)

      // Then fetch the time_periods
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'crew')
        .in('id', timePeriodIds)
        .eq('deleted', false)
        .order('start_at', { ascending: true })

      if (error) throw error

      return (data || []).map(
        (tp: any): CalendarRecord => ({
          id: tp.id,
          title: tp.title || 'Crew assignment',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'crew',
          ref: {
            userId,
            jobId: tp.job_id || undefined,
          },
          notes: undefined,
        }),
      )
    },
  })
}

/** Fetch time periods for a specific job (category = 'program') */
export function jobCalendarQuery({
  companyId,
  jobId,
}: {
  companyId: string
  jobId: string
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: ['company', companyId, 'job-calendar', jobId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'program')
        .eq('job_id', jobId)
        .eq('deleted', false)
        .order('start_at', { ascending: true })

      if (error) throw error

      return (data || []).map(
        (tp: any): CalendarRecord => ({
          id: tp.id,
          title: tp.title || 'Program',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'job',
          ref: {
            jobId,
          },
          notes: undefined,
        }),
      )
    },
  })
}

/** Fetch all time periods for a company, filtered by category */
export function companyCalendarQuery({
  companyId,
  categories,
  userId,
  companyRole,
}: {
  companyId: string
  categories?: Array<'program' | 'equipment' | 'crew' | 'transport'>
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: [
      'company',
      companyId,
      'calendar',
      categories?.sort().join(',') || 'all',
      userId,
      companyRole,
    ] as const,
    queryFn: async () => {
      let q = supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('deleted', false)

      if (categories && categories.length > 0) {
        q = q.in('category', categories)
      }

      const { data, error } = await q.order('start_at', { ascending: true })

      if (error) throw error

      if (!data || data.length === 0) return []

      // Get unique job IDs for fetching project lead info
      const jobIds = Array.from(
        new Set(data.map((tp) => tp.job_id).filter((id): id is string => !!id)),
      )

      // Fetch job project lead info and titles for all jobs
      const jobProjectLeads = new Map<string, any>()
      const jobTitles = new Map<string, string>()
      const jobStatusMap = new Map<
        string,
        | 'draft'
        | 'planned'
        | 'requested'
        | 'confirmed'
        | 'in_progress'
        | 'completed'
        | 'canceled'
        | 'invoiced'
        | 'paid'
      >()
      if (jobIds.length > 0) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select(
            'id, title, status, project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )',
          )
          .in('id', jobIds)

        if (jobsError) throw jobsError
        ;(jobsData || []).forEach((job: any) => {
          if (job.id) {
            if (job.project_lead) {
              jobProjectLeads.set(job.id, job.project_lead)
            }
            if (job.title) {
              jobTitles.set(job.id, job.title)
            }
            if (job.status) {
              jobStatusMap.set(job.id, job.status)
            }
          }
        })
      }

      // Now fetch related reservations to determine kind and refs
      const timePeriodIds = data.map((tp) => tp.id)

      const [vehiclesRes, itemsRes, crewRes] = await Promise.all([
        supabase
          .from('reserved_vehicles')
          .select('time_period_id, vehicle_id')
          .in('time_period_id', timePeriodIds),
        supabase
          .from('reserved_items')
          .select('time_period_id, item_id')
          .in('time_period_id', timePeriodIds),
        supabase
          .from('reserved_crew')
          .select('time_period_id, user_id, status')
          .in('time_period_id', timePeriodIds),
      ])

      if (vehiclesRes.error) throw vehiclesRes.error
      if (itemsRes.error) throw itemsRes.error
      if (crewRes.error) throw crewRes.error

      // Create lookup maps
      const vehicleMap = new Map<string, string>()
      ;(vehiclesRes.data || []).forEach((v: any) => {
        vehicleMap.set(v.time_period_id, v.vehicle_id)
      })

      // Map time_period_id to array of item_ids (equipment periods can have multiple items)
      const itemMap = new Map<string, Array<string>>()
      ;(itemsRes.data || []).forEach((i: any) => {
        if (!itemMap.has(i.time_period_id)) {
          itemMap.set(i.time_period_id, [])
        }
        itemMap.get(i.time_period_id)!.push(i.item_id)
      })

      // Map time_period_id to set of user_ids and their statuses
      const crewMap = new Map<
        string,
        Array<{ user_id: string; status: string }>
      >()
      ;(crewRes.data || []).forEach((c: any) => {
        if (!crewMap.has(c.time_period_id)) {
          crewMap.set(c.time_period_id, [])
        }
        crewMap.get(c.time_period_id)!.push({
          user_id: c.user_id,
          status: c.status,
        })
      })

      return data
        .map((tp: any): CalendarRecord => {
          // Determine kind based on category and what's reserved
          let kind: CalendarRecord['kind'] = 'job'
          const ref: CalendarRecord['ref'] = {
            jobId: tp.job_id || undefined,
          }

          if (tp.category === 'transport') {
            kind = 'vehicle'
            if (vehicleMap.has(tp.id)) {
              ref.vehicleId = vehicleMap.get(tp.id)!
            }
          } else if (tp.category === 'equipment') {
            kind = 'item'
            if (itemMap.has(tp.id)) {
              const itemIds = itemMap.get(tp.id)!
              ref.itemIds = itemIds
              // Keep backward compatibility with itemId for single-item lookups
              if (itemIds.length > 0) {
                ref.itemId = itemIds[0]
              }
            }
          } else if (tp.category === 'crew') {
            kind = 'crew'
            const crewForPeriod = crewMap.get(tp.id)
            if (crewForPeriod && crewForPeriod.length > 0) {
              ref.userId = crewForPeriod[0].user_id
            }
          } else {
            // For 'program' category, it's a job event
            kind = 'job'
          }

          // Get project lead and job title for job events
          const projectLead = tp.job_id
            ? jobProjectLeads.get(tp.job_id) || null
            : null
          const jobTitle = tp.job_id
            ? jobTitles.get(tp.job_id) || undefined
            : undefined
          const jobStatus = tp.job_id
            ? jobStatusMap.get(tp.job_id) || undefined
            : undefined

          return {
            id: tp.id,
            title: tp.title || 'Event',
            start: tp.start_at,
            end: tp.end_at ?? undefined,
            kind,
            ref,
            notes: undefined,
            projectLead: projectLead || undefined,
            category: tp.category || undefined,
            jobTitle: jobTitle || undefined,
            status: jobStatus || undefined,
          }
        })
        .filter((record) => {
          // For freelancers, filter to only show events they're part of
          if (companyRole === 'freelancer' && userId) {
            const crewForPeriod = crewMap.get(record.id)
            if (!crewForPeriod) return false

            // Find the specific user's crew assignment
            const userCrewAssignment = crewForPeriod.find(
              (c) => c.user_id === userId,
            )
            if (!userCrewAssignment) return false

            // Only show events for crew assignments that are accepted (not planned/requested/declined)
            if (userCrewAssignment.status !== 'accepted') return false

            // Exclude canceled jobs
            if (record.status === 'canceled') return false
          }

          return true
        })
    },
  })
}
