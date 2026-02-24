// Calendar subscription: preferences and feed URL for phone/external calendars
import { supabase } from '@shared/api/supabase'

export type CalendarSubscriptionCategory =
  | 'program'
  | 'equipment'
  | 'crew'
  | 'transport'

export type CalendarSubscriptionRow = {
  id: string
  company_id: string
  user_id: string
  token: string
  categories: string[]
  only_my_assignments: boolean
  include_project_lead_jobs: boolean
  vehicle_ids: string[] | null
  created_at: string
  updated_at: string
}

export type CalendarSubscriptionInsert = {
  company_id: string
  user_id: string
  token: string
  categories: string[]
  only_my_assignments: boolean
  include_project_lead_jobs?: boolean
  vehicle_ids?: string[] | null
}

export type CalendarSubscriptionPreferences = {
  categories: CalendarSubscriptionCategory[]
  onlyMyAssignments: boolean
  includeProjectLeadJobs: boolean
  vehicleIds: string[] | null
}

const DEFAULT_CATEGORIES: CalendarSubscriptionCategory[] = ['program']

function randomToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Get subscription for current user and company, if any */
export async function getCalendarSubscription(
  companyId: string,
  userId: string,
): Promise<CalendarSubscriptionRow | null> {
  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .select('id, company_id, user_id, token, categories, only_my_assignments, include_project_lead_jobs, vehicle_ids, created_at, updated_at')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as CalendarSubscriptionRow | null
}

/** Upsert subscription: create or update preferences; returns row with token */
export async function upsertCalendarSubscription(
  companyId: string,
  userId: string,
  preferences: CalendarSubscriptionPreferences,
): Promise<CalendarSubscriptionRow> {
  const existing = await getCalendarSubscription(companyId, userId)
  const token = existing?.token ?? randomToken()
  const categories = preferences.categories.length > 0 ? preferences.categories : DEFAULT_CATEGORIES

  const row: CalendarSubscriptionInsert = {
    company_id: companyId,
    user_id: userId,
    token,
    categories: [...categories],
    only_my_assignments: preferences.onlyMyAssignments,
    include_project_lead_jobs: preferences.includeProjectLeadJobs,
    vehicle_ids: preferences.vehicleIds?.length ? preferences.vehicleIds : null,
  }

  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .upsert(row, { onConflict: 'company_id,user_id' })
    .select('id, company_id, user_id, token, categories, only_my_assignments, include_project_lead_jobs, vehicle_ids, created_at, updated_at')
    .single()

  if (error) throw error
  return data as CalendarSubscriptionRow
}

/** Public app URL used for calendar feed link (set in env so link works on phone when dev runs on localhost) */
const PUBLIC_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_PUBLIC_URL as string) ||
  ''

/** Build the feed URL for a given token. Uses VITE_APP_PUBLIC_URL when set (e.g. production URL), otherwise current origin. */
export function getCalendarFeedUrl(token: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    (PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : ''))
  return `${base.replace(/\/$/, '')}/api/calendar/feed?token=${encodeURIComponent(token)}`
}

/** Build webcal URL for one-click add on some clients */
export function getCalendarWebcalUrl(token: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    (PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : ''))
  const https = base.replace(/^http:\/\//, 'https://').replace(/\/$/, '')
  return `webcal://${https.replace(/^https:\/\//, '')}/api/calendar/feed?token=${encodeURIComponent(token)}`
}
