import { describe, expect, it } from 'vitest'
import {
  TRANSPORT_KM_SOURCE_ID,
  computeTransportKmExpenseAmount,
  resolveTransportCostPerKm,
  transportKmExpenseDescription,
} from './transportKmExpense'

describe('TRANSPORT_KM_SOURCE_ID', () => {
  it('matches suggestion sourceId for dedupe', () => {
    expect(TRANSPORT_KM_SOURCE_ID).toBe('transport-km')
  })
})

describe('computeTransportKmExpenseAmount', () => {
  it('uses company rate', () => {
    expect(computeTransportKmExpenseAmount(40, 3.5)).toBe(140)
  })

  it('falls back to default 5 kr/km', () => {
    expect(computeTransportKmExpenseAmount(20, null)).toBe(100)
  })

  it('returns null for missing or zero km', () => {
    expect(computeTransportKmExpenseAmount(null, 5)).toBeNull()
    expect(computeTransportKmExpenseAmount(0, 5)).toBeNull()
  })
})

describe('transportKmExpenseDescription', () => {
  it('includes km and rate', () => {
    expect(transportKmExpenseDescription(120, 5)).toBe(
      'Transport (120 km × 5 kr/km)',
    )
  })
})

describe('resolveTransportCostPerKm', () => {
  it('prefers company rate', () => {
    expect(resolveTransportCostPerKm(4)).toBe(4)
  })

  it('defaults to 5', () => {
    expect(resolveTransportCostPerKm(null)).toBe(5)
  })
})
