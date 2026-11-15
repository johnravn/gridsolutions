import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLocalSplitPane } from './useLocalSplitPane'

describe('useLocalSplitPane', () => {
  it('starts at the default width and expands from minimized', () => {
    const { result } = renderHook(() =>
      useLocalSplitPane({ defaultWidthPercent: 40 }),
    )
    expect(result.current.leftWidth).toBe(40)
    expect(result.current.isMinimized).toBe(false)

    act(() => {
      result.current.toggleMinimize()
    })
    expect(result.current.isMinimized).toBe(true)

    act(() => {
      result.current.expandFromBar()
    })
    expect(result.current.isMinimized).toBe(false)
    expect(result.current.leftWidth).toBe(40)
  })

  it('restores the pre-minimize width on toggle', () => {
    const { result } = renderHook(() =>
      useLocalSplitPane({ defaultWidthPercent: 50 }),
    )

    act(() => {
      result.current.beginResize()
    })
    // Width is only changed via drag listeners; toggle uses current leftWidth.
    act(() => {
      result.current.toggleMinimize()
    })
    expect(result.current.isMinimized).toBe(true)
    act(() => {
      result.current.toggleMinimize()
    })
    expect(result.current.isMinimized).toBe(false)
    expect(result.current.leftWidth).toBe(50)
  })
})
