import * as React from 'react'
import { Box, Card, Flex, Grid, Skeleton } from '@radix-ui/themes'

export default function CalendarPageSkeleton() {
  return (
    <Card
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        p="4"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Flex
          align="center"
          gap="3"
          mb="4"
          wrap="wrap"
          style={{ flexShrink: 0 }}
        >
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

        <Flex
          align="center"
          justify="between"
          mb="3"
          style={{ flexShrink: 0 }}
        >
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

        <Grid columns="7" gap="2" mb="2" style={{ flexShrink: 0 }}>
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
      </Box>
    </Card>
  )
}
