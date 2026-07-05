import * as React from 'react'
import { Box, Flex } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import DashboardCardSkeleton from './DashboardCardSkeleton'

const LARGE_BREAKPOINT = '(min-width: 1024px)'

function GrowingCardSkeleton({
  rowCount,
  flex,
}: {
  rowCount: number
  flex: number
}) {
  return (
    <Box
      style={{
        flex,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DashboardCardSkeleton rowCount={rowCount} notFullHeight={false} />
    </Box>
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
        direction="row"
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        <Flex
          direction="column"
          gap="4"
          style={{
            width: '50%',
            height: '100%',
            minWidth: '300px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <DashboardCardSkeleton rowCount={2} compact />
          <GrowingCardSkeleton rowCount={5} flex={1} />
        </Flex>

        <Box
          style={{
            width: '6px',
            height: '15%',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: '4px',
            flexShrink: 0,
            alignSelf: 'center',
            margin: '0 -4px',
          }}
        />

        <Flex
          direction="column"
          gap="4"
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '300px',
            minHeight: 0,
          }}
        >
          <DashboardCardSkeleton rowCount={3} compact />
          <GrowingCardSkeleton rowCount={4} flex={2} />
        </Flex>
      </Flex>
    </Box>
  )
}

function MobileSkeleton() {
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Flex
        direction="column"
        gap="4"
        style={{
          minHeight: '100%',
        }}
      >
        <DashboardCardSkeleton rowCount={2} compact />
        <GrowingCardSkeleton rowCount={5} flex={1} />
        <DashboardCardSkeleton rowCount={3} compact />
        <GrowingCardSkeleton rowCount={4} flex={2} />
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
