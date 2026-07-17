import { Box, Skeleton } from '@radix-ui/themes'
import { SplitPage  } from './SplitPage'
import type {SplitPageProps} from './SplitPage';

export function SplitListBodySkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} mb="2" style={{ height: 44 }} />
      ))}
    </>
  )
}

export function SplitInspectorBodySkeleton() {
  return (
    <>
      <Skeleton mb="3" style={{ height: 200 }} />
      <Skeleton mb="2" style={{ height: 24 }} />
      <Skeleton mb="2" style={{ height: 24 }} />
      <Skeleton mb="2" style={{ height: 24 }} />
      <Skeleton mb="2" style={{ height: 24, width: '60%' }} />
    </>
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
        showInspector ? <SplitInspectorBodySkeleton /> : <SplitListBodySkeleton />
      }
    />
  )
}
