import * as React from 'react'
import { Box, Card, Flex, Grid, Skeleton } from '@radix-ui/themes'

export default function CalendarPageSkeleton() {
  return (
    <Card>
      <Box p="4">
        <Flex align="center" gap="3" mb="4" wrap="wrap">
          <Skeleton>
            <Box style={{ width: 150, height: 32 }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ width: 260, height: 32 }} />
          </Skeleton>
          <Flex gap="2" style={{ marginLeft: 'auto' }}>
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
          </Flex>
        </Flex>

        <Flex align="center" justify="between" mb="3">
          <Skeleton>
            <Box style={{ width: 120, height: 24 }} />
          </Skeleton>
          <Flex gap="2">
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 32, height: 32 }} />
            </Skeleton>
          </Flex>
        </Flex>

        <Grid columns="7" gap="2" mb="2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`head-${i}`}>
              <Box style={{ height: 20 }} />
            </Skeleton>
          ))}
        </Grid>

        <Grid columns="7" gap="2">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={`cell-${i}`}>
              <Box style={{ height: 72 }} />
            </Skeleton>
          ))}
        </Grid>
      </Box>
    </Card>
  )
}
