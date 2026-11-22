import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useElementMinWidth } from './useElementMinWidth'

class ResizeObserverStub {
  private callback: ResizeObserverCallback
  static instances: ResizeObserverStub[] = []

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverStub.instances.push(this)
  }

  observe(_target: Element) {}
  unobserve(_target: Element) {}
  disconnect() {}

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

describe('useElementMinWidth', () => {
  beforeEach(() => {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is false until the element reaches minWidthPx', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => 500,
    })
    const ref = { current: el }

    const { result, rerender } = renderHook(
      ({ min }) => useElementMinWidth(ref, min),
      { initialProps: { min: 960 } },
    )

    expect(result.current).toBe(false)

    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => 960,
    })
    act(() => {
      ResizeObserverStub.instances[0]?.trigger()
    })
    rerender({ min: 960 })

    expect(result.current).toBe(true)
  })

  it('updates when minWidthPx changes', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => 900,
    })
    const ref = { current: el }

    const { result, rerender } = renderHook(
      ({ min }) => useElementMinWidth(ref, min),
      { initialProps: { min: 960 } },
    )

    expect(result.current).toBe(false)

    rerender({ min: 800 })
    expect(result.current).toBe(true)
  })
})
