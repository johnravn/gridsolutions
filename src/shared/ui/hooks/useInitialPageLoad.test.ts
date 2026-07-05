import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInitialPageLoad } from './useInitialPageLoad'

describe('useInitialPageLoad', () => {
  it('returns true only on the first loading cycle', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useInitialPageLoad(isLoading),
      { initialProps: { isLoading: true } },
    )

    expect(result.current).toBe(true)

    rerender({ isLoading: false })
    expect(result.current).toBe(false)

    rerender({ isLoading: true })
    expect(result.current).toBe(false)
  })
})
