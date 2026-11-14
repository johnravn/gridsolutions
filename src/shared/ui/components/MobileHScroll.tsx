import { Box } from '@radix-ui/themes'
import type { ComponentPropsWithoutRef } from 'react'

type BoxProps = ComponentPropsWithoutRef<typeof Box>

/**
 * Intentional horizontal scroll region for wide tables/charts on phone.
 * Contains overscroll so nested X-scroll does not yank the vertical drawer.
 */
export function MobileHScroll({ className, style, ...props }: BoxProps) {
  return (
    <Box
      {...props}
      className={['mobile-hscroll', className].filter(Boolean).join(' ')}
      style={{ maxWidth: '100%', minWidth: 0, ...style }}
    />
  )
}
