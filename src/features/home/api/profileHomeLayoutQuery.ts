import { supabase } from '@shared/api/supabase'

export type HomeDashboardLayoutPreferences = {
  showDailyInspiration: boolean
  /** Gates CompanyJobsWeekSection on Home (legacy key: home_show_latest). */
  showCompanyJobsWeek: boolean
  showMatters: boolean
  showConflicts: boolean
}

export function defaultHomeDashboardLayoutPreferences(): HomeDashboardLayoutPreferences {
  return {
    showDailyInspiration: true,
    showCompanyJobsWeek: true,
    showMatters: true,
    showConflicts: true,
  }
}

function prefEnabled(
  prefs: Record<string, unknown>,
  ...keys: Array<string>
): boolean {
  for (const key of keys) {
    if (key in prefs) return prefs[key] !== false
  }
  return true
}

/** Exported for unit tests — preference key rename + legacy fallback. */
export function parseHomeLayout(
  prefs: Record<string, unknown> | null | undefined,
) {
  const p = prefs ?? {}
  return {
    showDailyInspiration: prefEnabled(p, 'home_show_daily_inspiration'),
    // Prefer new key; fall back to legacy home_show_latest (same meaning).
    showCompanyJobsWeek: prefEnabled(
      p,
      'home_show_company_jobs_week',
      'home_show_latest',
    ),
    showMatters: prefEnabled(p, 'home_show_matters'),
    showConflicts: prefEnabled(p, 'home_show_conflicts'),
  } satisfies HomeDashboardLayoutPreferences
}

export function profileHomeLayoutQuery(userId: string) {
  return {
    queryKey: ['profile', userId, 'home-dashboard-layout'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return parseHomeLayout(
        data?.preferences as Record<string, unknown> | null,
      )
    },
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  }
}
