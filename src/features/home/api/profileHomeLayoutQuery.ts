import { supabase } from '@shared/api/supabase'

export type HomeDashboardLayoutPreferences = {
  showDailyInspiration: boolean
  showLatest: boolean
  showMatters: boolean
  showConflicts: boolean
  showUpcomingJobs: boolean
}

export function defaultHomeDashboardLayoutPreferences(): HomeDashboardLayoutPreferences {
  return {
    showDailyInspiration: true,
    showLatest: true,
    showMatters: true,
    showConflicts: true,
    showUpcomingJobs: true,
  }
}

function parseHomeLayout(prefs: Record<string, unknown> | null | undefined) {
  const p = prefs ?? {}
  return {
    showDailyInspiration: p.home_show_daily_inspiration !== false,
    showLatest: p.home_show_latest !== false,
    showMatters: p.home_show_matters !== false,
    showConflicts: p.home_show_conflicts !== false,
    showUpcomingJobs: p.home_show_upcoming_jobs !== false,
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
