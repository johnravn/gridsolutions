import { describe, expect, it } from 'vitest'
import type { BookingInvoiceLine } from '../api/invoiceQueries'
import {
  applyTemplatesToLines,
  buildInvoiceLineDescription,
  countChangedDescriptions,
  countLinesByScope,
  defaultDescriptionForLine,
  defaultTemplateForLineType,
} from './invoiceLineDescription'

function makeLine(
  overrides: Partial<BookingInvoiceLine> = {},
): BookingInvoiceLine {
  return {
    id: 'line-1',
    type: 'equipment',
    description: '',
    quantity: 1,
    unitPrice: 100,
    totalPrice: 100,
    vatPercent: 25,
    timePeriodId: 'tp-1',
    timePeriodTitle: 'Main period',
    startAt: '2026-01-15T08:00:00.000Z',
    endAt: '2026-01-15T18:00:00.000Z',
    brandName: 'Shure',
    model: 'SM58',
    ...overrides,
  }
}

describe('buildInvoiceLineDescription', () => {
  it('builds equipment description from brand and model', () => {
    const line = makeLine({ type: 'equipment' })
    const desc = defaultDescriptionForLine(line)
    expect(desc).toBe('Shure SM58')
  })

  it('builds group equipment description', () => {
    const line = makeLine({
      type: 'equipment',
      brandName: null,
      model: null,
      groupName: 'Wireless kit',
    })
    expect(defaultDescriptionForLine(line)).toBe('Wireless kit (Group)')
  })

  it('builds crew description matching legacy format (per hour)', () => {
    const line = makeLine({
      type: 'crew',
      unit: 'hour',
      roleLabel: 'Sound engineer',
    })
    expect(defaultDescriptionForLine(line)).toBe(
      'Crew - Sound engineer - per hour',
    )
  })

  it('builds crew description matching legacy format (per day)', () => {
    const line = makeLine({
      type: 'crew',
      unit: 'day',
      roleLabel: 'technician',
    })
    expect(defaultDescriptionForLine(line)).toBe('Crew - technician - per day')
  })

  it('builds transport description matching legacy format', () => {
    const line = makeLine({
      type: 'transport',
      vehicleName: 'Sprinter',
    })
    expect(defaultDescriptionForLine(line)).toBe(
      'Transport - Sprinter - per day',
    )
  })

  it('supports custom token order and separators', () => {
    const line = makeLine({
      jobTitle: 'Corporate event',
      jobnr: 42,
    })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [
        { kind: 'job' },
        { kind: 'custom', text: '::' },
        { kind: 'equipment' },
      ],
      separator: ' ',
    })
    expect(desc).toBe('Corporate event (#000042) :: Shure SM58')
  })

  it('includes job token with jobnr only', () => {
    const line = makeLine({ jobTitle: null, jobnr: 7 })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'job' }],
    })
    expect(desc).toBe('#000007')
  })

  it('skips empty token values', () => {
    const line = makeLine({ timePeriodTitle: null })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'timePeriod' }, { kind: 'equipment' }],
    })
    expect(desc).toBe('Shure SM58')
  })
})

describe('applyTemplatesToLines', () => {
  it('respects manual overrides', () => {
    const line = makeLine({ description: 'Manual edit' })
    const result = applyTemplatesToLines([line], {}, new Set([line.id]))
    expect(result[0].description).toBe('Manual edit')
  })

  it('applies scope filter', () => {
    const equipment = makeLine({ type: 'equipment', description: 'old' })
    const crew = makeLine({
      type: 'crew',
      roleLabel: 'LD',
      unit: 'day',
      description: 'old crew',
    })
    const result = applyTemplatesToLines(
      [equipment, crew],
      {},
      new Set(),
      'crew',
    )
    expect(result[0].description).toBe('old')
    expect(result[1].description).toBe('Crew - LD - per day')
  })
})

describe('countLinesByScope / countChangedDescriptions', () => {
  it('counts affectable lines by scope excluding overrides', () => {
    const equipment = makeLine({ id: 'e1', type: 'equipment' })
    const crew = makeLine({ id: 'c1', type: 'crew', roleLabel: 'LD' })
    const transport = makeLine({
      id: 't1',
      type: 'transport',
      vehicleName: 'Van',
    })
    const counts = countLinesByScope(
      [equipment, crew, transport],
      new Set(['c1']),
    )
    expect(counts).toEqual({
      all: 2,
      equipment: 1,
      crew: 0,
      transport: 1,
    })
  })

  it('counts changed descriptions after apply', () => {
    const line = makeLine({ description: 'old' })
    const after = applyTemplatesToLines([line], {}, new Set())
    expect(countChangedDescriptions([line], after)).toBe(1)
    expect(countChangedDescriptions(after, after)).toBe(0)
  })
})

describe('defaultTemplateForLineType', () => {
  it('returns equipment-only template', () => {
    expect(defaultTemplateForLineType('equipment')).toEqual({
      tokens: [{ kind: 'equipment' }],
    })
  })
})
