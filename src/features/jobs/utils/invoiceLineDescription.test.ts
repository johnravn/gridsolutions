import { describe, expect, it } from 'vitest'
import type { BookingInvoiceLine } from '../api/invoiceQueries'
import {
  applyTemplatesToLines,
  buildInvoiceLineDescription,
  countChangedDescriptions,
  countLinesByScope,
  defaultDescriptionForLine,
  defaultTemplateForLineType,
  normalizeInvoiceLineTemplateStore,
  tokenOptionsForScope,
} from './invoiceLineDescription'

function localTimeRange(startAt: string, endAt: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  const start = fmt(startAt)
  const end = fmt(endAt)
  return start === end ? start : `${start} – ${end}`
}

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
    itemName: 'Wireless vocal mic',
    ...overrides,
  }
}

describe('buildInvoiceLineDescription', () => {
  it('defaults equipment description to days, item name, brand, and model', () => {
    const line = makeLine({ type: 'equipment', rentalDays: 2 })
    const desc = defaultDescriptionForLine(line)
    expect(desc).toBe('2 days - Wireless vocal mic - Shure - SM58')
  })

  it('builds group equipment description with days when set', () => {
    const line = makeLine({
      type: 'equipment',
      brandName: null,
      model: null,
      itemName: null,
      groupName: 'Wireless kit',
      rentalDays: 1,
    })
    expect(defaultDescriptionForLine(line)).toBe('1 day - Wireless kit (Group)')
  })

  it('builds crew description as role, crew name, and time', () => {
    const line = makeLine({
      type: 'crew',
      unit: 'hour',
      roleLabel: 'Sound engineer',
      crewName: 'Ada Lovelace',
    })
    expect(defaultDescriptionForLine(line)).toBe(
      `Sound engineer - Ada Lovelace - ${localTimeRange(line.startAt, line.endAt)}`,
    )
  })

  it('omits crew name from the default when nobody is assigned', () => {
    const line = makeLine({
      type: 'crew',
      unit: 'day',
      roleLabel: 'technician',
    })
    expect(defaultDescriptionForLine(line)).toBe(
      `technician - ${localTimeRange(line.startAt, line.endAt)}`,
    )
  })

  it('builds transport description as Transport and the vehicle name', () => {
    const line = makeLine({
      type: 'transport',
      unit: 'day',
      vehicleName: 'Sprinter',
    })
    expect(defaultDescriptionForLine(line)).toBe('Transport - Sprinter')
  })

  it('can include equipment brand and model as separate tokens', () => {
    const line = makeLine({ type: 'equipment' })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'itemName' }, { kind: 'brand' }, { kind: 'model' }],
    })
    expect(desc).toBe('Wireless vocal mic - Shure - SM58')
  })

  it('can include assigned crew names on crew lines', () => {
    const line = makeLine({
      type: 'crew',
      roleLabel: 'Sound engineer',
      crewName: 'Ada Lovelace, Alan Turing',
      unit: 'hour',
    })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'crew' }, { kind: 'crewName' }],
    })
    expect(desc).toBe('Sound engineer - Ada Lovelace, Alan Turing')
  })

  it('skips crew name when nobody is assigned', () => {
    const line = makeLine({
      type: 'crew',
      roleLabel: 'Sound engineer',
      crewName: null,
    })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'crew' }, { kind: 'crewName' }],
    })
    expect(desc).toBe('Sound engineer')
  })

  it('can include date and time on crew lines', () => {
    const line = makeLine({
      type: 'crew',
      roleLabel: 'Sound engineer',
      unit: 'hour',
    })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'crew' }, { kind: 'date' }, { kind: 'time' }],
    })
    expect(desc).toBe(
      `Sound engineer - 15.01.2026 - ${localTimeRange(line.startAt, line.endAt)}`,
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
        { kind: 'itemName' },
      ],
      separator: ' ',
    })
    expect(desc).toBe('Corporate event (#000042) :: Wireless vocal mic')
  })

  it('includes job token with jobnr only', () => {
    const line = makeLine({ jobTitle: null, jobnr: 7 })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'job' }],
    })
    expect(desc).toBe('#000007')
  })

  it('skips empty token values', () => {
    const line = makeLine({ timePeriodTitle: null, brandName: null })
    const desc = buildInvoiceLineDescription(line, {
      tokens: [{ kind: 'timePeriod' }, { kind: 'brand' }, { kind: 'itemName' }],
    })
    expect(desc).toBe('Wireless vocal mic')
  })

  it('resolves the generic name token per booking type', () => {
    expect(
      buildInvoiceLineDescription(makeLine({ type: 'equipment' }), {
        tokens: [{ kind: 'name' }],
      }),
    ).toBe('Wireless vocal mic')
    expect(
      buildInvoiceLineDescription(makeLine({ type: 'crew', roleLabel: 'LD' }), {
        tokens: [{ kind: 'name' }],
      }),
    ).toBe('LD')
    expect(
      buildInvoiceLineDescription(
        makeLine({ type: 'transport', vehicleName: 'Van' }),
        { tokens: [{ kind: 'name' }] },
      ),
    ).toBe('Van')
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
    expect(result[1].description).toBe(
      `LD - ${localTimeRange(crew.startAt, crew.endAt)}`,
    )
  })

  it('does not let Other overwrite lines with a type-specific template', () => {
    const equipment = makeLine({ type: 'equipment', description: 'old eq' })
    const crew = makeLine({
      type: 'crew',
      roleLabel: 'LD',
      unit: 'day',
      description: 'old crew',
    })
    const result = applyTemplatesToLines(
      [equipment, crew],
      {
        equipment: { tokens: [{ kind: 'itemName' }] },
        other: { tokens: [{ kind: 'type' }] },
      },
      new Set(),
      'other',
    )
    expect(result[0].description).toBe('old eq')
    expect(result[1].description).toBe('Crew')
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
      other: 2,
      equipment: 1,
      crew: 0,
      transport: 1,
    })
  })

  it('excludes type-specific templates from the Other count', () => {
    const equipment = makeLine({ id: 'e1', type: 'equipment' })
    const crew = makeLine({ id: 'c1', type: 'crew', roleLabel: 'LD' })
    const counts = countLinesByScope([equipment, crew], new Set(), {
      equipment: { tokens: [{ kind: 'itemName' }] },
    })
    expect(counts.other).toBe(1)
    expect(counts.equipment).toBe(1)
    expect(counts.crew).toBe(1)
  })

  it('counts changed descriptions after apply', () => {
    const line = makeLine({ description: 'old' })
    const after = applyTemplatesToLines([line], {}, new Set())
    expect(countChangedDescriptions([line], after)).toBe(1)
    expect(countChangedDescriptions(after, after)).toBe(0)
  })
})

describe('defaultTemplateForLineType', () => {
  it('returns days, item name, brand, and model for equipment', () => {
    expect(defaultTemplateForLineType('equipment')).toEqual({
      tokens: [
        { kind: 'days' },
        { kind: 'itemName' },
        { kind: 'brand' },
        { kind: 'model' },
      ],
    })
  })

  it('returns Transport plus transport name for transport', () => {
    expect(defaultTemplateForLineType('transport')).toEqual({
      tokens: [{ kind: 'custom', text: 'Transport' }, { kind: 'vehicleName' }],
    })
  })
})

describe('tokenOptionsForScope', () => {
  it('offers days, brand and model on equipment, date and time on crew', () => {
    const equipment = tokenOptionsForScope('equipment').map((o) => o.value)
    expect(equipment).toEqual(
      expect.arrayContaining([
        'days',
        'itemName',
        'brand',
        'model',
        'date',
        'time',
      ]),
    )
    expect(equipment).not.toContain('crew')
    expect(equipment).not.toContain('transport')

    const crew = tokenOptionsForScope('crew').map((o) => o.value)
    expect(crew).toEqual(
      expect.arrayContaining(['crew', 'crewName', 'date', 'time', 'unit']),
    )
    expect(crew).not.toContain('itemName')
    expect(crew).not.toContain('brand')

    const transport = tokenOptionsForScope('transport').map((o) => o.value)
    expect(transport).toEqual(
      expect.arrayContaining(['vehicleName', 'unit', 'type']),
    )
    expect(transport).not.toContain('itemName')

    const other = tokenOptionsForScope('other').map((o) => o.value)
    expect(other).toEqual(expect.arrayContaining(['name', 'date', 'time']))
    expect(other).not.toContain('brand')
    expect(other).not.toContain('model')
  })
})

describe('normalizeInvoiceLineTemplateStore', () => {
  it('migrates all → other, equipment → itemName, and transport → vehicleName', () => {
    const migrated = normalizeInvoiceLineTemplateStore({
      all: { tokens: [{ kind: 'equipment' }, { kind: 'date' }] },
      transport: { tokens: [{ kind: 'transport' }] },
    })
    expect(migrated.other).toEqual({
      tokens: [{ kind: 'itemName' }, { kind: 'date' }],
    })
    expect(migrated.transport).toEqual({
      tokens: [{ kind: 'vehicleName' }],
    })
    expect('all' in migrated).toBe(false)
  })
})
