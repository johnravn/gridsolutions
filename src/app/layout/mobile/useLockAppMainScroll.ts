import * as React from 'react'

const LOCK_CLASS = 'app-main-scroll--inspector-locked'

const OVERLAY_SCROLL_SELECTOR =
  '.app-bottom-drawer, .app-inspector-drawer, .app-sidebar-drawer'

export function isScrollableY(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el)
  if (
    overflowY !== 'auto' &&
    overflowY !== 'scroll' &&
    overflowY !== 'overlay'
  ) {
    return false
  }
  return el.scrollHeight > el.clientHeight + 1
}

/** Allow touchmove only when it can scroll an open overlay, not the page behind. */
export function shouldAllowOverlayTouchMove(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false
  const overlay = target.closest(OVERLAY_SCROLL_SELECTOR)
  if (!(overlay instanceof HTMLElement)) return false

  let node: Element | null = target
  while (node) {
    if (node instanceof HTMLElement && isScrollableY(node)) return true
    if (node === overlay) break
    node = node.parentElement
  }
  return false
}

/** Locks AppShell main scroll without competing with the nav drawer's lock class. */
export function useLockAppMainScroll(
  locked: boolean,
  containBackgroundTouch = false,
) {
  React.useEffect(() => {
    const el = document.querySelector('.app-main-scroll')
    if (!(el instanceof HTMLElement)) return

    if (locked) el.classList.add(LOCK_CLASS)
    else el.classList.remove(LOCK_CLASS)

    return () => {
      el.classList.remove(LOCK_CLASS)
    }
  }, [locked])

  React.useEffect(() => {
    if (!locked || !containBackgroundTouch) return

    const onTouchMove = (event: TouchEvent) => {
      if (shouldAllowOverlayTouchMove(event.target)) return
      event.preventDefault()
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', onTouchMove)
  }, [locked, containBackgroundTouch])
}
