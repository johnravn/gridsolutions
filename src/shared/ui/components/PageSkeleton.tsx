import * as React from 'react'
import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Skeleton,
} from '@radix-ui/themes'

type Props = {
  columns?: '1fr 1fr' | '2fr 1fr' | '2fr 3fr' | '1fr'
  showHeader?: boolean
  showTableRows?: number
  showInspector?: boolean
}

export default function PageSkeleton({
  columns = '1fr 1fr',
  showHeader = true,
  showTableRows = 8,
  showInspector = true,
}: Props) {
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  const gridColumns = isLarge && showInspector ? columns : '1fr'

  return (
    <section style={{ height: isLarge ? '100%' : undefined, minHeight: 0 }}>
      <Grid
        columns={gridColumns as '1fr'}
        gap="4"
        align="stretch"
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: isLarge ? '100%' : undefined,
            minHeight: 0,
          }}
        >
          {showHeader && (
            <>
              <Flex align="center" justify="between" mb="3">
                <Skeleton>
                  <Heading size="5">Loading...</Heading>
                </Skeleton>
                <Skeleton>
                  <Box style={{ width: 120, height: 32 }} />
                </Skeleton>
              </Flex>
              <Separator size="4" mb="3" />
            </>
          )}
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            {Array.from({ length: showTableRows }).map((_, i) => (
              <Skeleton key={i} mb="2" style={{ height: 44 }} />
            ))}
          </Box>
        </Card>

        {/* RIGHT - Inspector */}
        {showInspector && (
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: isLarge ? '100%' : undefined,
              maxHeight: isLarge ? '100%' : undefined,
              overflow: isLarge ? 'hidden' : 'visible',
              minHeight: 0,
            }}
          >
            <Skeleton mb="3">
              <Heading size="5">Inspector</Heading>
            </Skeleton>
            <Separator size="4" mb="3" />
            <Box
              style={{
                flex: isLarge ? 1 : undefined,
                minHeight: isLarge ? 0 : undefined,
                overflowY: isLarge ? 'auto' : 'visible',
              }}
            >
              <Skeleton mb="3" style={{ height: 200 }} />
              <Skeleton mb="2" style={{ height: 24 }} />
              <Skeleton mb="2" style={{ height: 24 }} />
              <Skeleton mb="2" style={{ height: 24 }} />
              <Skeleton mb="2" style={{ height: 24, width: '60%' }} />
            </Box>
          </Card>
        )}
      </Grid>
    </section>
  )
}
