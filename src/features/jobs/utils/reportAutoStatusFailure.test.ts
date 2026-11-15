import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  autoStatusFailureMessage,
  reportAutoStatusFailure,
  resetAutoStatusFailureThrottleForTests,
} from './reportAutoStatusFailure'

describe('reportAutoStatusFailure', () => {
  afterEach(() => {
    resetAutoStatusFailureThrottleForTests()
    vi.restoreAllMocks()
  })

  it('formats error messages', () => {
    expect(autoStatusFailureMessage(new Error('boom'))).toBe('boom')
    expect(autoStatusFailureMessage({ message: 'rpc failed' })).toBe(
      'rpc failed',
    )
    expect(autoStatusFailureMessage('x')).toBe('Will retry shortly.')
  })

  it('logs and throttles toasts', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const toast = vi.fn()

    reportAutoStatusFailure('detail', new Error('first'), toast)
    reportAutoStatusFailure('detail', new Error('second'), toast)

    expect(errorSpy).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      'Couldn’t auto-update job status',
      'first',
    )
  })
})
