import { describe, expect, it } from 'vitest'
import {
  buildCrewRateAutofillPreview,
  buildFixedAutofillPreview,
  fixedAutofillSourceId,
  previewLinesToInserts,
} from './seriesAccountingAutofill'

describe('buildFixedAutofillPreview', () => {
  it('plans inserts for each job and skips existing source_ids by default', () => {
    const preview = buildFixedAutofillPreview({
      jobIds: ['a', 'b'],
      jobDates: new Map([
        ['a', '2026-01-01T10:00:00Z'],
        ['b', '2026-02-01T10:00:00Z'],
      ]),
      lines: [
        {
          key: '1',
          type: 'expense',
          description: 'Crew package',
          amount: 5000,
        },
      ],
      existingItems: [
        {
          id: 'item-1',
          job_id: 'a',
          source_id: fixedAutofillSourceId('1'),
        },
      ],
      replaceMatching: false,
    })

    expect(preview.lines).toHaveLength(2)
    expect(preview.insertCount).toBe(1)
    expect(preview.skipCount).toBe(1)
    expect(preview.replaceCount).toBe(0)
    expect(preview.lines.find((l) => l.job_id === 'a')?.action).toBe('skip')
    expect(preview.lines.find((l) => l.job_id === 'b')?.action).toBe('insert')
  })

  it('marks replace when replaceMatching is on', () => {
    const preview = buildFixedAutofillPreview({
      jobIds: ['a'],
      jobDates: new Map([['a', null]]),
      lines: [
        { key: 'x', type: 'income', description: 'Flat fee', amount: 1000 },
      ],
      existingItems: [
        { id: 'old', job_id: 'a', source_id: fixedAutofillSourceId('x') },
      ],
      replaceMatching: true,
    })
    expect(preview.replaceCount).toBe(1)
    expect(preview.lines[0]?.existing_item_id).toBe('old')
  })
})

describe('buildCrewRateAutofillPreview', () => {
  it('builds crew expense lines from booking rates', () => {
    const preview = buildCrewRateAutofillPreview({
      jobIds: ['job-1'],
      bookings: [
        {
          id: 'booking-1',
          job_id: 'job-1',
          user_name: 'Alex',
          role: 'freelancer',
          rate: 500,
          rate_type: 'hourly',
          vat_number: null,
          start_at: '2026-03-01T08:00:00Z',
          end_at: '2026-03-01T12:00:00Z',
        },
      ],
      companyRates: null,
      billingUnit: 'hour',
      existingItems: [],
      replaceMatching: false,
    })

    expect(preview.insertCount).toBe(1)
    expect(preview.lines[0]?.source).toBe('crew')
    expect(preview.lines[0]?.amount).toBe(2000)
    expect(preview.lines[0]?.source_id).toBe('crew-booking-1')
  })

  it('skips jobs with no computable rate', () => {
    const preview = buildCrewRateAutofillPreview({
      jobIds: ['job-1'],
      bookings: [
        {
          id: 'booking-1',
          job_id: 'job-1',
          user_name: 'Alex',
          role: 'employee',
          rate: null,
          rate_type: null,
          vat_number: null,
          start_at: '2026-03-01T08:00:00Z',
          end_at: '2026-03-01T12:00:00Z',
        },
      ],
      companyRates: null,
      billingUnit: 'hour',
      existingItems: [],
      replaceMatching: false,
    })
    expect(preview.lines).toHaveLength(0)
  })
})

describe('previewLinesToInserts', () => {
  it('collects deletes for replace and inserts for write actions', () => {
    const { deletes, inserts } = previewLinesToInserts(
      [
        {
          job_id: 'a',
          description: 'Keep skip',
          type: 'expense',
          amount: 1,
          date: null,
          source: 'manual',
          source_id: 's1',
          category: 'other',
          action: 'skip',
        },
        {
          job_id: 'a',
          description: 'Replace me',
          type: 'expense',
          amount: 2,
          date: null,
          source: 'manual',
          source_id: 's2',
          category: 'other',
          action: 'replace',
          existing_item_id: 'old-2',
        },
        {
          job_id: 'b',
          description: 'New',
          type: 'income',
          amount: 3,
          date: null,
          source: 'crew',
          source_id: 's3',
          category: 'crew',
          action: 'insert',
        },
      ],
      'co-1',
    )

    expect(deletes).toEqual(['old-2'])
    expect(inserts).toHaveLength(2)
    expect(inserts[0]?.company_id).toBe('co-1')
  })
})
