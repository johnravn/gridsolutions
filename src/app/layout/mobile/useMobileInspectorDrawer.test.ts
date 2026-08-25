import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMobileInspectorDrawer } from './useMobileInspectorDrawer'

describe('useMobileInspectorDrawer', () => {
  it('opens, toggles, and closes while keeping the setter', () => {
    const { result } = renderHook(() => useMobileInspectorDrawer(false))

    expect(result.current.drawerOpen).toBe(false)

    act(() => {
      result.current.openDrawer()
    })
    expect(result.current.drawerOpen).toBe(true)

    act(() => {
      result.current.toggleDrawer()
    })
    expect(result.current.drawerOpen).toBe(false)

    act(() => {
      result.current.setDrawerOpen(true)
    })
    expect(result.current.drawerOpen).toBe(true)

    act(() => {
      result.current.closeDrawer()
    })
    expect(result.current.drawerOpen).toBe(false)
  })

  it('closes when the layout becomes large', () => {
    const { result, rerender } = renderHook(
      ({ isLarge }: { isLarge: boolean }) => useMobileInspectorDrawer(isLarge),
      { initialProps: { isLarge: false } },
    )

    act(() => {
      result.current.openDrawer()
    })
    expect(result.current.drawerOpen).toBe(true)

    rerender({ isLarge: true })
    expect(result.current.drawerOpen).toBe(false)
  })
})
