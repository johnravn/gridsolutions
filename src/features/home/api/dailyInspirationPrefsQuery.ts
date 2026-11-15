import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  DEFAULT_BIBLE_VERSION,
  normalizeBibleVersion,
} from '@shared/lib/bibleVersion'
import { normalizeDailyInspirationType } from '../utils/dailyInspiration'
import type { BibleVersion } from '@shared/lib/bibleVersion'
import type { DailyInspirationType } from '../utils/dailyInspiration'

export type DailyInspirationPrefs = {
  type: DailyInspirationType
  bibleVersion: BibleVersion
}

export function dailyInspirationPrefsQuery(userId: string) {
  return queryOptions<DailyInspirationPrefs>({
    queryKey: ['profile', userId, 'daily-inspiration-type'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      const prefs = (data as { preferences?: unknown } | null)?.preferences as
        | Record<string, unknown>
        | undefined
      return {
        type: normalizeDailyInspirationType(prefs?.daily_inspiration_type),
        bibleVersion: normalizeBibleVersion(prefs?.bible_version),
      }
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 48,
  })
}

export function defaultDailyInspirationPrefs(): DailyInspirationPrefs {
  return {
    type: 'quote',
    bibleVersion: DEFAULT_BIBLE_VERSION,
  }
}
