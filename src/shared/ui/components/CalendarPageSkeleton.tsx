import { Box, Card, Flex, Grid, Skeleton } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'

export default function CalendarPageSkeleton() {
  const isMobile = useMediaQuery('(max-width: 1023px)')

  const page = (
    <Flex className="calendar-page" direction="column" gap="2">
      <Flex
        align="center"
        gap="2"
        wrap="nowrap"
        style={{ flexShrink: 0, minWidth: 0 }}
      >
        <Skeleton>
          <Box style={{ width: 88, height: 32 }} />
        </Skeleton>
        <Skeleton style={{ flex: 1, minWidth: 0 }}>
          <Box style={{ width: '100%', height: 32 }} />
        </Skeleton>
        {!isMobile && (
          <Flex gap="2" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
          </Flex>
        )}
      </Flex>

      <Flex align="center" justify="between" style={{ flexShrink: 0 }}>
        <Skeleton>
          <Box style={{ width: 120, height: 24 }} />
        </Skeleton>
        {!isMobile && (
          <Flex gap="2">
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
          </Flex>
        )}
      </Flex>

      <Grid columns="7" gap="2" style={{ flexShrink: 0 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`head-${i}`}>
            <Box style={{ height: 20 }} />
          </Skeleton>
        ))}
      </Grid>

      <Grid
        columns="7"
        gap="2"
        style={{ flex: 1, minHeight: 0, alignContent: 'stretch' }}
      >
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={`cell-${i}`} style={{ minHeight: 0, height: '100%' }}>
            <Box style={{ height: '100%', minHeight: 48 }} />
          </Skeleton>
        ))}
      </Grid>
    </Flex>
  )

  if (isMobile) return page

  return (
    <Card
      size="3"
      className="calendar-page-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {page}
    </Card>
  )
}
