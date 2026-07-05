import * as React from 'react'
import { Box, Skeleton } from '@radix-ui/themes'

type Props = {
  columnCount?: number
  rowCount?: number
}

export default function ReportTableSkeleton({
  columnCount = 8,
  rowCount = 8,
}: Props) {
  return (
    <Box>
      <Skeleton mb="3">
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, minmax(60px, 1fr))`,
            gap: 'var(--space-3)',
            height: 24,
          }}
        />
      </Skeleton>
      {Array.from({ length: rowCount }).map((_, i) => (
        <Skeleton key={i} mb="2">
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columnCount}, minmax(60px, 1fr))`,
              gap: 'var(--space-3)',
              height: 36,
            }}
          />
        </Skeleton>
      ))}
    </Box>
  )
}
