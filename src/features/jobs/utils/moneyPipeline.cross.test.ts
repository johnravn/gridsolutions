import { describe, expect, it } from 'vitest'
import { mapBookingsToContaInvoiceLines } from '../api/createContaInvoice'
import {
  calculateOfferTotalsFromStoredLines,
  roundMoney,
} from './offerCalculations'
import { offerInvoiceTotalMismatch } from './invoiceMoney'
import {
  equipmentDiscountOverridesFromOffer,
  offerLinesToBookings,
} from './offerLinesToBookings'
import {
  buildBookingsForInvoiceSendPayload,
  offerToBookingsForInvoice,
} from './invoiceSendPayload'
import { priceEquipmentBookingLine } from './bookingsInvoicePricing'
import {
  MONEY_PIPELINE,
  moneyPipelineExpected,
  moneyPipelineOfferEquipmentItem,
} from './moneyPipeline.fixture'
import type { OfferDetail, JobOffer } from '../types'

function fixtureOfferDetail(): OfferDetail {
  const item = moneyPipelineOfferEquipmentItem()
  return {
    id: MONEY_PIPELINE.offerId,
    job_id: MONEY_PIPELINE.jobId,
    company_id: '11111111-1111-4111-8111-111111111111',
    offer_basis_id: 'money-pipeline-basis-1',
    offer_type: 'technical',
    version_number: 1,
    status: 'accepted',
    access_token: 'money-pipeline-token',
    title: 'Money pipeline offer',
    days_of_use: MONEY_PIPELINE.daysOfUse,
    discount_percent: MONEY_PIPELINE.discountPercent,
    vat_percent: MONEY_PIPELINE.vatPercent,
    equipment_subtotal: moneyPipelineExpected.equipmentSubtotal,
    crew_subtotal: 0,
    transport_subtotal: 0,
    total_before_discount: moneyPipelineExpected.totalBeforeDiscount,
    total_after_discount: moneyPipelineExpected.totalAfterDiscount,
    total_with_vat: moneyPipelineExpected.totalWithVat,
    locked: true,
    show_price_per_line: true,
    job_title: 'Money pipeline job',
    groups: [
      {
        id: 'money-pipeline-group-1',
        offer_basis_id: 'money-pipeline-basis-1',
        group_name: 'Audio',
        sort_order: 0,
        items: [item as OfferDetail['groups'][0]['items'][0]],
      },
    ],
    crew_items: [],
    transport_items: [],
    transport_groups: [],
  } as OfferDetail
}

function fixtureJobOffer(): JobOffer {
  return {
    id: MONEY_PIPELINE.offerId,
    job_id: MONEY_PIPELINE.jobId,
    company_id: '11111111-1111-4111-8111-111111111111',
    offer_basis_id: 'money-pipeline-basis-1',
    offer_type: 'technical',
    version_number: 1,
    status: 'accepted',
    access_token: 'money-pipeline-token',
    title: 'Money pipeline offer',
    days_of_use: MONEY_PIPELINE.daysOfUse,
    discount_percent: MONEY_PIPELINE.discountPercent,
    vat_percent: MONEY_PIPELINE.vatPercent,
    equipment_subtotal: moneyPipelineExpected.equipmentSubtotal,
    crew_subtotal: 0,
    transport_subtotal: 0,
    total_before_discount: moneyPipelineExpected.totalBeforeDiscount,
    total_after_discount: moneyPipelineExpected.totalAfterDiscount,
    total_with_vat: moneyPipelineExpected.totalWithVat,
    locked: true,
    show_price_per_line: true,
  } as JobOffer
}

describe('money pipeline cross-builders', () => {
  it('priceEquipmentBookingLine matches equipment line total', () => {
    const priced = priceEquipmentBookingLine({
      dailyUnitPrice: MONEY_PIPELINE.dailyUnitPrice,
      quantity: MONEY_PIPELINE.quantity,
      daysOfUse: MONEY_PIPELINE.daysOfUse,
    })
    expect(priced.totalPrice).toBe(
      moneyPipelineExpected.equipmentLineTotalPrice,
    )
  })

  it('calculateOfferTotalsFromStoredLines matches fixture', () => {
    const item = moneyPipelineOfferEquipmentItem()
    const totals = calculateOfferTotalsFromStoredLines(
      [item],
      [],
      [],
      MONEY_PIPELINE.daysOfUse,
      MONEY_PIPELINE.discountPercent,
      MONEY_PIPELINE.vatPercent,
    )
    expect(totals.totalAfterDiscount).toBe(
      moneyPipelineExpected.totalAfterDiscount,
    )
    expect(totals.totalWithVAT).toBe(moneyPipelineExpected.totalWithVat)
  })

  it('offerLinesToBookings + discount overrides match accepted offer totals', () => {
    const detail = fixtureOfferDetail()
    const expanded = offerLinesToBookings(detail)
    const overrides = equipmentDiscountOverridesFromOffer(detail)
    expect(expanded.all).toHaveLength(1)
    expect(expanded.all[0]?.totalPrice).toBe(
      moneyPipelineExpected.equipmentLineTotalPrice,
    )
    expect(overrides[MONEY_PIPELINE.equipmentItemId]).toBe(
      MONEY_PIPELINE.discountPercent,
    )

    const send = buildBookingsForInvoiceSendPayload(
      expanded,
      expanded.all,
      overrides,
      true,
    )
    expect(roundMoney(send.totalExVat)).toBe(
      moneyPipelineExpected.totalAfterDiscount,
    )
    expect(roundMoney(send.totalWithVat)).toBe(
      moneyPipelineExpected.totalWithVat,
    )
    expect(
      offerInvoiceTotalMismatch(
        send.totalExVat,
        moneyPipelineExpected.totalAfterDiscount,
      ).differs,
    ).toBe(false)
  })

  it('summary and expanded send payloads share the same grand total', () => {
    const offer = fixtureJobOffer()
    const detail = fixtureOfferDetail()
    const summary = offerToBookingsForInvoice(offer)
    const summarySend = buildBookingsForInvoiceSendPayload(
      summary,
      summary.all,
      {},
      true,
    )

    const expanded = offerLinesToBookings(detail)
    const overrides = equipmentDiscountOverridesFromOffer(detail)
    const expandedSend = buildBookingsForInvoiceSendPayload(
      expanded,
      expanded.all,
      overrides,
      true,
    )

    expect(roundMoney(summarySend.totalExVat)).toBe(
      roundMoney(expandedSend.totalExVat),
    )
    expect(roundMoney(summarySend.totalWithVat)).toBe(
      roundMoney(expandedSend.totalWithVat),
    )
    expect(summarySend.all).toHaveLength(1)
    expect(expandedSend.all).toHaveLength(1)
    expect(summarySend.all[0]?.id).toBe(MONEY_PIPELINE.offerId)
    expect(expandedSend.all[0]?.id).toBe(MONEY_PIPELINE.equipmentItemId)
    expect(expandedSend.all[0]?.unitPrice).toBe(
      moneyPipelineExpected.expandedLine.unitPrice,
    )
    expect(summarySend.all[0]?.unitPrice).toBe(
      moneyPipelineExpected.totalAfterDiscount,
    )
  })

  it('mapBookingsToContaInvoiceLines preserves expanded net amounts', () => {
    const detail = fixtureOfferDetail()
    const expanded = offerLinesToBookings(detail)
    const overrides = equipmentDiscountOverridesFromOffer(detail)
    const send = buildBookingsForInvoiceSendPayload(
      expanded,
      expanded.all,
      overrides,
      true,
    )
    const contaLines = mapBookingsToContaInvoiceLines(send.all, overrides)
    expect(contaLines).toHaveLength(1)
    const line = contaLines[0]!
    expect(line.quantity).toBe(MONEY_PIPELINE.quantity)
    expect(line.discount).toBe(MONEY_PIPELINE.discountPercent)
    // Conta price is unit price; net = price * qty * (1 - discount/100)
    const net = roundMoney(
      line.price * line.quantity * (1 - (line.discount ?? 0) / 100),
    )
    expect(net).toBe(moneyPipelineExpected.totalAfterDiscount)
  })
})
