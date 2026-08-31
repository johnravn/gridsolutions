import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  LOAD_MORE_STALL_MS,
  useVirtualIndexTable,
} from './useVirtualIndexTable'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number }) => ({
    getVirtualItems: () => [],
    getTotalSize: () => opts.count * 44,
    options: opts,
  }),
}))

function virtualCount(result: {
  current: { rowVirtualizer: unknown }
}): number {
  return (result.current.rowVirtualizer as { options: { count: number } })
    .options.count
}

describe('useVirtualIndexTable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds loader row to virtualizer count when hasNextPage', () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    const { result } = renderHook(() =>
      useVirtualIndexTable({
        rows,
        getRowId: (r) => r.id,
        infinite: {
          hasNextPage: true,
          isFetchingNextPage: false,
          onLoadMore: vi.fn(),
        },
      }),
    )

    expect(virtualCount(result)).toBe(3)
  })

  it('uses row count only when no next page', () => {
    const rows = [{ id: 'a' }]
    const { result } = renderHook(() =>
      useVirtualIndexTable({
        rows,
        getRowId: (r) => r.id,
      }),
    )

    expect(virtualCount(result)).toBe(1)
  })

  it('drops the loader row if no new rows arrive within 5s', () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    const { result } = renderHook(() =>
      useVirtualIndexTable({
        rows,
        getRowId: (r) => r.id,
        infinite: {
          hasNextPage: true,
          isFetchingNextPage: true,
          onLoadMore: vi.fn(),
        },
      }),
    )

    expect(virtualCount(result)).toBe(3)

    act(() => {
      vi.advanceTimersByTime(LOAD_MORE_STALL_MS)
    })

    expect(virtualCount(result)).toBe(2)
  })

  it('keeps the loader row if more rows arrive before 5s', () => {
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useVirtualIndexTable({
          rows,
          getRowId: (r) => r.id,
          infinite: {
            hasNextPage: true,
            isFetchingNextPage: false,
            onLoadMore: vi.fn(),
          },
        }),
      { initialProps: { rows: [{ id: 'a' }] } },
    )

    act(() => {
      vi.advanceTimersByTime(LOAD_MORE_STALL_MS - 1)
    })
    expect(virtualCount(result)).toBe(2)

    rerender({ rows: [{ id: 'a' }, { id: 'b' }] })

    act(() => {
      vi.advanceTimersByTime(LOAD_MORE_STALL_MS - 1)
    })
    expect(virtualCount(result)).toBe(3)
  })
})
