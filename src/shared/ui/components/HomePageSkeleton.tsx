import { Box, Card, Flex } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import DashboardCardSkeleton from './DashboardCardSkeleton'

const LARGE_BREAKPOINT = '(min-width: 1024px)'

function WeekColumnHeaderSkeleton() {
  return (
    <Box style={{ minWidth: 0 }}>
      <Box
        style={{
          height: 16,
          width: '55%',
          borderRadius: 4,
          background: 'var(--gray-a3)',
          marginBottom: 6,
        }}
      />
      <Box
        style={{
          height: 12,
          width: '70%',
          borderRadius: 4,
          background: 'var(--gray-a2)',
        }}
      />
    </Box>
  )
}

function WeekColumnBodySkeleton({
  rowCount,
  compact,
}: {
  rowCount: number
  compact?: boolean
}) {
  return (
    <Flex
      direction="column"
      gap={compact ? '2' : '3'}
      style={{ flex: 1, minHeight: 0 }}
    >
      {Array.from({ length: rowCount }, (_, i) => (
        <Box
          key={i}
          style={{
            height: compact ? 72 : 96,
            borderRadius: 8,
            background: 'var(--gray-a2)',
            border: '1px solid var(--gray-a4)',
            flexShrink: 0,
          }}
        />
      ))}
    </Flex>
  )
}

function DesktopSkeleton() {
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
      }}
    >
      <Flex
        direction="column"
        gap="4"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 'var(--space-4)',
            flexShrink: 0,
            maxHeight: '28%',
            minHeight: 0,
            overflow: 'hidden',
            alignItems: 'stretch',
          }}
        >
          <Box style={{ minHeight: 0, height: '100%' }}>
            <DashboardCardSkeleton rowCount={2} compact />
          </Box>
          <Box style={{ minHeight: 0, height: '100%' }}>
            <DashboardCardSkeleton rowCount={2} compact />
          </Box>
        </Box>

        <Card
          size="3"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Flex
            align="center"
            justify="between"
            gap="3"
            mb="3"
            style={{ flexShrink: 0 }}
          >
            <Box
              style={{
                height: 20,
                width: 200,
                borderRadius: 6,
                background: 'var(--gray-a3)',
              }}
            />
            <Box
              style={{
                height: 24,
                width: 110,
                borderRadius: 6,
                background: 'var(--gray-a2)',
              }}
            />
          </Flex>

          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              gap: 'var(--space-4)',
              flexShrink: 0,
              marginBottom: 'var(--space-3)',
            }}
          >
            <WeekColumnHeaderSkeleton />
            <WeekColumnHeaderSkeleton />
            <WeekColumnHeaderSkeleton />
          </Box>

          <Flex
            direction="row"
            gap="4"
            align="stretch"
            style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
          >
            <Box style={{ flex: '2 1 0%', minWidth: 0, minHeight: 0 }}>
              <WeekColumnBodySkeleton rowCount={4} />
            </Box>
            <Box style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0 }}>
              <WeekColumnBodySkeleton rowCount={4} compact />
            </Box>
            <Box style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0 }}>
              <WeekColumnBodySkeleton rowCount={4} compact />
            </Box>
          </Flex>
        </Card>
      </Flex>
    </Box>
  )
}

function HorizontalRowSkeleton() {
  return (
    <Box style={{ width: '100%', minWidth: 0 }}>
      <Box
        style={{
          height: 20,
          width: 140,
          borderRadius: 6,
          background: 'var(--gray-a3)',
          marginBottom: 12,
        }}
      />
      <Flex gap="3" style={{ overflow: 'hidden' }}>
        {[0, 1].map((i) => (
          <Card
            key={i}
            size="2"
            style={{
              width: 260,
              minWidth: 260,
              flexShrink: 0,
              height: 96,
            }}
          >
            <Box
              style={{
                height: 14,
                width: '70%',
                borderRadius: 4,
                background: 'var(--gray-a3)',
                marginBottom: 10,
              }}
            />
            <Box
              style={{
                height: 12,
                width: '50%',
                borderRadius: 4,
                background: 'var(--gray-a2)',
              }}
            />
          </Card>
        ))}
      </Flex>
    </Box>
  )
}

function MobileSkeleton() {
  return (
    <Box
      style={{
        width: '100%',
        minWidth: 0,
      }}
    >
      <Flex
        direction="column"
        gap="5"
        style={{
          minHeight: '100%',
          minWidth: 0,
        }}
      >
        <Box>
          <Box
            style={{
              height: 20,
              width: 120,
              borderRadius: 6,
              background: 'var(--gray-a3)',
              marginBottom: 12,
            }}
          />
          <Box
            style={{
              height: 48,
              width: '100%',
              borderRadius: 8,
              background: 'var(--gray-a2)',
            }}
          />
        </Box>
        <Flex direction="column" gap="2">
          {[0, 1, 2].map((i) => (
            <Card
              key={i}
              size="2"
              style={{
                padding: 0,
                height: 56,
                background: 'var(--gray-a2)',
              }}
            />
          ))}
        </Flex>
        <HorizontalRowSkeleton />
        <Flex direction="column" gap="2">
          {[0, 1].map((i) => (
            <Card
              key={i}
              size="2"
              style={{
                padding: 0,
                height: 56,
                background: 'var(--gray-a2)',
              }}
            />
          ))}
        </Flex>
      </Flex>
    </Box>
  )
}

export default function HomePageSkeleton() {
  const isLarge = useMediaQuery(LARGE_BREAKPOINT)

  return (
    <section style={{ height: '100%', minHeight: 0 }}>
      {isLarge ? <DesktopSkeleton /> : <MobileSkeleton />}
    </section>
  )
}
