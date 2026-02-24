// Calendar subscription: premade kinds and feed URL for phone/external calendars
import { supabase } from '@shared/api/supabase'

export type CalendarSubscriptionKind =
  | 'all_jobs'
  | 'project_lead_jobs'
  | 'crew_jobs'
  | 'transport_vehicle'
  | 'transport_all'

export type CalendarSubscriptionRow = {
  id: string
  company_id: string
  user_id: string
  token: string
  kind: CalendarSubscriptionKind
  vehicle_id: string | null
  created_at: string
  updated_at: string
}

export type CalendarSubscriptionInsert = {
  company_id: string
  user_id: string
  token: string
  kind: CalendarSubscriptionKind
  vehicle_id?: string | null
}

const SELECT_COLS =
  'id, company_id, user_id, token, kind, vehicle_id, created_at, updated_at'

function randomToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const MAX_SUBSCRIPTIONS_PER_USER = 3

/** List all calendar subscriptions for the current user in the company */
export async function getCalendarSubscriptions(
  companyId: string,
  userId: string,
): Promise<CalendarSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .select(SELECT_COLS)
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as CalendarSubscriptionRow[]
}

/** Create a new calendar subscription. Fails if user already has 3. */
export async function createCalendarSubscription(
  companyId: string,
  userId: string,
  params: { kind: CalendarSubscriptionKind; vehicleId?: string | null },
): Promise<CalendarSubscriptionRow> {
  const existing = await getCalendarSubscriptions(companyId, userId)
  if (existing.length >= MAX_SUBSCRIPTIONS_PER_USER) {
    throw new Error(`You can have at most ${MAX_SUBSCRIPTIONS_PER_USER} calendar subscriptions. Remove one to add another.`)
  }

  const row: CalendarSubscriptionInsert = {
    company_id: companyId,
    user_id: userId,
    token: randomToken(),
    kind: params.kind,
    vehicle_id: params.kind === 'transport_vehicle' ? params.vehicleId ?? null : null,
  }

  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .insert(row)
    .select(SELECT_COLS)
    .single()

  if (error) throw error
  return data as CalendarSubscriptionRow
}

/** Delete a calendar subscription by id */
export async function deleteCalendarSubscription(
  subscriptionId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('calendar_subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .eq('user_id', userId)

  if (error) throw error
}

/** Public app URL used for calendar feed link */
const PUBLIC_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_PUBLIC_URL as string) ||
  ''

/** Build the feed URL for a given token */
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
