import { Box, Flex } from '@radix-ui/themes'
import type { CSSProperties, ReactNode } from 'react'

const DEFAULT_CARD_MIN_WIDTH = 280

/**
 * Horizontal row of translucent Radix Cards for home sections.
 * When `bleed` is true (mobile), full-bleeds into AppShell `p="4"` gutters.
 */
export function HorizontalCardScroller({
  children,
  gap = '3',
  bleed = true,
  fillHeight = false,
  fadeRight = false,
}: {
  children: ReactNode
  gap?: '2' | '3' | '4'
  /** Full-bleed past page gutters. Disable inside DashboardCard. */
  bleed?: boolean
  /** Stretch to parent height (desktop Matters in DashboardCard). */
  fillHeight?: boolean
  /** Soft right-edge fade so content doesn't clip hard against a column separator. */
  fadeRight?: boolean
}) {
  const scrollerStyle: CSSProperties = {
    ...(bleed
      ? {
          width: 'calc(100% + 2 * var(--space-4))',
          maxWidth: 'none',
          marginLeft: 'calc(-1 * var(--space-4))',
          marginRight: 'calc(-1 * var(--space-4))',
          scrollbarWidth: 'none' as const,
          msOverflowStyle: 'none' as const,
        }
      : {
          width: '100%',
          maxWidth: '100%',
          scrollbarWidth: 'thin' as const,
        }),
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    position: 'relative',
    zIndex: 1,
    ...(fadeRight
      ? {
          maskImage:
            'linear-gradient(to right, #000 0%, #000 calc(100% - 28px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, #000 0%, #000 calc(100% - 28px), transparent 100%)',
        }
      : undefined),
    ...(fillHeight
      ? {
          flex: 1,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }
      : undefined),
  }

  return (
    <Box style={scrollerStyle} className="home-horizontal-scroller">
      <Flex
        direction="row"
        gap={gap}
        align="stretch"
        style={{
          width: 'max-content',
          minWidth: '100%',
          ...(fillHeight ? { flex: 1, minHeight: 0, height: '100%' } : undefined),
          ...(bleed
            ? {
                paddingLeft: 'var(--space-4)',
                paddingRight: 'var(--space-4)',
              }
            : {
                paddingRight: 'var(--space-1)',
              }),
        }}
      >
        {children}
      </Flex>
    </Box>
  )
}

/** Fixed-width wrapper so Card children do not shrink in the scroller. */
export function HorizontalScrollCard({
  children,
  minWidth = DEFAULT_CARD_MIN_WIDTH,
  onClick,
  style,
}: {
  children: ReactNode
  minWidth?: number
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <Box
      style={{
        width: minWidth,
        minWidth,
        maxWidth: minWidth,
        flexShrink: 0,
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </Box>
  )
}
