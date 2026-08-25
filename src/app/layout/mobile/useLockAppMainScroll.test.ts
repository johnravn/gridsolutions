import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLockAppMainScroll } from './useLockAppMainScroll'

describe('useLockAppMainScroll', () => {
  it('toggles the inspector lock class on the main scroll element', () => {
    const el = document.createElement('div')
    el.className = 'app-main-scroll'
    document.body.appendChild(el)

    const { rerender, unmount } = renderHook(
      ({ locked }: { locked: boolean }) => useLockAppMainScroll(locked),
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
})
