import * as React from 'react'
import { Box, Card, Flex, Skeleton } from '@radix-ui/themes'

type Props = {
  rowCount?: number
  compact?: boolean
  notFullHeight?: boolean
}

export default function DashboardCardSkeleton({
  rowCount = 4,
  compact = false,
  notFullHeight = true,
}: Props) {
  const cardStyle: React.CSSProperties | undefined = notFullHeight
    ? undefined
    : {
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }

  return (
    <Card size="3" style={cardStyle}>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3">
          <Flex align="center" gap="2">
            <Skeleton>
              <Box style={{ width: 32, height: 32, borderRadius: 8 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 140, height: 20 }} />
            </Skeleton>
          </Flex>
          {!compact && (
            <Skeleton>
              <Box style={{ width: 72, height: 28 }} />
            </Skeleton>
          )}
        </Flex>

        <Flex direction="column" gap="3">
          {Array.from({ length: rowCount }).map((_, i) => (
            <Flex key={i} align="center" gap="2">
              <Skeleton>
                <Box
                  style={{
                    width: compact ? 24 : 32,
                    height: compact ? 24 : 32,
                    borderRadius: '50%',
                  }}
                />
              </Skeleton>
              <Flex direction="column" gap="1" style={{ flex: 1 }}>
                <Skeleton>
                  <Box style={{ width: '70%', height: 14 }} />
                </Skeleton>
                <Skeleton>
                  <Box style={{ width: '45%', height: 12 }} />
                </Skeleton>
              </Flex>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </Card>
  )
}
