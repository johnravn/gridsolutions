import * as React from 'react'
import { IconButton, Tooltip } from '@radix-ui/themes'
import { ArrowDown, ArrowUp } from 'iconoir-react'

type Props = {
  /** Ref to the list section (scroll-up target) */
  listRef: React.RefObject<HTMLElement | null>
  /** Ref to the inspector section (scroll-down target) */
  inspectorRef: React.RefObject<HTMLElement | null>
  /**
   * Show the toggle when true — typically `!isLarge && selection != null`
   * so it only appears once the inspector is populated.
   */
  visible: boolean
}

function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start
  while (el?.parentElement) {
    const p = el.parentElement
    const overflowY = getComputedStyle(p).overflowY
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'
    ) {
      return p
    }
    el = p
  }
  return null
}

/**
 * Floating glass FAB on small screens when a detail is open.
 * Arrow up when the inspector is in view (scroll to list);
 * arrow down when the list is in view (scroll to inspector).
 */
export default function ScrollToTopButton({
  listRef,
  inspectorRef,
  visible,
}: Props) {
  const [isInspectorInView, setIsInspectorInView] = React.useState(false)

  React.useEffect(() => {
    if (!visible || !inspectorRef.current) {
      setIsInspectorInView(false)
      return
    }

    const el = inspectorRef.current
    const observer = new IntersectionObserver(
      ([entry]) => setIsInspectorInView(entry.isIntersecting),
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, inspectorRef])

  const scrollToList = React.useCallback(() => {
    const scroller = findScrollParent(listRef.current)
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [listRef])

  const scrollToInspector = React.useCallback(() => {
    inspectorRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [inspectorRef])

  const handleClick = React.useCallback(() => {
    if (isInspectorInView) {
      scrollToList()
    } else {
      scrollToInspector()
    }
  }, [isInspectorInView, scrollToList, scrollToInspector])

  if (!visible) return null

  const goingUp = isInspectorInView
  const label = goingUp ? 'Scroll to list' : 'Scroll to detail'
  const Icon = goingUp ? ArrowUp : ArrowDown

  return (
    <Tooltip content={label}>
      <IconButton
        size="3"
        variant="ghost"
        className="app-scroll-fab"
        onClick={handleClick}
        aria-label={label}
      >
        <Icon width={22} height={22} strokeWidth={2} />
      </IconButton>
    </Tooltip>
  )
}
