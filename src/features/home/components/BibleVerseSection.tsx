import { Box, Flex, Quote, Text } from '@radix-ui/themes'
import { Quote as QuoteIcon } from 'iconoir-react'
import { useQuery } from '@tanstack/react-query'
import DashboardCardSkeleton from '@shared/ui/components/DashboardCardSkeleton'
import { DashboardCard } from './DashboardCard'

export function BibleVerseSection() {
  const todayKey = new Date().toISOString().slice(0, 10)
  const langPreference = 'en'

  const { data, isLoading, error } = useQuery({
    queryKey: ['youversion', 'verse-of-the-day', todayKey, langPreference],
    queryFn: async () => {
      const res = await fetch(
        `/api/verse-of-the-day?lang=${encodeURIComponent(langPreference)}`,
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          typeof json?.message === 'string'
            ? json.message
            : 'Failed to load verse of the day',
        )
      }
      return json
    },
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 48,
    retry: 1,
  })

  const citation = data?.citation ? String(data.citation) : ''
  const passage = data?.passage ? String(data.passage) : ''
  const version = data?.version ? String(data.version) : ''

  return (
    <DashboardCard
      title="Today's Bible verse"
      icon={<QuoteIcon width={18} height={18} />}
      notFullHeight
    >
      {isLoading ? (
        <DashboardCardSkeleton rowCount={2} compact />
      ) : error ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            Couldn&apos;t load today&apos;s verse.
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2" py="2">
          <Text weight="bold" size="4">
            {citation || 'Verse of the Day'}
          </Text>
          <Text size="3" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            <Quote>{passage || 'No verse text available.'}</Quote>
          </Text>
          {version && (
            <Text size="1" color="gray">
              Translation: {version}
            </Text>
          )}
        </Flex>
      )}
    </DashboardCard>
  )
}
