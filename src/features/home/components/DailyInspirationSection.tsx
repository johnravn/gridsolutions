import { useQuery } from '@tanstack/react-query'
import { normalizeBibleVersion } from '@shared/lib/bibleVersion'
import {
  dailyInspirationPrefsQuery,
  defaultDailyInspirationPrefs,
} from '../api/dailyInspirationPrefsQuery'
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
    ...dailyInspirationPrefsQuery(userId ?? ''),
    enabled: !!userId,
  })

  const resolved = normalizeDailyInspirationType(
    inspiration?.type ?? defaultDailyInspirationPrefs().type,
  )

  if (resolved === 'bibleverse')
    return (
      <BibleVerseSection
        presentation={presentation}
        bibleVersion={normalizeBibleVersion(inspiration?.bibleVersion)}
      />
    )
  return <QuoteSection presentation={presentation} />
}
