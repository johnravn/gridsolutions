import * as React from 'react'
import { flushSync } from 'react-dom'
import { Tabs } from '@radix-ui/themes'

type TabsListProps = React.ComponentPropsWithoutRef<typeof Tabs.List>

type Indicator = {
  x: number
  y: number
  width: number
  height: number
  ready: boolean
}

const HIDDEN: Indicator = { x: 0, y: 0, width: 0, height: 0, ready: false }
/** Treat Y deltas above this as a wrapped row change (px). */
const ROW_CHANGE_THRESHOLD_PX = 4
const WRAP_ZOOM_OUT_MS = 110

function sameIndicator(a: Indicator, b: Indicator) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.ready === b.ready
  )
}

function measureActive(list: HTMLElement): Indicator {
  const active = list.querySelector<HTMLElement>(
    '.rt-BaseTabListTrigger[data-state="active"], .rt-TabNavLink[data-active]',
  )
  if (!active) return HIDDEN

  return {
    x: active.offsetLeft - list.scrollLeft,
    y: active.offsetTop + active.offsetHeight - 2 - list.scrollTop,
    width: active.offsetWidth,
    height: 2,
    ready: true,
  }
}

function measureHover(list: HTMLElement, trigger: HTMLElement): Indicator {
  const inner = trigger.querySelector<HTMLElement>(
    '.rt-BaseTabListTriggerInner, .rt-TabsTriggerInner',
  )
  const target = inner ?? trigger
  const listRect = list.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()

  return {
    x: targetRect.left - listRect.left,
    y: targetRect.top - listRect.top,
    width: targetRect.width,
    height: targetRect.height,
    ready: true,
  }
}

/**
 * Drop-in for `Tabs.List` that animates the accent underline and hover
 * highlight between triggers with `transform`.
 */
export function AnimatedTabsList({
  className,
  style,
  children,
  ...props
}: TabsListProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = React.useState<Indicator>(HIDDEN)
  const [indicatorScale, setIndicatorScale] = React.useState(0)
  const [hover, setHover] = React.useState<Indicator>(HIDDEN)
  const [hoverScale, setHoverScale] = React.useState(0)
  const indicatorRef = React.useRef<Indicator>(HIDDEN)
  const isHoveringRef = React.useRef(false)
  const hoverEnterRafRef = React.useRef(0)
  const wrapTimerRef = React.useRef(0)
  const wrapRafRef = React.useRef(0)
  const hasPositionedRef = React.useRef(false)
  const [canAnimate, setCanAnimate] = React.useState(false)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const clearWrapAnimation = () => {
      window.clearTimeout(wrapTimerRef.current)
      wrapTimerRef.current = 0
      cancelAnimationFrame(wrapRafRef.current)
      delete list.dataset.indicatorSnap
      delete list.dataset.indicatorZoom
    }

    const updateActive = () => {
      const next = measureActive(list)
      const prev = indicatorRef.current
      if (sameIndicator(prev, next)) return

      const rowChanged =
        prev.ready &&
        next.ready &&
        hasPositionedRef.current &&
        Math.abs(next.y - prev.y) > ROW_CHANGE_THRESHOLD_PX

      clearWrapAnimation()

      if (rowChanged) {
        // Zoom out on the previous row, then snap + zoom in on the new row.
        // Position uses left/top; scale is a separate transform — so the zoom-in
        // cannot interpolate from the previous tab's coordinates.
        list.dataset.indicatorZoom = ''
        setIndicatorScale(0)
        wrapTimerRef.current = window.setTimeout(() => {
          list.dataset.indicatorSnap = ''
          flushSync(() => {
            indicatorRef.current = next
            setIndicator(next)
            setIndicatorScale(0)
          })
          void list.offsetWidth
          list.dataset.indicatorZoom = ''
          delete list.dataset.indicatorSnap
          wrapRafRef.current = requestAnimationFrame(() => {
            setIndicatorScale(1)
            wrapTimerRef.current = window.setTimeout(() => {
              delete list.dataset.indicatorZoom
              wrapTimerRef.current = 0
            }, WRAP_ZOOM_OUT_MS)
          })
        }, WRAP_ZOOM_OUT_MS)
        return
      }

      indicatorRef.current = next
      setIndicator(next)
      setIndicatorScale(next.ready ? 1 : 0)

      if (next.ready && !hasPositionedRef.current) {
        hasPositionedRef.current = true
        // Enable transitions only after the first layout so indicators
        // don't slide in from 0 on mount.
        requestAnimationFrame(() => setCanAnimate(true))
      }
    }

    updateActive()

    const resizeObserver = new ResizeObserver(updateActive)
    resizeObserver.observe(list)
    for (const trigger of list.querySelectorAll<HTMLElement>(
      '.rt-BaseTabListTrigger, .rt-TabNavLink',
    )) {
      resizeObserver.observe(trigger)
    }

    const mutationObserver = new MutationObserver(updateActive)
    mutationObserver.observe(list, {
      attributes: true,
      attributeFilter: ['data-state', 'data-active'],
      subtree: true,
      childList: true,
    })

    let scrollEndTimer = 0
    const onScroll = () => {
      // Keep indicators pinned while scrolling (no laggy transition).
      clearWrapAnimation()
      setCanAnimate(false)
      updateActive()
      isHoveringRef.current = false
      setHoverScale(0)
      setHover((prev) => (prev.ready ? { ...prev, ready: false } : prev))
      window.clearTimeout(scrollEndTimer)
      scrollEndTimer = window.setTimeout(() => setCanAnimate(true), 80)
    }

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const target = event.target
      if (!(target instanceof Element)) return
      const trigger = target.closest<HTMLElement>(
        '.rt-BaseTabListTrigger, .rt-TabNavLink',
      )
      if (!trigger || !list.contains(trigger)) return
      const next = measureHover(list, trigger)

      if (!isHoveringRef.current) {
        // First hover: snap geometry in place, then scale up (no slide from 0,0).
        isHoveringRef.current = true
        list.dataset.hoverSnap = ''
        setHover(next)
        setHoverScale(0)
        cancelAnimationFrame(hoverEnterRafRef.current)
        hoverEnterRafRef.current = requestAnimationFrame(() => {
          hoverEnterRafRef.current = requestAnimationFrame(() => {
            delete list.dataset.hoverSnap
            setHoverScale(1)
          })
        })
        return
      }

      setHover((prev) => (sameIndicator(prev, next) ? prev : next))
      setHoverScale(1)
    }

    const onPointerLeave = () => {
      isHoveringRef.current = false
      cancelAnimationFrame(hoverEnterRafRef.current)
      delete list.dataset.hoverSnap
      // Zoom out in place — keep last geometry.
      setHoverScale(0)
      setHover((prev) => (prev.ready ? { ...prev, ready: false } : prev))
    }

    list.addEventListener('scroll', onScroll, { passive: true })
    list.addEventListener('pointerover', onPointerOver)
    list.addEventListener('pointerleave', onPointerLeave)

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      list.removeEventListener('scroll', onScroll)
      list.removeEventListener('pointerover', onPointerOver)
      list.removeEventListener('pointerleave', onPointerLeave)
      window.clearTimeout(scrollEndTimer)
      clearWrapAnimation()
      cancelAnimationFrame(hoverEnterRafRef.current)
    }
  }, [children])

  return (
    <Tabs.List
      {...props}
      ref={listRef}
      data-animate={canAnimate ? '' : undefined}
      className={['animated-tabs-list', className].filter(Boolean).join(' ')}
      style={{
        ...style,
        ['--tab-indicator-x' as string]: `${indicator.x}px`,
        ['--tab-indicator-y' as string]: `${indicator.y}px`,
        ['--tab-indicator-width' as string]: `${indicator.width}px`,
        ['--tab-indicator-opacity' as string]: indicator.ready ? 1 : 0,
        ['--tab-indicator-scale' as string]: String(indicatorScale),
        ['--tab-hover-x' as string]: `${hover.x}px`,
        ['--tab-hover-y' as string]: `${hover.y}px`,
        ['--tab-hover-width' as string]: `${hover.width}px`,
        ['--tab-hover-height' as string]: `${hover.height}px`,
        ['--tab-hover-scale' as string]: String(hoverScale),
      }}
    >
      {children}
    </Tabs.List>
  )
}
