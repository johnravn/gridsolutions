import * as React from 'react'
import { IconButton, Tooltip } from '@radix-ui/themes'
import { ArrowUp } from 'iconoir-react'

type Props = {
  /** Ref to the list section to scroll to when clicked */
  listRef: React.RefObject<HTMLElement | null>
  /** Ref to the inspector section - button shows when this is in view */
  inspectorRef: React.RefObject<HTMLElement | null>
  /** Only show on small screens */
  visible: boolean
}

/**
 * Floating button that appears on small screens when the user has scrolled
 * down to the inspector. Clicking it scrolls back to the list at the top.
 */
export default function ScrollToTopButton({
  listRef,
  inspectorRef,
  visible,
}: Props) {
  const [isInspectorInView, setIsInspectorInView] = React.useState(false)

  React.useEffect(() => {
    if (!visible || !inspectorRef.current) return

    const el = inspectorRef.current
    const observer = new IntersectionObserver(
      ([entry]) => setIsInspectorInView(entry.isIntersecting),
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, inspectorRef])

  const handleClick = React.useCallback(() => {
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [listRef])

  const show = visible && isInspectorInView
  if (!show) return null

  return (
    <Tooltip content="Scroll to top">
      <IconButton
        size="3"
        variant="soft"
        style={{
          position: 'fixed',
          top: '72px',
          right: '16px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 50,
          flexShrink: 0,
        }}
        onClick={handleClick}
        aria-label="Scroll to top"
      >
        <ArrowUp width={20} height={20} />
      </IconButton>
    </Tooltip>
  )
}
