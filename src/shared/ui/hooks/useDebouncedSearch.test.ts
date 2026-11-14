import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedSearch } from './useDebouncedSearch'

describe('useDebouncedSearch', () => {
  it('exposes live search immediately and marks pending until debounce settles', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDebouncedSearch('', 300))

    expect(result.current.search).toBe('')
    expect(result.current.debouncedSearch).toBe('')
    expect(result.current.isPending).toBe(false)

    act(() => {
      result.current.setSearch('mic')
    })

    expect(result.current.search).toBe('mic')
    expect(result.current.isPending).toBe(true)

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.debouncedSearch).toBe('mic')
    expect(result.current.isPending).toBe(false)
    vi.useRealTimers()
  })
})
