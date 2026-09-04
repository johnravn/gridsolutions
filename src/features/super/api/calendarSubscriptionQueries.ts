// src/features/super/api/calendarSubscriptionQueries.ts
import { supabase } from '@shared/api/supabase'
import type { CalendarSubscriptionKind } from '@features/calendar/api/calendarSubscription'

export type SuperCalendarSubscriptionRow = {
  id: string
  company_id: string
  company_name: string
  user_id: string
  user_email: string
  user_display_name: string | null
  user_first_name: string | null
  user_last_name: string | null
  user_avatar_url: string | null
  token: string
  kind: CalendarSubscriptionKind
  vehicle_id: string | null
  crew_user_id: string | null
  remind_1h_before: boolean
  created_at: string
  updated_at: string
}

export type SuperCalendarSubscriptionUserGroup = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  subscriptions: Array<SuperCalendarSubscriptionRow>
}

const KIND_LABELS: Record<CalendarSubscriptionKind, string> = {
  all_jobs: 'All jobs in company',
  project_lead_jobs: 'Project lead jobs',
  crew_jobs: 'Crew jobs',
  crew_user: 'Crew (one person)',
  transport_vehicle: 'Transport (one vehicle)',
  transport_all: 'All transport vehicles',
}

export function calendarSubscriptionKindLabel(kind: string): string {
  return KIND_LABELS[kind as CalendarSubscriptionKind] ?? kind
}

export function userDisplayLabel(group: {
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  const name =
    group.display_name?.trim() ||
    [group.first_name, group.last_name].filter(Boolean).join(' ').trim()
  return name || group.email || 'Unknown user'
}

export function calendarSubscriptionsAdminQuery() {
  return {
    queryKey: ['super', 'calendar-subscriptions'] as const,
    queryFn: async (): Promise<Array<SuperCalendarSubscriptionUserGroup>> => {
      const { data, error } = await supabase
        .from('calendar_subscriptions')
        .select(
          `
          id,
          company_id,
          user_id,
          token,
          kind,
          vehicle_id,
          crew_user_id,
          remind_1h_before,
          created_at,
          updated_at,
          companies (
            name
          ),
          profiles!calendar_subscriptions_user_id_fkey (
            email,
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows: Array<SuperCalendarSubscriptionRow> = (data ?? []).map(
        (row) => {
          const company = Array.isArray(row.companies)
            ? row.companies[0]
            : row.companies
          const profile = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles

          const p = profile as {
            email?: string
            display_name?: string | null
            first_name?: string | null
            last_name?: string | null
            avatar_url?: string | null
          } | null

          return {
            id: row.id,
            company_id: row.company_id,
            company_name: (company as { name?: string } | null)?.name ?? '—',
            user_id: row.user_id,
            user_email: p?.email ?? '',
            user_display_name: p?.display_name ?? null,
            user_first_name: p?.first_name ?? null,
            user_last_name: p?.last_name ?? null,
            user_avatar_url: p?.avatar_url ?? null,
            token: row.token,
            kind: row.kind as CalendarSubscriptionKind,
            vehicle_id: row.vehicle_id,
            crew_user_id: row.crew_user_id,
            remind_1h_before: row.remind_1h_before,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        },
      )

      const byUser = new Map<string, SuperCalendarSubscriptionUserGroup>()
      for (const row of rows) {
        let group = byUser.get(row.user_id)
        if (!group) {
          group = {
            user_id: row.user_id,
            email: row.user_email,
            display_name: row.user_display_name,
            first_name: row.user_first_name,
            last_name: row.user_last_name,
            avatar_url: row.user_avatar_url,
            subscriptions: [],
          }
          byUser.set(row.user_id, group)
        }
        group.subscriptions.push(row)
      }

      return Array.from(byUser.values()).sort((a, b) =>
        userDisplayLabel(a).localeCompare(userDisplayLabel(b), undefined, {
          sensitivity: 'base',
        }),
      )
    },
  }
}

export async function deleteCalendarSubscriptionAsSuper(
  subscriptionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('calendar_subscriptions')
    .delete()
    .eq('id', subscriptionId)

  if (error) throw error
}

export async function deleteCalendarSubscriptionsForUserAsSuper(
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('calendar_subscriptions')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}
