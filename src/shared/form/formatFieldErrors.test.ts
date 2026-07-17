import { describe, expect, it } from 'vitest'
import { formatFieldErrors } from './formatFieldErrors'

describe('formatFieldErrors', () => {
  it('joins string errors', () => {
    expect(formatFieldErrors(['Required', 'Too short'])).toBe(
      'Required, Too short',
    )
  })

  it('extracts message from Standard Schema issue objects', () => {
    expect(
      formatFieldErrors([{ message: 'Name is required' }, { message: 'Nope' }]),
    ).toBe('Name is required, Nope')
  })

  it('ignores empty and unknown shapes', () => {
    expect(formatFieldErrors([null, 42, { message: 'Keep' }])).toBe('Keep')
  })
})
