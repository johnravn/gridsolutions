import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MobileNavProvider } from './MobileNavContext'
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

  it('keeps the inspector and nav menu mutually exclusive', () => {
    let setNavOpen: React.Dispatch<React.SetStateAction<boolean>> = () => {}
    let navOpenValue = false

    function Wrapper({ children }: { children: React.ReactNode }) {
      const [navOpen, setNavOpenState] = React.useState(false)
      setNavOpen = setNavOpenState
      navOpenValue = navOpen
      return React.createElement(
        MobileNavProvider,
        { navOpen, setNavOpen: setNavOpenState },
        children,
      )
    }

    const { result } = renderHook(() => useMobileInspectorDrawer(false), {
      wrapper: Wrapper,
    })

    act(() => {
      result.current.openDrawer()
    })
    expect(result.current.drawerOpen).toBe(true)
    expect(navOpenValue).toBe(false)

    act(() => {
      setNavOpen(true)
    })
    expect(result.current.drawerOpen).toBe(false)
    expect(navOpenValue).toBe(true)

    act(() => {
      result.current.openDrawer()
    })
    expect(result.current.drawerOpen).toBe(true)
    expect(navOpenValue).toBe(false)
  })
})
