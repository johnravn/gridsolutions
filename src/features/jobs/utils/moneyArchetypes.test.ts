import { describe, expect, it } from 'vitest'
import {
  buildMoneyCompletenessHints,
  buildSubcontractorQuoteSuggestions,
  detectMoneyArchetype,
  filterHighConfidenceSuggestions,
  latestQuotesBySubcontractor,
  sumOfferTransportKm,
} from './moneyArchetypes'
import type { MoneySuggestion } from './moneySuggestions'

describe('sumOfferTransportKm', () => {
  it('sums positive distances', () => {
    expect(
      sumOfferTransportKm([
        { distance_km: 100 },
        { distance_km: 50 },
        { distance_km: null },
      ]),
    ).toBe(150)
  })

  it('returns null when nothing positive', () => {
    expect(
      sumOfferTransportKm([{ distance_km: 0 }, { distance_km: null }]),
    ).toBe(null)
  })
})

describe('detectMoneyArchetype', () => {
  it('detects internal equipment', () => {
    expect(
      detectMoneyArchetype({
        crewBookingCount: 0,
        stockEquipmentCount: 5,
        subrentalEquipmentCount: 0,
        hasSubcontractors: false,
        hasSubcontractorQuotes: false,
        transportBookingCount: 0,
        plannedOfferKm: null,
        transportKmDriven: null,
      }),
    ).toBe('internal_equipment')
  })

  it('detects crew', () => {
    expect(
      detectMoneyArchetype({
        crewBookingCount: 3,
        stockEquipmentCount: 0,
        subrentalEquipmentCount: 0,
        hasSubcontractors: false,
        hasSubcontractorQuotes: false,
        transportBookingCount: 0,
        plannedOfferKm: null,
        transportKmDriven: null,
      }),
    ).toBe('crew')
  })

  it('detects mixed with subrental', () => {
    expect(
      detectMoneyArchetype({
        crewBookingCount: 2,
        stockEquipmentCount: 1,
        subrentalEquipmentCount: 2,
        hasSubcontractors: true,
        hasSubcontractorQuotes: true,
        transportBookingCount: 0,
        plannedOfferKm: null,
        transportKmDriven: null,
      }),
    ).toBe('mixed')
  })

  it('detects transport-heavy when transport dominates', () => {
    expect(
      detectMoneyArchetype({
        crewBookingCount: 0,
        stockEquipmentCount: 0,
        subrentalEquipmentCount: 0,
        hasSubcontractors: false,
        hasSubcontractorQuotes: false,
        transportBookingCount: 2,
        plannedOfferKm: 200,
        transportKmDriven: null,
      }),
    ).toBe('transport_heavy')
  })
})

describe('latestQuotesBySubcontractor', () => {
  it('keeps first (highest version) per subcontractor', () => {
    const latest = latestQuotesBySubcontractor([
      {
        id: 'q2',
        job_subcontractor_id: 's1',
        version_number: 2,
        total_amount: 200,
        created_at: 'b',
      },
      {
        id: 'q1',
        job_subcontractor_id: 's1',
        version_number: 1,
        total_amount: 100,
        created_at: 'a',
      },
      {
        id: 'q3',
        job_subcontractor_id: 's2',
        version_number: 1,
        total_amount: 50,
        created_at: 'c',
      },
    ])
    expect(latest.map((q) => q.id)).toEqual(['q2', 'q3'])
  })
})

describe('buildSubcontractorQuoteSuggestions', () => {
  it('builds equipment expenses', () => {
    const suggestions = buildSubcontractorQuoteSuggestions({
      quotes: [
        {
          id: 'q1',
          job_subcontractor_id: 's1',
          version_number: 1,
          total_amount: 1500,
          created_at: '2026-01-01',
        },
      ],
      subcontractorNames: { s1: 'Hire Co' },
    })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      sourceId: 'quote-q1',
      category: 'equipment',
      amount: 1500,
      description: 'Hire Co — quote v1',
    })
  })
})

describe('filterHighConfidenceSuggestions', () => {
  it('excludes Conta expenses', () => {
    const list: Array<MoneySuggestion> = [
      {
        id: '1',
        sourceId: 'invoice-1',
        type: 'income',
        description: 'i',
        amount: 1,
        date: null,
        source: 'conta',
        category: 'other',
      },
      {
        id: '2',
        sourceId: 'conta-9',
        type: 'expense',
        description: 'e',
        amount: 1,
        date: null,
        source: 'conta',
        category: 'conta',
      },
      {
        id: '3',
        sourceId: 'transport-km',
        type: 'expense',
        description: 't',
        amount: 50,
        date: null,
        source: 'manual',
        category: 'transport',
      },
    ]
    expect(filterHighConfidenceSuggestions(list).map((s) => s.id)).toEqual([
      '1',
      '3',
    ])
  })
})

describe('buildMoneyCompletenessHints', () => {
  it('warns on missing income and km', () => {
    const hints = buildMoneyCompletenessHints({
      confirmed: [],
      hasPrimaryIncomeSuggestion: true,
      transportKmDriven: null,
      plannedOfferKm: 120,
      hasTransportSignal: true,
      unconfirmedHighConfidenceCount: 2,
      hasQuoteSuggestions: false,
    })
    expect(hints.map((h) => h.id)).toEqual(
      expect.arrayContaining([
        'no-income',
        'missing-km',
        'high-confidence-pending',
      ]),
    )
  })
})
