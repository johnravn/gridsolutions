import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
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
  const { data: inspirationType } = useQuery({
    queryKey: ['profile', userId ?? '__none__', 'daily-inspiration-type'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return 'quote' as const
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      const prefs = (data as { preferences?: unknown } | null)?.preferences as
        | Record<string, unknown>
        | undefined
      const raw = prefs?.daily_inspiration_type
      return normalizeDailyInspirationType(raw)
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 48,
  })

  const resolved = normalizeDailyInspirationType(inspirationType)

  if (resolved === 'bibleverse')
    return <BibleVerseSection presentation={presentation} />
  return <QuoteSection presentation={presentation} />
}
