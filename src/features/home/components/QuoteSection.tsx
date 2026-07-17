import * as React from 'react'
import { Box, Flex, Quote, Text } from '@radix-ui/themes'
import { Quote as QuoteIcon } from 'iconoir-react'
import { DAILY_QUOTES } from '../data/quotes'
import { pickQuoteForDate } from '../utils/dailyInspiration'
import { DashboardCard } from './DashboardCard'

export function QuoteSection({
  presentation = 'desktop',
}: {
  presentation?: 'desktop' | 'mobile'
}) {
  const todayKey = React.useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  )
  const quote = React.useMemo(
    () => pickQuoteForDate({ dateKey: todayKey, quotes: DAILY_QUOTES }),
    [todayKey],
  )

  return (
    <DashboardCard
      title="Today's quote"
      icon={<QuoteIcon width={18} height={18} />}
      notFullHeight={presentation === 'mobile'}
      variant={presentation === 'mobile' ? 'plain' : 'card'}
    >
      {!quote ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No quote available.
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2" py="2">
          <Text weight="bold" size="4">
            Quote of the day
          </Text>
          <Text size="3" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            <Quote>{quote.quote}</Quote>
          </Text>
          <Text size="1" color="gray">
            — {quote.author}
          </Text>
        </Flex>
      )}
    </DashboardCard>
  )
}
