import { describe, expect, it } from 'vitest'
import { errorMessage, isNotFoundQueryError } from './errorMessage'

describe('errorMessage', () => {
  it('reads Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('reads plain object message', () => {
    expect(errorMessage({ message: 'nope' })).toBe('nope')
  })

  it('falls back when empty', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback')
  })
})

describe('isNotFoundQueryError', () => {
  it('detects PostgREST missing-row style messages', () => {
    expect(isNotFoundQueryError({ message: 'PGRST116' })).toBe(true)
    expect(isNotFoundQueryError({ message: 'other' })).toBe(false)
  })
})
