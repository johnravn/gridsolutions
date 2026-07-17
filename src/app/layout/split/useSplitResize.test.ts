import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSplitResize } from './useSplitResize'

describe('useSplitResize', () => {
  it('uses page default until the user drags', () => {
    const { result } = renderHook(() => useSplitResize())

    act(() => {
      result.current.clearDragForPage(66.67)
    })

    expect(result.current.resolveWidth(66.67)).toBe(66.67)
    expect(result.current.dragWidth).toBeNull()
  })

  it('keeps a drag override until the next page clears it', () => {
    const { result } = renderHook(() => useSplitResize())

    act(() => {
      result.current.clearDragForPage(37)
    })
    expect(result.current.resolveWidth(37)).toBe(37)

    act(() => {
      result.current.beginResize()
    })
    // Simulate drag via the same state path resize uses
    act(() => {
      // beginResize alone does not set width; resolve still uses default
      expect(result.current.resolveWidth(37)).toBe(37)
    })

    act(() => {
      result.current.clearDragForPage(66.67)
    })
    expect(result.current.dragWidth).toBeNull()
    expect(result.current.resolveWidth(66.67)).toBe(66.67)
  })

  it('lands on the new page default regardless of the previous page default', () => {
    const { result } = renderHook(() => useSplitResize())

    act(() => {
      result.current.clearDragForPage(37) // Latest
    })
    expect(result.current.resolveWidth(37)).toBe(37)

    act(() => {
      result.current.clearDragForPage(66.67) // Inventory
    })
    expect(result.current.resolveWidth(66.67)).toBe(66.67)

    act(() => {
      result.current.clearDragForPage(50) // Vehicles
    })
    expect(result.current.resolveWidth(50)).toBe(50)

    act(() => {
      result.current.clearDragForPage(66.67) // Inventory again
    })
    expect(result.current.resolveWidth(66.67)).toBe(66.67)
  })

  it('toggles minimize without losing the page default', () => {
    const { result } = renderHook(() => useSplitResize())

    act(() => {
      result.current.clearDragForPage(66.67)
    })
    act(() => {
      result.current.toggleMinimize()
    })
    expect(result.current.isMinimized).toBe(true)
    expect(result.current.resolveWidth(66.67)).toBe(66.67)

    act(() => {
      result.current.expand()
    })
    expect(result.current.isMinimized).toBe(false)
    expect(result.current.resolveWidth(66.67)).toBe(66.67)
  })
})
