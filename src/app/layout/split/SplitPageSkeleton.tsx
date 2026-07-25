import * as React from 'react'
import { Box, Skeleton } from '@radix-ui/themes'
import { motion, useReducedMotion } from 'framer-motion'
import { SplitPage } from './SplitPage'
import type { SplitPageProps } from './SplitPage'

const ENTER_OFFSET_Y = 10
const ENTER_TRANSITION = { duration: 0.22, ease: 'easeOut' as const }

function SkeletonEnter({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion()
  if (reducedMotion) return <>{children}</>
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

export function SplitListBodySkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonEnter>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} mb="2" style={{ height: 44 }} />
      ))}
    </SkeletonEnter>
  )
}

export function SplitInspectorBodySkeleton() {
  return (
    <SkeletonEnter>
      <Skeleton mb="3" style={{ height: 200 }} />
      <Skeleton mb="2" style={{ height: 24 }} />
      <Skeleton mb="2" style={{ height: 24 }} />
      <Skeleton mb="2" style={{ height: 24 }} />
      <Skeleton mb="2" style={{ height: 24, width: '60%' }} />
    </SkeletonEnter>
  )
}

type SplitPageSkeletonProps = Pick<
  SplitPageProps,
  | 'defaultLeftWidth'
  | 'title'
  | 'rightTitle'
  | 'showLeftHeader'
  | 'showRightHeader'
  | 'leftMinWidthPx'
  | 'rightMinWidthPx'
  | 'minWidthPercent'
  | 'maxWidthPercent'
> & {
  showInspector?: boolean
  rows?: number
}

/**
 * Loading state that registers into the persistent split chrome
 * instead of tearing it down with a full-page skeleton.
 */
export function SplitPageSkeleton({
  showInspector = true,
  rows = 8,
  rightTitle = 'Inspector',
  ...props
}: SplitPageSkeletonProps) {
  return (
    <SplitPage
      {...props}
      rightTitle={rightTitle}
      showRightHeader={showInspector && props.showRightHeader !== false}
      leftToolbar={
        props.showLeftHeader === false ? undefined : (
          <Skeleton>
            <Box style={{ width: 120, height: 32 }} />
          </Skeleton>
        )
      }
      left={<SplitListBodySkeleton rows={rows} />}
      leftBodyStyle={{ overflowY: 'auto' }}
      right={
        showInspector ? (
          <SplitInspectorBodySkeleton />
        ) : (
          <SplitListBodySkeleton />
        )
      }
    />
  )
}
