import { describe, expect, it } from 'vitest'
import type { SignInResult, SignUpResult } from './authActions'

describe('authActions contracts', () => {
  it('SignUpResult discriminates session vs confirm_email', () => {
    const session: SignUpResult = { kind: 'session', userId: 'u1' }
    const confirm: SignUpResult = { kind: 'confirm_email' }
    expect(session.kind).toBe('session')
    expect(confirm.kind).toBe('confirm_email')
  })

  it('SignInResult covers completeness gate outcomes', () => {
    const outcomes: Array<SignInResult['kind']> = [
      'complete',
      'incomplete_profile',
      'no_session',
    ]
    expect(outcomes).toHaveLength(3)
  })
})
