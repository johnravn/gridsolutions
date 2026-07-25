import * as React from 'react'
import { Box, Flex, Grid, Separator, Skeleton } from '@radix-ui/themes'
import { motion, useReducedMotion } from 'framer-motion'

/** Wait before showing skeleton so fast/cached loads never flash. */
const SKELETON_DELAY_MS = 140
const ENTER_OFFSET_Y = 10
const ENTER_TRANSITION = { duration: 0.22, ease: 'easeOut' as const }

function SkeletonMarkup() {
  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2">
        <div>
          <Skeleton mb="2">
            <Box style={{ width: 200, height: 24 }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ width: 150, height: 16 }} />
          </Skeleton>
        </div>
        <Flex gap="2" align="center">
          <Skeleton>
            <Box style={{ width: 60, height: 24 }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ width: 32, height: 32 }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ width: 32, height: 32 }} />
          </Skeleton>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* Two-column layout: Meta info on left, Map on right */}
      <Grid columns={{ initial: '1', sm: '2' }} gap="4" mb="3">
        {/* Left column: Meta */}
        <Flex direction="column" gap="2">
          <div>
            <Skeleton mb="1">
              <Box style={{ width: 50, height: 12 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 180, height: 16 }} />
            </Skeleton>
          </div>
          <div>
            <Skeleton mb="1">
              <Box style={{ width: 50, height: 12 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 150, height: 16 }} />
            </Skeleton>
          </div>
          <div>
            <Skeleton mb="1">
              <Box style={{ width: 40, height: 12 }} />
            </Skeleton>
            <Skeleton>
              <Box style={{ width: 120, height: 16 }} />
            </Skeleton>
          </div>
        </Flex>

        {/* Right column: Map */}
        <Box>
          <Skeleton mb="2">
            <Box style={{ width: 60, height: 16 }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ width: '100%', height: 200 }} />
          </Skeleton>
        </Box>
      </Grid>

      {/* Contacts section */}
      <Flex align="baseline" justify="between" mb="2">
        <Skeleton>
          <Box style={{ width: 80, height: 16 }} />
        </Skeleton>
        <Skeleton>
          <Box style={{ width: 100, height: 24 }} />
        </Skeleton>
      </Flex>

      <Box
        style={{
          border: '1px solid var(--gray-a6)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Skeleton>
          <Box style={{ width: '100%', height: 200 }} />
        </Skeleton>
      </Box>

      {/* Recent Jobs section */}
      <Flex align="baseline" justify="between" mb="2" mt="4">
        <Skeleton>
          <Box style={{ width: 100, height: 16 }} />
        </Skeleton>
      </Flex>

      <Box
        style={{
          border: '1px solid var(--gray-a6)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Skeleton>
          <Box style={{ width: '100%', height: 150 }} />
        </Skeleton>
      </Box>
    </Box>
  )
}

function useDelayedShow(delayMs: number) {
  const [show, setShow] = React.useState(delayMs <= 0)

  React.useEffect(() => {
    if (delayMs <= 0) {
      setShow(true)
      return
    }
    const timer = window.setTimeout(() => setShow(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  return show
}

/** Soft enter for loaded inspector content — remount with `key` when selection changes. */
export function InspectorFadeIn({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: ENTER_OFFSET_Y }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTER_TRANSITION}
      style={{ minWidth: 0 }}
    >
      {children}
    </motion.div>
  )
}

export default function InspectorSkeleton({
  /** Skip delay (e.g. Storybook). */
  instant = false,
}: {
  instant?: boolean
} = {}) {
  const reducedMotion = useReducedMotion()
  const show = useDelayedShow(instant || reducedMotion ? 0 : SKELETON_DELAY_MS)

  if (!show) {
    return <Box aria-hidden style={{ minHeight: 1 }} />
  }

  if (reducedMotion) {
    return <SkeletonMarkup />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: ENTER_OFFSET_Y }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTER_TRANSITION}
      style={{ minWidth: 0 }}
    >
      <SkeletonMarkup />
    </motion.div>
  )
}
