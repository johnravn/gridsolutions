import * as React from 'react'
import { Skeleton } from '@radix-ui/themes'

type Props = {
  rowCount?: number
  rowHeight?: number
  gridTemplateColumns?: string
}

export function IndexTableBodySkeleton({
  rowCount = 8,
  rowHeight = 44,
  gridTemplateColumns,
}: Props) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <Skeleton
          key={i}
          mb="2"
          style={{
            height: rowHeight,
            ...(gridTemplateColumns
              ? { display: 'grid', gridTemplateColumns, gap: 'var(--space-3)' }
              : undefined),
          }}
        />
      ))}
    </>
  )
}
