import * as React from 'react'
import { Box, Card, Flex, Grid, Separator, Skeleton } from '@radix-ui/themes'

export default function ProfilePageSkeleton() {
  return (
    <section>
      <Card size="3">
        <Flex direction="column" gap="4">
          <Flex align="center" gap="4">
            <Skeleton>
              <Box
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                }}
              />
            </Skeleton>
            <Flex direction="column" gap="2" style={{ flex: 1 }}>
              <Skeleton>
                <Box style={{ width: 180, height: 24 }} />
              </Skeleton>
              <Skeleton>
                <Box style={{ width: 220, height: 16 }} />
              </Skeleton>
            </Flex>
          </Flex>

          <Separator size="4" />

          <Flex gap="2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i}>
                <Box style={{ width: 100, height: 32 }} />
              </Skeleton>
            ))}
          </Flex>

          <Grid columns={{ initial: '1', md: '2' }} gap="4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Flex key={i} direction="column" gap="1">
                <Skeleton>
                  <Box style={{ width: 80, height: 12 }} />
                </Skeleton>
                <Skeleton>
                  <Box style={{ width: '100%', height: 36 }} />
                </Skeleton>
              </Flex>
            ))}
          </Grid>
        </Flex>
      </Card>
    </section>
  )
}
