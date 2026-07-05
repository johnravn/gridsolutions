import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useClientTableFilter } from './useClientTableFilter'

const rows = [
  { id: '1', name: 'Alpha microphone' },
  { id: '2', name: 'Bravo speaker' },
  { id: '3', name: 'Charlie cable' },
]

const fields = [(r: (typeof rows)[number]) => r.name]

describe('useClientTableFilter', () => {
  it('returns all rows when search is empty', () => {
    const { result } = renderHook(() => useClientTableFilter(rows, '', fields))
    expect(result.current).toHaveLength(3)
  })

  it('filters rows with fuzzy search', () => {
    const { result } = renderHook(() =>
      useClientTableFilter(rows, 'mic', fields),
    )
    expect(result.current.map((r) => r.id)).toEqual(['1'])
  })
})
