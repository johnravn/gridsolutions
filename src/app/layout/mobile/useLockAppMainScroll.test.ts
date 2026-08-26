import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  isScrollableY,
  shouldAllowOverlayTouchMove,
  useLockAppMainScroll,
} from './useLockAppMainScroll'

describe('useLockAppMainScroll', () => {
  it('toggles the inspector lock class on the main scroll element', () => {
    const el = document.createElement('div')
    el.className = 'app-main-scroll'
    document.body.appendChild(el)

    const { rerender, unmount } = renderHook(
      ({ locked }: { locked: boolean }) => useLockAppMainScroll(locked, true),
      { initialProps: { locked: true } },
    )

    expect(el.classList.contains('app-main-scroll--inspector-locked')).toBe(
      true,
    )

    rerender({ locked: false })
    expect(el.classList.contains('app-main-scroll--inspector-locked')).toBe(
      false,
    )

    rerender({ locked: true })
    unmount()
    expect(el.classList.contains('app-main-scroll--inspector-locked')).toBe(
      false,
    )

    el.remove()
  })

  it('blocks background touchmove unless the overlay itself can scroll', () => {
    const overlay = document.createElement('aside')
    overlay.className = 'app-bottom-drawer'
    overlay.style.overflowY = 'auto'
    overlay.style.height = '80px'
    const item = document.createElement('button')
    item.style.height = '40px'
    overlay.appendChild(item)
    document.body.appendChild(overlay)

    expect(shouldAllowOverlayTouchMove(item)).toBe(false)

    const tall = document.createElement('div')
    tall.style.height = '400px'
    overlay.appendChild(tall)
    // jsdom does not layout, so force a scrollable overflow box.
    Object.defineProperty(overlay, 'scrollHeight', {
      configurable: true,
      value: 400,
    })
    Object.defineProperty(overlay, 'clientHeight', {
      configurable: true,
      value: 80,
    })
    expect(isScrollableY(overlay)).toBe(true)
    expect(shouldAllowOverlayTouchMove(item)).toBe(true)

    const body = document.createElement('div')
    body.className = 'app-bottom-drawer-body'
    body.style.overflowY = 'auto'
    overlay.appendChild(body)
    const nestedItem = document.createElement('button')
    body.appendChild(nestedItem)
    Object.defineProperty(body, 'scrollHeight', {
      configurable: true,
      value: 400,
    })
    Object.defineProperty(body, 'clientHeight', {
      configurable: true,
      value: 80,
    })
    expect(shouldAllowOverlayTouchMove(nestedItem)).toBe(true)
    expect(shouldAllowOverlayTouchMove(document.body)).toBe(false)

    overlay.remove()
  })
})
