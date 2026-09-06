import { describe, expect, it } from 'vitest'
import type { JobOffer } from '../types'
import {
  buildBookingsForInvoiceSendPayload,
  offerToBookingsForInvoice,
} from './invoiceSendPayload'
import { MONEY_PIPELINE, moneyPipelineExpected } from './moneyPipeline.fixture'

describe('invoiceSendPayload', () => {
  it('summary path is one line at total_after_discount', () => {
    const offer = {
      id: MONEY_PIPELINE.offerId,
      total_after_discount: moneyPipelineExpected.totalAfterDiscount,
      total_with_vat: moneyPipelineExpected.totalWithVat,
      vat_percent: MONEY_PIPELINE.vatPercent,
      title: 'Money pipeline',
      version_number: 1,
      offer_type: 'technical',
    } as JobOffer

    const bookings = offerToBookingsForInvoice(offer)
    expect(bookings.all).toHaveLength(1)
    expect(bookings.all[0]?.unitPrice).toBe(
      moneyPipelineExpected.totalAfterDiscount,
    )
    expect(bookings.totalWithVat).toBe(moneyPipelineExpected.totalWithVat)

    const send = buildBookingsForInvoiceSendPayload(
      bookings,
      bookings.all,
      {},
      true,
    )
    expect(send.all).toHaveLength(1)
    expect(send.totalExVat).toBe(moneyPipelineExpected.totalAfterDiscount)
    expect(send.totalWithVat).toBe(moneyPipelineExpected.totalWithVat)
  })
})
