/**
 * Calendar feed endpoint: returns iCalendar (ICS) for subscribed time_periods.
 * GET /api/calendar/feed?token=<secret>
 * Uses SUPABASE_SERVICE_ROLE_KEY server-side to resolve token and fetch events.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/shared/types/database.types'

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
  const parts: string[] = []
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

function buildICS(events: Array<{ id: string; title: string; start: string; end: string; description?: string }>): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grid//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const e of events) {
    const summary = foldLine('SUMMARY:' + icsEscape(e.title))
    const desc = e.description ? foldLine('DESCRIPTION:' + icsEscape(e.description)) : null
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
    (process.env.VITE_SUPABASE_URL as string) || (process.env.SUPABASE_URL as string)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Server configuration error' }))
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  try {
    const { data: sub, error: subErr } = await supabase
      .from('calendar_subscriptions')
      .select('company_id, user_id, categories, only_my_assignments, include_project_lead_jobs, vehicle_ids')
      .eq('token', token)
      .single()

    if (subErr || !sub) {
      res.statusCode = 404
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'Invalid or expired calendar link' }))
    }

    const categories: string[] = Array.isArray(sub.categories) && sub.categories.length > 0 ? sub.categories : ['program']
    const onlyMyAssignments = !!sub.only_my_assignments
    const includeProjectLeadJobs = !!sub.include_project_lead_jobs
    const vehicleIds: string[] | null = Array.isArray(sub.vehicle_ids) && sub.vehicle_ids.length > 0 ? sub.vehicle_ids : null
    const companyId = sub.company_id
    const userId = sub.user_id

    const now = new Date()
    const fromDate = new Date(now)
    fromDate.setMonth(fromDate.getMonth() - 3)
    const toDate = new Date(now)
    toDate.setFullYear(toDate.getFullYear() + 1)
    const fromIso = fromDate.toISOString()
    const toIso = toDate.toISOString()

    let q = supabase
      .from('time_periods')
      .select('id, title, start_at, end_at, job_id, category')
      .eq('company_id', companyId)
      .eq('deleted', false)
      .gte('start_at', fromIso)
      .lte('start_at', toIso)
      .order('start_at', { ascending: true })

    if (categories.length > 0) {
      q = q.in('category', categories)
    }

    const { data: periods, error: periodsErr } = await q

    if (periodsErr) {
      res.statusCode = 500
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'Failed to load calendar' }))
    }

    let periodIds = (periods || []).map((p) => p.id)

    if (includeProjectLeadJobs && categories.includes('program')) {
      const { data: jobIds } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', companyId)
        .eq('project_lead_user_id', userId)
      const projectLeadJobIds = new Set((jobIds || []).map((j: { id: string }) => j.id))
      periodIds = (periods || []).filter((p) => p.category !== 'program' || (p.job_id && projectLeadJobIds.has(p.job_id))).map((p) => p.id)
    }

    if (vehicleIds && vehicleIds.length > 0 && categories.includes('transport')) {
      const { data: rv } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id')
        .in('vehicle_id', vehicleIds)
        .in('time_period_id', periodIds)
      const transportPeriodIds = new Set((rv || []).map((r: { time_period_id: string }) => r.time_period_id))
      periodIds = (periods || []).filter((p) => p.category !== 'transport' || transportPeriodIds.has(p.id)).map((p) => p.id)
    }

    if (onlyMyAssignments && categories.includes('crew') && periodIds.length > 0) {
      const { data: crewRes } = await supabase
        .from('reserved_crew')
        .select('time_period_id')
        .eq('user_id', userId)
        .in('time_period_id', periodIds)
      const myCrewPeriodIds = new Set((crewRes || []).map((r: { time_period_id: string }) => r.time_period_id))
      periodIds = (periods || []).filter((p) => p.category !== 'crew' || myCrewPeriodIds.has(p.id)).map((p) => p.id)
    }

    const filtered = (periods || []).filter((p) => periodIds.includes(p.id))

    const events = filtered.map((p) => ({
      id: p.id,
      title: p.title || 'Event',
      start: p.start_at,
      end: p.end_at,
      description: p.job_id ? `Job ID: ${p.job_id}` : undefined,
    }))

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
    res.end(JSON.stringify({ error: 'Failed to generate calendar', message: e?.message || String(e) }))
  }
}
