import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { applySortDir, useClientSort } from './useClientSort'

describe('useClientSort', () => {
  it('toggles direction when same column is clicked', () => {
    const { result } = renderHook(() => useClientSort<'name'>('name', 'asc'))

    act(() => result.current.handleSort('name'))
    expect(result.current.sortDir).toBe('desc')

    act(() => result.current.handleSort('name'))
    expect(result.current.sortDir).toBe('asc')
  })

  it('switches column and resets to asc', () => {
    const { result } = renderHook(() =>
      useClientSort<'name' | 'email'>('name', 'desc'),
    )

    act(() => result.current.handleSort('email'))
    expect(result.current.sortBy).toBe('email')
    expect(result.current.sortDir).toBe('asc')
  })
})

describe('applySortDir', () => {
  it('inverts comparison for desc', () => {
    expect(applySortDir(-1, 'asc')).toBe(-1)
    expect(applySortDir(-1, 'desc')).toBe(1)
  })
})
