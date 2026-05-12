/**
 * Calendar feed endpoint: returns iCalendar (ICS) for subscribed time_periods.
 * GET /api/calendar/feed?token=<secret>
 * Uses premade subscription kinds; builds rich event titles (job title, project lead, customer, location).
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/shared/types/database.types'

type SubscriptionKind =
  | 'all_jobs'
  | 'project_lead_jobs'
  | 'crew_jobs'
  | 'transport_vehicle'
  | 'transport_all'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function icsEscape(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  const max = 75
  if (line.length <= max) return line
  const parts: Array<string> = []
  let rest = line
  while (rest.length > 0) {
    parts.push(rest.slice(0, max))
    rest = rest.slice(max)
    if (rest.length > 0) rest = '\r\n ' + rest
  }
  return parts.join('\r\n ')
}

function formatICalDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function parseTstzRange(
  during: unknown,
): { start: string; end: string } | null {
  if (typeof during !== 'string') return null
  const s = during.trim()
  if (!s) return null

  // Common Postgres range output: "[2026-05-11 10:00:00+00,2026-05-11 18:00:00+00)"
  // Sometimes it can contain quotes depending on driver; strip them gently.
  const m = s.match(/^[\[(]\s*"?([^,"]+)"?\s*,\s*"?([^)\]"]+)"?\s*[\])]\s*$/)
  if (!m) return null

  const startRaw = m[1].trim()
  const endRaw = m[2].trim()
  if (!startRaw || !endRaw) return null
  if (
    endRaw.toLowerCase() === 'infinity' ||
    startRaw.toLowerCase() === '-infinity'
  )
    return null

  const start = new Date(startRaw)
  const end = new Date(endRaw)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start: start.toISOString(), end: end.toISOString() }
}

function rangesOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string,
): boolean {
  const aStart = new Date(aStartIso).getTime()
  const aEnd = new Date(aEndIso).getTime()
  const bStart = new Date(bStartIso).getTime()
  const bEnd = new Date(bEndIso).getTime()
  if ([aStart, aEnd, bStart, bEnd].some((t) => Number.isNaN(t))) return false
  // [start, end) overlap
  return aStart < bEnd && bStart < aEnd
}

function buildICS(
  events: Array<{
    id: string
    title: string
    start: string
    end: string
    description?: string
  }>,
): string {
  const lines: Array<string> = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grid//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const e of events) {
    const summary = foldLine('SUMMARY:' + icsEscape(e.title))
    const desc = e.description
      ? foldLine('DESCRIPTION:' + icsEscape(e.description))
      : null
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + e.id + '@grid-calendar',
      'DTSTAMP:' + formatICalDate(new Date().toISOString()),
      'DTSTART:' + formatICalDate(e.start),
      'DTEND:' + formatICalDate(e.end),
      summary,
      ...(desc ? [desc] : []),
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function formatLocation(
  addr: {
    address_line: string
    city: string
    zip_code: string
    country: string
  } | null,
): string {
  if (!addr) return ''
  const parts = [
    addr.address_line,
    addr.city,
    addr.zip_code,
    addr.country,
  ].filter(Boolean)
  return parts.join(', ')
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    return res.end()
  }

  if (req.method !== 'GET') {
    res.statusCode = 405
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }

  const token =
    typeof req.query?.token === 'string' && req.query.token.length > 0
      ? req.query.token.trim()
      : null

  if (!token) {
    res.statusCode = 400
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Missing token' }))
  }

  const supabaseUrl =
    (process.env.VITE_SUPABASE_URL as string) ||
    (process.env.SUPABASE_URL as string)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Server configuration error' }))
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const { data: sub, error: subErr } = await supabase
      .from('calendar_subscriptions')
      .select('company_id, user_id, kind, vehicle_id')
      .eq('token', token)
      .single()

    if (subErr || !sub) {
      res.statusCode = 404
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({ error: 'Invalid or expired calendar link' }),
      )
    }

    const kind = (sub.kind as SubscriptionKind) || 'all_jobs'
    const companyId = sub.company_id
    const userId = sub.user_id
    const vehicleId = sub.vehicle_id ?? null

    // Freelancers may only use crew_jobs subscription
    const { data: cu } = await supabase
      .from('company_users')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .maybeSingle()
    if (cu?.role === 'freelancer' && kind !== 'crew_jobs') {
      res.statusCode = 403
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({ error: 'Invalid or expired calendar link' }),
      )
    }

    const now = new Date()
    const fromDate = new Date(now)
    fromDate.setMonth(fromDate.getMonth() - 3)
    const toDate = new Date(now)
    toDate.setFullYear(toDate.getFullYear() + 1)
    const fromIso = fromDate.toISOString()
    const toIso = toDate.toISOString()

    if (kind === 'transport_vehicle' || kind === 'transport_all') {
      // Transport: time_periods with category = transport
      const q = supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'transport')
        .eq('deleted', false)
        .gte('start_at', fromIso)
        .lte('start_at', toIso)
        .order('start_at', { ascending: true })

      const { data: periods, error: periodsErr } = await q
      if (periodsErr) {
        res.statusCode = 500
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'Failed to load calendar' }))
      }

      let periodList = periods || []
      if (kind === 'transport_vehicle' && vehicleId) {
        const { data: rv } = await supabase
          .from('reserved_vehicles')
          .select('time_period_id')
          .eq('vehicle_id', vehicleId)
          .in(
            'time_period_id',
            periodList.map((p: { id: string }) => p.id),
          )
        const allowedIds = new Set(
          (rv || []).map((r: { time_period_id: string }) => r.time_period_id),
        )
        periodList = periodList.filter((p: { id: string }) =>
          allowedIds.has(p.id),
        )
      }

      periodList = await filterNonArchivedJobPeriods(supabase, periodList)

      const periodIds = periodList.map((p: { id: string }) => p.id)
      const jobIds = Array.from(
        new Set(
          periodList
            .map((p: { job_id: string | null }) => p.job_id)
            .filter(Boolean),
        ),
      ) as Array<string>

      const { data: rvData } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id, vehicle_id')
        .in('time_period_id', periodIds)

      const periodToVehicle = new Map<string, string>()
      ;(rvData || []).forEach(
        (r: { time_period_id: string; vehicle_id: string }) => {
          periodToVehicle.set(r.time_period_id, r.vehicle_id)
        },
      )

      const vehicleIds = Array.from(new Set(periodToVehicle.values()))
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id, name, registration_no')
        .in('id', vehicleIds)
      const vehicleMap = new Map<
        string,
        { name: string; registration_no: string | null }
      >()
      ;(vehiclesData || []).forEach(
        (v: { id: string; name: string; registration_no: string | null }) => {
          vehicleMap.set(v.id, {
            name: v.name,
            registration_no: v.registration_no,
          })
        },
      )

      const jobInfo = await fetchJobInfo(supabase, companyId, jobIds)
      if (kind === 'transport_all') {
        // One event per (period, vehicle) so each event title starts with vehicle name and reg
        const events: Array<{
          id: string
          title: string
          start: string
          end: string
          description?: string
        }> = []
        for (const p of periodList) {
          const info = p.job_id ? jobInfo.get(p.job_id) : null
          const jobTitle = info?.title ?? p.title ?? 'Transport'
          const customer = info?.customerName ?? ''
          const projectLead = info?.projectLeadName ?? ''
          const parts = [jobTitle, customer, projectLead].filter(Boolean)
          const rest = parts.join(' · ')
          const vehicleIdsForPeriod = (rvData || [])
            .filter(
              (r: { time_period_id: string }) => r.time_period_id === p.id,
            )
            .map((r: { vehicle_id: string }) => r.vehicle_id)
          for (const vid of vehicleIdsForPeriod) {
            const vehicle = vehicleMap.get(vid)
            const vehicleLabel = vehicle
              ? `${vehicle.name}${vehicle.registration_no ? ` (${vehicle.registration_no})` : ''}`
              : 'Transport'
            const title = `${vehicleLabel}: ${rest}`.trim() || 'Transport'
            const jobNo = info ? formatJobNumber(info.jobnr) : ''
            const descParts = [
              jobNo && `Job no: ${jobNo}`,
              p.job_id && `Job ID: ${p.job_id}`,
            ].filter(Boolean)
            events.push({
              id: `${p.id}-${vid}`,
              title,
              start: p.start_at,
              end: p.end_at,
              description:
                descParts.length > 0 ? descParts.join('\n') : undefined,
            })
          }
        }
        const ics = buildICS(events)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"')
        res.setHeader('Cache-Control', 'private, max-age=300')
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.end(ics)
      }

      const events = periodList.map(
        (p: {
          id: string
          title: string | null
          start_at: string
          end_at: string
          job_id: string | null
        }) => {
          const info = p.job_id ? jobInfo.get(p.job_id) : null
          const jobTitle = info?.title ?? p.title ?? 'Transport'
          const customer = info?.customerName ?? ''
          const projectLead = info?.projectLeadName ?? ''
          const vehicle = periodToVehicle.get(p.id)
            ? vehicleMap.get(periodToVehicle.get(p.id)!)
            : null
          const vehicleLabel = vehicle
            ? `${vehicle.name}${vehicle.registration_no ? ` (${vehicle.registration_no})` : ''}`
            : ''
          const parts = [jobTitle, customer, projectLead].filter(Boolean)
          const rest = parts.join(' · ')
          const title = vehicleLabel
            ? `${vehicleLabel}: ${rest}`
            : rest || 'Transport'
          const jobNo = info ? formatJobNumber(info.jobnr) : ''
          const descParts = [
            jobNo && `Job no: ${jobNo}`,
            p.job_id && `Job ID: ${p.job_id}`,
          ].filter(Boolean)
          return {
            id: p.id,
            title,
            start: p.start_at,
            end: p.end_at,
            description:
              descParts.length > 0 ? descParts.join('\n') : undefined,
          }
        },
      )

      const ics = buildICS(events)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"')
      res.setHeader('Cache-Control', 'private, max-age=300')
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      return res.end(ics)
    }

    // Job-based kinds: program (all_jobs, project_lead_jobs); crew_jobs uses crew time_periods
    if (kind === 'crew_jobs') {
      // Crew calendar: emit events per *reserved_crew row* and use reserved_crew.during
      // (the actual booking window for that person). Fall back to time_periods start/end.
      const { data: crewRes, error: crewResErr } = await supabase
        .from('reserved_crew')
        .select('id, time_period_id, during, status')
        .eq('user_id', userId)
        .neq('status', 'canceled')

      if (crewResErr) {
        res.statusCode = 500
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'Failed to load calendar' }))
      }

      const crewRows = (crewRes ?? []) as Array<{
        id: string
        time_period_id: string
        during: unknown
        status: string
      }>

      const crewPeriodIds = Array.from(
        new Set(crewRows.map((r) => r.time_period_id)),
      )
      if (crewPeriodIds.length === 0) {
        const ics = buildICS([])
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"')
        res.setHeader('Cache-Control', 'private, max-age=300')
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.end(ics)
      }

      const { data: crewPeriods, error: crewErr } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, job_id, category')
        .eq('company_id', companyId)
        .eq('category', 'crew')
        .in('id', crewPeriodIds)
        .eq('deleted', false)
        .order('start_at', { ascending: true })

      if (crewErr) {
        res.statusCode = 500
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'Failed to load calendar' }))
      }

      // Filter by subscription window using the most accurate time range we have:
      // reserved_crew.during when present; else time_periods.start/end.
      const periodById = new Map<
        string,
        {
          id: string
          title: string | null
          start_at: string
          end_at: string
          job_id: string | null
        }
      >()
      ;(crewPeriods || []).forEach((p: any) => {
        if (p?.id) {
          periodById.set(p.id, {
            id: p.id,
            title: p.title ?? null,
            start_at: p.start_at,
            end_at: p.end_at,
            job_id: p.job_id ?? null,
          })
        }
      })

      let crewRowsWithPeriods = crewRows
        .map((r) => ({
          row: r,
          period: periodById.get(r.time_period_id) ?? null,
        }))
        .filter((x) => !!x.period)

      crewRowsWithPeriods = crewRowsWithPeriods.filter(({ row, period }) => {
        const parsed = parseTstzRange(row.during)
        const startIso = parsed?.start ?? period!.start_at
        const endIso = parsed?.end ?? period!.end_at
        return rangesOverlap(startIso, endIso, fromIso, toIso)
      })

      // We still want to exclude archived jobs (if a crew period points at an archived job)
      const periodListForArchiveFilter = crewRowsWithPeriods.map(
        (x) => x.period!,
      ) as Array<{
        job_id: string | null
      }>
      const allowedPeriods = await filterNonArchivedJobPeriods(
        supabase,
        periodListForArchiveFilter,
      )
      const allowedPeriodIds = new Set(
        (allowedPeriods as Array<any>).map((p) => p.id).filter(Boolean),
      )
      crewRowsWithPeriods = crewRowsWithPeriods.filter((x) =>
        allowedPeriodIds.has(x.period!.id),
      )

      const jobIds = Array.from(
        new Set(
          crewRowsWithPeriods.map((x) => x.period!.job_id).filter(Boolean),
        ),
      ) as Array<string>
      const jobInfo = await fetchJobInfo(supabase, companyId, jobIds)

      const events = crewRowsWithPeriods.map(({ row, period }) => {
        const p = period!
        const info = p.job_id ? jobInfo.get(p.job_id) : null
        const jobTitle = info?.title ?? p.title ?? 'Crew assignment'
        const jobNo = info ? formatJobNumber(info.jobnr) : ''
        const descParts: Array<string> = []
        if (jobNo) descParts.push(`Job no: ${jobNo}`)
        if (info?.projectLeadName)
          descParts.push(`Project lead: ${info.projectLeadName}`)
        if (p.job_id) descParts.push(`Job ID: ${p.job_id}`)

        const parsed = parseTstzRange(row.during)
        const start = parsed?.start ?? p.start_at
        const end = parsed?.end ?? p.end_at

        return {
          id: row.id, // unique per booking row (can be multiple crew on same period)
          title: 'CREW: ' + (jobTitle || 'Event'),
          start,
          end,
          description: descParts.length > 0 ? descParts.join('\n') : undefined,
        }
      })

      const ics = buildICS(events)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"')
      res.setHeader('Cache-Control', 'private, max-age=300')
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      return res.end(ics)
    }

    // all_jobs / project_lead_jobs: use program time_periods (job duration)
    const q = supabase
      .from('time_periods')
      .select('id, title, start_at, end_at, job_id, category')
      .eq('company_id', companyId)
      .eq('category', 'program')
      .eq('deleted', false)
      .gte('start_at', fromIso)
      .lte('start_at', toIso)
      .order('start_at', { ascending: true })

    const { data: periods, error: periodsErr } = await q
    if (periodsErr) {
      res.statusCode = 500
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'Failed to load calendar' }))
    }

    let periodList = periods || []

    if (kind === 'project_lead_jobs') {
      const { data: jobIdsData } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', companyId)
        .eq('project_lead_user_id', userId)
      const leadJobIds = new Set(
        (jobIdsData || []).map((j: { id: string }) => j.id),
      )
      periodList = periodList.filter(
        (p: { job_id: string | null }) => p.job_id && leadJobIds.has(p.job_id),
      )
    }

    periodList = await filterNonArchivedJobPeriods(supabase, periodList)

    const jobIds = Array.from(
      new Set(
        periodList
          .map((p: { job_id: string | null }) => p.job_id)
          .filter(Boolean),
      ),
    ) as Array<string>
    const jobInfo = await fetchJobInfo(supabase, companyId, jobIds)

    const prefix =
      kind === 'all_jobs'
        ? 'JOB: '
        : kind === 'project_lead_jobs'
          ? 'PROJECT LEAD: '
          : kind === 'crew_jobs'
            ? 'CREW: '
            : ''

    const events = periodList.map(
      (p: {
        id: string
        title: string | null
        start_at: string
        end_at: string
        job_id: string | null
      }) => {
        const info = p.job_id ? jobInfo.get(p.job_id) : null
        const jobTitle = info?.title ?? p.title ?? 'Job'
        const jobNo = info ? formatJobNumber(info.jobnr) : ''
        const statusLabel = info ? formatJobStatus(info.status) : ''

        if (kind === 'all_jobs') {
          const title = prefix + jobTitle
          const descLines: Array<string> = []
          if (jobNo) descLines.push(`Job no: ${jobNo}`)
          if (statusLabel) descLines.push(`Status: ${statusLabel}`)
          if (info?.projectLeadName)
            descLines.push(`Project lead: ${info.projectLeadName}`)
          if (info?.customerName)
            descLines.push(`Customer: ${info.customerName}`)
          if (info?.location) descLines.push(`Location: ${info.location}`)
          if (p.job_id) descLines.push(`Job ID: ${p.job_id}`)
          return {
            id: p.id,
            title: title || 'Event',
            start: p.start_at,
            end: p.end_at,
            description:
              descLines.length > 0 ? descLines.join('\n') : undefined,
          }
        }

        const title = prefix + jobTitle
        const descParts: Array<string> = []
        if (jobNo) descParts.push(`Job no: ${jobNo}`)
        if (info?.projectLeadName)
          descParts.push(`Project lead: ${info.projectLeadName}`)
        if (p.job_id) descParts.push(`Job ID: ${p.job_id}`)
        return {
          id: p.id,
          title: title || 'Event',
          start: p.start_at,
          end: p.end_at,
          description: descParts.length > 0 ? descParts.join('\n') : undefined,
        }
      },
    )

    const ics = buildICS(events)
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"')
    res.setHeader('Cache-Control', 'private, max-age=300')
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end(ics)
  } catch (e: any) {
    res.statusCode = 500
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'Failed to generate calendar',
        message: e?.message || String(e),
      }),
    )
  }
}

function formatJobNumber(jobnr: number | null | undefined): string {
  if (jobnr == null) return ''
  return '#' + String(jobnr).padStart(6, '0')
}

function formatJobStatus(status: string | null | undefined): string {
  if (!status) return ''
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type JobInfo = {
  title: string
  projectLeadName: string
  customerName: string
  location: string
  jobnr: number | null
  status: string
}

async function fetchJobInfo(
  supabase: ReturnType<typeof createClient<Database>>,
  companyId: string,
  jobIds: Array<string>,
): Promise<Map<string, JobInfo>> {
  const out = new Map<string, JobInfo>()
  if (jobIds.length === 0) return out

  const { data: jobs } = await supabase
    .from('jobs')
    .select(
      'id, title, project_lead_user_id, customer_id, job_address_id, jobnr, status',
    )
    .in('id', jobIds)

  if (!jobs || jobs.length === 0) return out

  const leadUserIds = Array.from(
    new Set(
      jobs
        .map(
          (j: { project_lead_user_id: string | null }) =>
            j.project_lead_user_id,
        )
        .filter(Boolean),
    ),
  ) as Array<string>
  const customerIds = Array.from(
    new Set(
      jobs
        .map((j: { customer_id: string | null }) => j.customer_id)
        .filter(Boolean),
    ),
  ) as Array<string>
  const addressIds = Array.from(
    new Set(
      jobs
        .map((j: { job_address_id: string | null }) => j.job_address_id)
        .filter(Boolean),
    ),
  ) as Array<string>

  const [profilesRes, customersRes, addressesRes] = await Promise.all([
    leadUserIds.length > 0
      ? supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', leadUserIds)
      : Promise.resolve({ data: [] }),
    customerIds.length > 0
      ? supabase.from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
    addressIds.length > 0
      ? supabase
          .from('addresses')
          .select('id, address_line, city, zip_code, country')
          .in('id', addressIds)
      : Promise.resolve({ data: [] }),
  ])

  const leadNames = new Map<string, string>()
  ;(profilesRes.data || []).forEach(
    (p: { user_id: string; display_name: string | null }) => {
      leadNames.set(p.user_id, p.display_name || '')
    },
  )
  const customerNames = new Map<string, string>()
  ;(customersRes.data || []).forEach((c: { id: string; name: string }) => {
    customerNames.set(c.id, c.name)
  })
  const addressMap = new Map<string, string>()
  ;(addressesRes.data || []).forEach(
    (a: {
      id: string
      address_line: string
      city: string
      zip_code: string
      country: string
    }) => {
      addressMap.set(a.id, formatLocation(a))
    },
  )

  jobs.forEach(
    (j: {
      id: string
      title: string
      project_lead_user_id: string | null
      customer_id: string | null
      job_address_id: string | null
      jobnr: number | null
      status: string
    }) => {
      out.set(j.id, {
        title: j.title || 'Job',
        projectLeadName: j.project_lead_user_id
          ? (leadNames.get(j.project_lead_user_id) ?? '')
          : '',
        customerName: j.customer_id
          ? (customerNames.get(j.customer_id) ?? '')
          : '',
        location: j.job_address_id
          ? (addressMap.get(j.job_address_id) ?? '')
          : '',
        jobnr: j.jobnr ?? null,
        status: j.status || '',
      })
    },
  )
  return out
}

/** Filter periodList to only include periods whose job is not archived (or has no job). */
async function filterNonArchivedJobPeriods<T extends { job_id: string | null }>(
  supabase: ReturnType<typeof createClient<Database>>,
  periodList: Array<T>,
): Promise<Array<T>> {
  const jobIds = Array.from(
    new Set(periodList.map((p) => p.job_id).filter(Boolean)),
  ) as Array<string>
  if (jobIds.length === 0) return periodList
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .in('id', jobIds)
    .eq('archived', false)
  const allowedIds = new Set((jobs || []).map((j: { id: string }) => j.id))
  return periodList.filter((p) => !p.job_id || allowedIds.has(p.job_id))
}
