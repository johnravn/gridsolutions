import * as React from 'react'
import { Box, Skeleton } from '@radix-ui/themes'

type Props = {
  height?: number
}

export default function ChartSkeleton({ height = 300 }: Props) {
  return (
    <Skeleton>
      <Box style={{ width: '100%', height }} />
    </Skeleton>
  )
}
