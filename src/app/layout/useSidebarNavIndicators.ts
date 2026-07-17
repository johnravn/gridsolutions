import * as React from 'react'

type Indicator = {
  x: number
  y: number
  width: number
  height: number
  ready: boolean
}

const HIDDEN: Indicator = { x: 0, y: 0, width: 0, height: 0, ready: false }

function sameIndicator(a: Indicator, b: Indicator) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.ready === b.ready
  )
}

function measureElement(list: HTMLElement, el: HTMLElement): Indicator {
  const listRect = list.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left - listRect.left,
    y: rect.top - listRect.top,
    width: rect.width,
    height: rect.height,
    ready: true,
  }
}

/**
 * Sliding active + hover highlights for the sidebar nav list.
 * Attach returned props to the nav list container.
 */
export function useSidebarNavIndicators(activeKey: string) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState<Indicator>(HIDDEN)
  const [hover, setHover] = React.useState<Indicator>(HIDDEN)
  const [hoverScale, setHoverScale] = React.useState(0)
  const isHoveringRef = React.useRef(false)
  const hoveredItemRef = React.useRef<HTMLElement | null>(null)
  const hoverEnterRafRef = React.useRef(0)
  const scrollEndTimerRef = React.useRef(0)
  const hasPositionedRef = React.useRef(false)
  const [canAnimate, setCanAnimate] = React.useState(false)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const syncHoverScaleForActive = () => {
      const hovered = hoveredItemRef.current
      if (!hovered || !isHoveringRef.current) return
      // Don't stack hover + active pills on the same item.
      if (hovered.classList.contains('sidebar-nav-item--active')) {
        setHoverScale(0)
      }
    }

    const updateActive = () => {
      const item = list.querySelector<HTMLElement>('.sidebar-nav-item--active')
      const next = item ? measureElement(list, item) : HIDDEN
      setActive((prev) => (sameIndicator(prev, next) ? prev : next))
      syncHoverScaleForActive()

      if (next.ready && !hasPositionedRef.current) {
        hasPositionedRef.current = true
        requestAnimationFrame(() => setCanAnimate(true))
      }
    }

    updateActive()

    const resizeObserver = new ResizeObserver(updateActive)
    resizeObserver.observe(list)
    for (const item of list.querySelectorAll<HTMLElement>('.sidebar-nav-item')) {
      resizeObserver.observe(item)
    }

    const mutationObserver = new MutationObserver(updateActive)
    mutationObserver.observe(list, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
      childList: true,
    })

    const onScroll = () => {
      setCanAnimate(false)
      updateActive()
      isHoveringRef.current = false
      hoveredItemRef.current = null
      setHoverScale(0)
      setHover((prev) => (prev.ready ? { ...prev, ready: false } : prev))
      window.clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = window.setTimeout(() => setCanAnimate(true), 80)
    }

    const scroller = list.parentElement
    scroller?.addEventListener('scroll', onScroll, { passive: true })

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const target = event.target
      if (!(target instanceof Element)) return
      const item = target.closest<HTMLElement>('.sidebar-nav-item')
      if (!item || !list.contains(item)) return
      const next = measureElement(list, item)
      const hoveringActive = item.classList.contains('sidebar-nav-item--active')
      hoveredItemRef.current = item

      if (!isHoveringRef.current) {
        isHoveringRef.current = true
        list.dataset.hoverSnap = ''
        setHover(next)
        setHoverScale(0)
        cancelAnimationFrame(hoverEnterRafRef.current)
        hoverEnterRafRef.current = requestAnimationFrame(() => {
          hoverEnterRafRef.current = requestAnimationFrame(() => {
            delete list.dataset.hoverSnap
            setHoverScale(hoveringActive ? 0 : 1)
          })
        })
        return
      }

      setHover((prev) => (sameIndicator(prev, next) ? prev : next))
      setHoverScale(hoveringActive ? 0 : 1)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const target = event.target
      if (!(target instanceof Element)) return
      const item = target.closest<HTMLElement>('.sidebar-nav-item')
      if (!item || !list.contains(item)) return
      // Zoom out immediately so the sliding active pill doesn't double up.
      setHoverScale(0)
    }

    const onPointerLeave = () => {
      isHoveringRef.current = false
      hoveredItemRef.current = null
      cancelAnimationFrame(hoverEnterRafRef.current)
      delete list.dataset.hoverSnap
      setHoverScale(0)
      setHover((prev) => (prev.ready ? { ...prev, ready: false } : prev))
    }

    list.addEventListener('pointerover', onPointerOver)
    list.addEventListener('pointerdown', onPointerDown)
    list.addEventListener('pointerleave', onPointerLeave)

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      scroller?.removeEventListener('scroll', onScroll)
      list.removeEventListener('pointerover', onPointerOver)
      list.removeEventListener('pointerdown', onPointerDown)
      list.removeEventListener('pointerleave', onPointerLeave)
      window.clearTimeout(scrollEndTimerRef.current)
      cancelAnimationFrame(hoverEnterRafRef.current)
    }
  }, [activeKey])

  return {
    ref: listRef,
    className: 'sidebar-nav-list',
    'data-animate': canAnimate ? ('' as const) : undefined,
    style: {
      position: 'relative' as const,
      minWidth: 0,
      ['--sidebar-indicator-x' as string]: `${active.x}px`,
      ['--sidebar-indicator-y' as string]: `${active.y}px`,
      ['--sidebar-indicator-width' as string]: `${active.width}px`,
      ['--sidebar-indicator-height' as string]: `${active.height}px`,
      ['--sidebar-indicator-opacity' as string]: active.ready ? 1 : 0,
      ['--sidebar-hover-x' as string]: `${hover.x}px`,
      ['--sidebar-hover-y' as string]: `${hover.y}px`,
      ['--sidebar-hover-width' as string]: `${hover.width}px`,
      ['--sidebar-hover-height' as string]: `${hover.height}px`,
      ['--sidebar-hover-scale' as string]: String(hoverScale),
    },
  }
}
