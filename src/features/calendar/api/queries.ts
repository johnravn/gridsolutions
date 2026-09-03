// src/features/calendar/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchAllInChunks } from '@shared/api/inFilterChunks'
import { supabase } from '@shared/api/supabase'
import { crewDisplayName } from '../utils/canFollowCrewUser'
import {
  buildPendingInviteUserIdsByPeriod,
  companyCrewPeriodIsVisible,
  isActiveCrewBooking,
  pendingInviteUserIdsForPeriod,
} from './crewCalendarVisibility'
import {
  buildFreelancerVisibleJobIds,
  isFreelancerVisibleCrewBooking,
} from './freelancerCalendarVisibility'
import { listPersonalCalendarEvents } from './personalCalendarEvents'
import type { CalendarRecord } from '../components/domain'

/** Fetch time periods for a specific vehicle (category = 'transport') */
export function vehicleCalendarQuery({
  companyId,
  vehicleId,
  limit,
  offset = 0,
  fromDate,
  includeInProgress = false,
}: {
  companyId: string
  vehicleId: string
  limit?: number
  offset?: number
  fromDate?: string // ISO date string to filter to future events
  /** When true and fromDate is set, filters by end_at >= fromDate to include in-progress bookings */
  includeInProgress?: boolean
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
      includeInProgress,
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
        // Include in-progress bookings (started before now, not yet ended) when requested
        if (includeInProgress) {
          query = query.gte('end_at', fromDate)
        } else {
          query = query.gte('start_at', fromDate)
        }
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

/** Fetch past vehicle bookings (start_at < toDate), ordered by start_at DESC (most recent first) */
export function vehiclePastCalendarQuery({
  companyId,
  vehicleId,
  toDate,
  limit,
}: {
  companyId: string
  vehicleId: string
  toDate: string // ISO date - only bookings that started before this
  limit?: number
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: [
      'company',
      companyId,
      'vehicle-calendar-past',
      vehicleId,
      toDate,
      limit,
    ] as const,
    queryFn: async () => {
      const { data: reservations, error: resErr } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id')
        .eq('vehicle_id', vehicleId)

      if (resErr) throw resErr
      if (!reservations || reservations.length === 0) return []

      const timePeriodIds = reservations.map((r) => r.time_period_id)

      let query = supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'transport')
        .in('id', timePeriodIds)
        .eq('deleted', false)
        .lt('start_at', toDate)
        .order('start_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) return []

      const jobIds = Array.from(
        new Set(data.map((tp) => tp.job_id).filter((id): id is string => !!id)),
      )
      const jobTitles = new Map<string, string>()
      if (jobIds.length > 0) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title')
          .in('id', jobIds)
        if (jobsError) throw jobsError
        ;(jobsData || []).forEach((job: any) => {
          if (job.id && job.title) jobTitles.set(job.id, job.title)
        })
      }

      return data.map(
        (tp: any): CalendarRecord => ({
          id: tp.id,
          title: tp.title || 'Transport',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'vehicle',
          ref: { vehicleId, jobId: tp.job_id || undefined },
          notes: undefined,
          jobTitle: tp.job_id
            ? jobTitles.get(tp.job_id) || undefined
            : undefined,
        }),
      )
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

      // Fetch job titles for display (user wants job title, not time period name)
      const jobIds = Array.from(
        new Set(data.map((tp) => tp.job_id).filter((id): id is string => !!id)),
      )
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

      // Fetch all items for each time period to populate itemIds array
      const allItemsRes = await fetchAllInChunks(timePeriodIds, (chunk) =>
        supabase
          .from('reserved_items')
          .select('time_period_id, item_id')
          .in('time_period_id', chunk),
      )

      // Create a map of time_period_id to array of item_ids
      const itemMap = new Map<string, Array<string>>()
      allItemsRes.forEach((i: any) => {
        if (!itemMap.has(i.time_period_id)) {
          itemMap.set(i.time_period_id, [])
        }
        itemMap.get(i.time_period_id)!.push(i.item_id)
      })

      return (data || []).map((tp: any): CalendarRecord => {
        const jobTitle = tp.job_id
          ? jobTitles.get(tp.job_id) || undefined
          : undefined
        return {
          id: tp.id,
          title: jobTitle || tp.title || 'Equipment',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'item',
          ref: {
            itemId, // Keep backward compatibility
            itemIds: itemMap.get(tp.id) || [], // All items in this period
            jobId: tp.job_id || undefined,
          },
          notes: undefined,
          jobTitle: jobTitle || undefined,
        }
      })
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
      // Confirmed + planned only — declined/canceled bookings stay off the calendar
      const { data: reservations, error: resErr } = await supabase
        .from('reserved_crew')
        .select('time_period_id, status')
        .eq('user_id', userId)
        .in('status', ['confirmed', 'planned'])

      if (resErr) throw resErr

      if (!reservations || reservations.length === 0) return []

      const timePeriodIds = reservations.map((r) => r.time_period_id)
      const statusByPeriod = new Map(
        reservations.map((r) => [r.time_period_id, r.status as string]),
      )

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

      if (!data || data.length === 0) return []

      const plannedPeriodIds = data
        .map((tp) => tp.id)
        .filter((id) => statusByPeriod.get(id) === 'planned')

      let pendingByPeriod = new Map<string, Set<string>>()
      if (plannedPeriodIds.length > 0) {
        const inviteMatters = await fetchAllInChunks(
          plannedPeriodIds,
          (chunk) =>
            supabase
              .from('matters')
              .select(
                'time_period_id, matter_recipients!inner(user_id, status)',
              )
              .eq('matter_type', 'crew_invite')
              .in('time_period_id', chunk)
              .eq('matter_recipients.user_id', userId),
        )
        pendingByPeriod = buildPendingInviteUserIdsByPeriod(
          inviteMatters as Array<{
            time_period_id: string | null
            matter_recipients?:
              | Array<{ user_id?: string | null; status?: string | null }>
              | { user_id?: string | null; status?: string | null }
              | null
          }>,
        )
      }

      // Fetch job titles for display (user wants job title, not time period name)
      const jobIds = Array.from(
        new Set(data.map((tp) => tp.job_id).filter((id): id is string => !!id)),
      )
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
        const status = statusByPeriod.get(tp.id) || 'planned'
        const pendingInviteUserIds = pendingInviteUserIdsForPeriod(
          [{ user_id: userId, status }],
          tp.id,
          pendingByPeriod,
        )
        return {
          id: tp.id,
          title: jobTitle || tp.title || 'Crew assignment',
          start: tp.start_at,
          end: tp.end_at ?? undefined,
          kind: 'crew',
          ref: {
            userId,
            jobId: tp.job_id || undefined,
          },
          notes: undefined,
          category: 'crew',
          jobTitle: jobTitle || undefined,
          crewUserIds: [userId],
          crewStatusByUserId: { [userId]: status },
          pendingInviteUserIds,
        }
      })
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
  fromDate,
  toDate,
}: {
  companyId: string
  categories?: Array<'program' | 'equipment' | 'crew' | 'transport'>
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
  /** ISO timestamp; defaults to now - 30 days */
  fromDate?: string
  /** ISO timestamp; defaults to now + 90 days */
  toDate?: string
}) {
  return queryOptions<Array<CalendarRecord>>({
    queryKey: [
      'company',
      companyId,
      'calendar',
      categories?.sort().join(',') || 'all',
      userId,
      companyRole,
      fromDate,
      toDate,
    ] as const,
    queryFn: async () => {
      const now = new Date()
      const defaultFrom = new Date(now)
      defaultFrom.setDate(defaultFrom.getDate() - 30)
      const defaultTo = new Date(now)
      defaultTo.setDate(defaultTo.getDate() + 90)
      const fromIso = fromDate ?? defaultFrom.toISOString()
      const toIso = toDate ?? defaultTo.toISOString()

      let q = supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('deleted', false)
        // Bound the dataset to a window to prevent “load entire company history”
        .gte('start_at', fromIso)
        .lte('start_at', toIso)

      if (categories && categories.length > 0) {
        q = q.in('category', categories)
      }

      const { data, error } = await q.order('start_at', { ascending: true })

      if (error) throw error

      const periodRows = data ?? []

      // Get unique job IDs for fetching project lead info
      const jobIds = Array.from(
        new Set(
          periodRows.map((tp) => tp.job_id).filter((id): id is string => !!id),
        ),
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
        const jobsData = await fetchAllInChunks(jobIds, (chunk) =>
          supabase
            .from('jobs')
            .select(
              'id, title, status, project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )',
            )
            .in('id', chunk),
        )
        jobsData.forEach((job: any) => {
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
      const timePeriodIds = periodRows.map((tp) => tp.id)

      // Chunk `.in()` lists — a 120-day calendar window can include hundreds of
      // time periods, and a single GET URI will exceed Kong's ~8KB limit.
      const [vehiclesData, itemsData, crewData] = await Promise.all([
        fetchAllInChunks(timePeriodIds, (chunk) =>
          supabase
            .from('reserved_vehicles')
            .select('time_period_id, vehicle_id')
            .in('time_period_id', chunk),
        ),
        fetchAllInChunks(timePeriodIds, (chunk) =>
          supabase
            .from('reserved_items')
            .select('time_period_id, item_id')
            .in('time_period_id', chunk),
        ),
        fetchAllInChunks(timePeriodIds, (chunk) =>
          supabase
            .from('reserved_crew')
            .select('time_period_id, user_id, status')
            .in('time_period_id', chunk),
        ),
      ])

      // Build job-level crew map (crew on any period for each job)
      const jobCrewMap = new Map<
        string,
        Array<{ user_id: string; status: string }>
      >()
      periodRows.forEach((tp) => {
        if (!tp.job_id) return
        const jobId = tp.job_id
        const crewForPeriod = crewData.filter(
          (c: any) => c.time_period_id === tp.id,
        )
        crewForPeriod.forEach((c: any) => {
          if (!jobCrewMap.has(jobId)) {
            jobCrewMap.set(jobId, [])
          }
          const existing = jobCrewMap.get(jobId)!
          const already = existing.find((x) => x.user_id === c.user_id)
          if (!already) {
            existing.push({ user_id: c.user_id, status: c.status })
          } else if (
            c.status === 'confirmed' &&
            already.status !== 'confirmed'
          ) {
            already.status = 'confirmed'
          }
        })
      })

      // Create lookup maps
      const vehicleMap = new Map<string, string>()
      vehiclesData.forEach((v: any) => {
        vehicleMap.set(v.time_period_id, v.vehicle_id)
      })

      // Map time_period_id to array of item_ids (equipment periods can have multiple items)
      const itemMap = new Map<string, Array<string>>()
      itemsData.forEach((i: any) => {
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
      crewData.forEach((c: any) => {
        if (!crewMap.has(c.time_period_id)) {
          crewMap.set(c.time_period_id, [])
        }
        crewMap.get(c.time_period_id)!.push({
          user_id: c.user_id,
          status: c.status,
        })
      })

      // Freelancer visibility + pending-invite labels (all roles)
      let invitedTimePeriodIds = new Set<string>()
      let freelancerVisibleJobIds = new Set<string>()
      let pendingByPeriod = new Map<string, Set<string>>()

      const plannedPeriodIds = Array.from(
        new Set(
          (
            crewData as Array<{
              time_period_id: string
              status: string
            }>
          )
            .filter((c) => c.status === 'planned')
            .map((c) => c.time_period_id),
        ),
      )

      if (plannedPeriodIds.length > 0) {
        const inviteMatters = await fetchAllInChunks(
          plannedPeriodIds,
          (chunk) =>
            supabase
              .from('matters')
              .select(
                'time_period_id, matter_recipients!inner(user_id, status)',
              )
              .eq('matter_type', 'crew_invite')
              .in('time_period_id', chunk),
        )

        pendingByPeriod = buildPendingInviteUserIdsByPeriod(
          inviteMatters as Array<{
            time_period_id: string | null
            matter_recipients?:
              | Array<{ user_id?: string | null; status?: string | null }>
              | { user_id?: string | null; status?: string | null }
              | null
          }>,
        )
      }

      if (companyRole === 'freelancer' && userId) {
        // Any crew_invite (including answered) still gates planned visibility
        // for freelancers; canceled bookings are excluded separately.
        const crewTimePeriodIds = periodRows
          .filter((tp) => tp.category === 'crew')
          .map((tp) => tp.id)

        if (crewTimePeriodIds.length > 0) {
          const inviteMatters = await fetchAllInChunks(
            crewTimePeriodIds,
            (chunk) =>
              supabase
                .from('matters')
                .select('time_period_id, matter_recipients!inner(user_id)')
                .eq('matter_type', 'crew_invite')
                .in('time_period_id', chunk)
                .eq('matter_recipients.user_id', userId),
          )

          invitedTimePeriodIds = new Set(
            (
              inviteMatters as unknown as Array<{
                time_period_id: string | null
              }>
            )
              .map((m) => m.time_period_id)
              .filter((id): id is string => !!id),
          )
        }

        const timePeriodJobById = new Map<string, string>()
        periodRows.forEach((tp) => {
          if (tp.job_id) timePeriodJobById.set(tp.id, tp.job_id)
        })

        freelancerVisibleJobIds = buildFreelancerVisibleJobIds({
          crewRows: crewData as Array<{
            time_period_id: string
            user_id: string
            status: string
          }>,
          timePeriodJobById,
          invitedTimePeriodIds,
          userId,
        })
      }

      // Pending invite users aggregated per job (for job-duration events)
      const jobPendingInviteUserIds = new Map<string, Set<string>>()
      periodRows.forEach((tp) => {
        if (!tp.job_id || tp.category !== 'crew') return
        const pendingUsers = pendingInviteUserIdsForPeriod(
          crewMap.get(tp.id) || [],
          tp.id,
          pendingByPeriod,
        )
        if (pendingUsers.length === 0) return
        let set = jobPendingInviteUserIds.get(tp.job_id)
        if (!set) {
          set = new Set<string>()
          jobPendingInviteUserIds.set(tp.job_id, set)
        }
        for (const id of pendingUsers) {
          set.add(id)
        }
      })

      const records = periodRows
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
            const activeCrew = (crewForPeriod || []).filter((c) =>
              isActiveCrewBooking(c.status),
            )
            if (activeCrew.length > 0) {
              ref.userId = activeCrew[0].user_id
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

          const crewForPeriod = crewMap.get(tp.id) || []
          const activeCrewForPeriod = crewForPeriod.filter((c) =>
            isActiveCrewBooking(c.status),
          )
          const crewUserIds = activeCrewForPeriod.map((c) => c.user_id)
          const crewStatusByUserId = Object.fromEntries(
            crewForPeriod.map((c) => [c.user_id, c.status]),
          )

          const jobCrew = tp.job_id ? jobCrewMap.get(tp.job_id) || [] : []
          const activeJobCrew = jobCrew.filter((c) =>
            isActiveCrewBooking(c.status),
          )
          const jobCrewUserIds = activeJobCrew.map((c) => c.user_id)
          const jobCrewStatusByUserId = Object.fromEntries(
            jobCrew.map((c) => [c.user_id, c.status]),
          )

          const pendingInviteUserIds =
            tp.category === 'crew'
              ? pendingInviteUserIdsForPeriod(
                  crewForPeriod,
                  tp.id,
                  pendingByPeriod,
                )
              : tp.category === 'program' && tp.job_id
                ? Array.from(jobPendingInviteUserIds.get(tp.job_id) ?? [])
                : []

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
            crewUserIds,
            crewStatusByUserId,
            jobCrewUserIds,
            jobCrewStatusByUserId,
            pendingInviteUserIds,
          }
        })
        .filter((record) => {
          // Hide crew periods where every booking was declined/canceled
          if (record.category === 'crew') {
            const crewForPeriod = crewMap.get(record.id) || []
            if (!companyCrewPeriodIsVisible(crewForPeriod)) return false
          }

          // For freelancers, filter to only show events they're part of
          if (companyRole === 'freelancer' && userId) {
            // Exclude canceled jobs
            if (record.status === 'canceled') return false

            // Never show equipment/transport on the calendar (even if RLS allows job access)
            if (
              record.category === 'equipment' ||
              record.category === 'transport'
            ) {
              return false
            }

            // Crew shift: user must have a visible booking on this period
            if (record.category === 'crew') {
              const crewForPeriod = crewMap.get(record.id)
              const userCrewAssignment = crewForPeriod?.find(
                (c) => c.user_id === userId,
              )
              if (!userCrewAssignment) return false
              return isFreelancerVisibleCrewBooking(
                userCrewAssignment.status,
                record.id,
                invitedTimePeriodIds,
              )
            }

            // Job duration: show when user is crew on the job
            if (record.category === 'program' && record.ref?.jobId) {
              return freelancerVisibleJobIds.has(record.ref.jobId)
            }

            return false
          }

          return true
        })

      const personalRows = await listPersonalCalendarEvents({
        companyId,
        fromIso,
        toIso,
        userId:
          companyRole === 'freelancer' ? (userId ?? undefined) : undefined,
      })

      const personalUserIds = Array.from(
        new Set(personalRows.map((pe) => pe.user_id)),
      )
      const personalNameByUserId = new Map<string, string>()
      if (personalUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name, email')
          .in('user_id', personalUserIds)
        for (const p of profiles ?? []) {
          personalNameByUserId.set(p.user_id, crewDisplayName(p))
        }
      }

      const personalRecords: Array<CalendarRecord> = personalRows.map((pe) => {
        const name = personalNameByUserId.get(pe.user_id) ?? 'Crew'
        return {
          id: pe.id,
          title: `${name}: ${pe.title}`,
          start: pe.start_at,
          end: pe.end_at,
          kind: 'personal',
          ref: { userId: pe.user_id },
          category: 'personal',
          notes: pe.title,
          crewUserIds: [pe.user_id],
        }
      })

      return [...records, ...personalRecords]
    },
  })
}
