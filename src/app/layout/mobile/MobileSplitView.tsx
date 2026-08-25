import { Box, Flex, Skeleton } from '@radix-ui/themes'
import { SplitListBodySkeleton, SplitSlotsClear } from '@app/layout/split'
import { MobileDrawerFab } from './MobileDrawerFab'
import { MobileRightDrawer } from './MobileRightDrawer'
import type { ReactNode } from 'react'

/** Unwrapped list + right inspector drawer + FAB. Use when `isLarge` is false. */
export function MobileSplitView({
  open,
  onOpenChange,
  onToggle,
  drawerTitle,
  inspector,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggle: () => void
  drawerTitle?: ReactNode
  inspector: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <SplitSlotsClear />
      {children}
      <MobileRightDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={drawerTitle}
      >
        {inspector}
      </MobileRightDrawer>
      <MobileDrawerFab open={open} onToggle={onToggle} />
    </>
  )
}

export function MobileListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Flex direction="column" gap="5" style={{ paddingBottom: 40 }}>
      <Skeleton style={{ height: 40, width: '100%' }} />
      <SplitListBodySkeleton rows={rows} />
    </Flex>
  )
}

export function MobileSplitSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      <SplitSlotsClear />
      <MobileListSkeleton rows={rows} />
    </>
  )
}

/** Page-flow list shell with sticky search/filter chrome covering AppShell padding. */
export function MobilePageList({
  toolbar,
  children,
}: {
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <Flex direction="column" gap="5" style={{ minWidth: 0 }}>
      {toolbar ? (
        <Box className="app-mobile-sticky-toolbar">{toolbar}</Box>
      ) : null}
      {children}
    </Flex>
  )
}

export const MOBILE_LIST_BOTTOM_PAD =
  'calc(var(--app-menu-fab-clearance) + var(--space-5))'
