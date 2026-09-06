import { describe, expect, it } from 'vitest'
import {
  MONEY_PIPELINE,
  moneyPipelineCalculateOfferTotals,
  moneyPipelineExpected,
} from './moneyPipeline.fixture'

describe('moneyPipeline fixture', () => {
  it('uses rental factor 2.0 for 3 days', () => {
    expect(moneyPipelineExpected.rentalFactor).toBe(2)
  })

  it('matches calculateOfferTotals for the equipment-only scenario', () => {
    const totals = moneyPipelineCalculateOfferTotals()
    expect(totals.equipmentSubtotal).toBe(
      moneyPipelineExpected.equipmentSubtotal,
    )
    expect(totals.totalAfterDiscount).toBe(
      moneyPipelineExpected.totalAfterDiscount,
    )
    expect(totals.totalWithVAT).toBe(moneyPipelineExpected.totalWithVat)
    expect(totals.discountPercent).toBe(MONEY_PIPELINE.discountPercent)
    expect(totals.vatPercent).toBe(MONEY_PIPELINE.vatPercent)
  })

  it('expanded line nets to totalAfterDiscount after equipment discount', () => {
    expect(moneyPipelineExpected.expandedLine.netAfterDiscount).toBe(
      moneyPipelineExpected.totalAfterDiscount,
    )
    expect(moneyPipelineExpected.expandedLine.totalPrice).toBe(
      moneyPipelineExpected.equipmentLineTotalPrice,
    )
  })
})
