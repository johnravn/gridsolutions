import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVirtualIndexTable } from './useVirtualIndexTable'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number }) => ({
    getVirtualItems: () => [],
    getTotalSize: () => opts.count * 44,
    options: opts,
  }),
}))

describe('useVirtualIndexTable', () => {
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

    expect(
      (result.current.rowVirtualizer as { options: { count: number } }).options
        .count,
    ).toBe(3)
  })

  it('uses row count only when no next page', () => {
    const rows = [{ id: 'a' }]
    const { result } = renderHook(() =>
      useVirtualIndexTable({
        rows,
        getRowId: (r) => r.id,
      }),
    )

    expect(
      (result.current.rowVirtualizer as { options: { count: number } }).options
        .count,
    ).toBe(1)
  })
})
