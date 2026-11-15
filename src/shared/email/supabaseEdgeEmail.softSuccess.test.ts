import { describe, expect, it } from 'vitest'
import { softSuccessDeliveryFailure } from './supabaseEdgeEmail'

describe('softSuccessDeliveryFailure', () => {
  it('returns null for real delivery / already_sent', () => {
    expect(
      softSuccessDeliveryFailure({ ok: true, email_sent: true }),
    ).toBeNull()
    expect(
      softSuccessDeliveryFailure({ ok: true, already_sent: true }),
    ).toBeNull()
    expect(softSuccessDeliveryFailure(null)).toBeNull()
  })

  it('fails closed on dry_run', () => {
    const f = softSuccessDeliveryFailure({ ok: true, dry_run: true })
    expect(f?.message).toMatch(/RESEND_DRY_RUN/)
  })

  it('fails closed on skipped recipients / prefs', () => {
    const test = softSuccessDeliveryFailure({
      ok: true,
      skipped: 'test_recipient',
    })
    expect(test?.message).toMatch(/test_recipient/)
    expect(test?.details).toMatch(/test\/demo/i)

    const prefs = softSuccessDeliveryFailure({
      ok: true,
      skipped: 'preferences',
    })
    expect(prefs?.message).toMatch(/preferences/)
  })
})
