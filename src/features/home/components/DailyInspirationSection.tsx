import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  DEFAULT_BIBLE_VERSION,
  normalizeBibleVersion,
} from '@shared/lib/bibleVersion'
import { normalizeDailyInspirationType } from '../utils/dailyInspiration'
import { BibleVerseSection } from './BibleVerseSection'
import { QuoteSection } from './QuoteSection'

export function DailyInspirationSection({
  userId,
  presentation = 'desktop',
}: {
  userId: string | null
  presentation?: 'desktop' | 'mobile'
}) {
  const { data: inspiration } = useQuery({
    queryKey: ['profile', userId ?? '__none__', 'daily-inspiration-type'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return {
          type: 'quote' as const,
          bibleVersion: DEFAULT_BIBLE_VERSION,
        }
      }
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

  const resolved = normalizeDailyInspirationType(inspiration?.type)

  if (resolved === 'bibleverse')
    return (
      <BibleVerseSection
        presentation={presentation}
        bibleVersion={normalizeBibleVersion(inspiration?.bibleVersion)}
      />
    )
  return <QuoteSection presentation={presentation} />
}
