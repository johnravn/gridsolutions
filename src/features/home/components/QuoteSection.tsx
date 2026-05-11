import * as React from 'react'
import { Box, Flex, Text } from '@radix-ui/themes'
import { Message } from 'iconoir-react'
import { DashboardCard } from './DashboardCard'
import { DAILY_QUOTES } from '../data/quotes'
import { pickQuoteForDate } from '../utils/dailyInspiration'

export function QuoteSection() {
  const todayKey = React.useMemo(() => new Date().toISOString().slice(0, 10), [])
  const quote = React.useMemo(
    () => pickQuoteForDate({ dateKey: todayKey, quotes: DAILY_QUOTES }),
    [todayKey],
  )

  return (
    <DashboardCard
      title="Today's quote"
      icon={<Message width={18} height={18} />}
      notFullHeight
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
            “{quote.quote}”
          </Text>
          <Text size="1" color="gray">
            — {quote.author}
          </Text>
        </Flex>
      )}
    </DashboardCard>
  )
}

