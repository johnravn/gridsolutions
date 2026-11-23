import { describe, expect, it } from 'vitest'
import {
  computeContaLineExpenseAmount,
  contaLineExpenseDate,
  contaLineExpenseDescription,
  contaLineExpenseReference,
  contaLineExpenseSourceId,
} from './contaLineExpense'

describe('contaLineExpenseSourceId', () => {
  it('uses line number when present', () => {
    expect(contaLineExpenseSourceId('inv-1', 3, 0)).toBe(
      'conta-sales-line-inv-1-3',
    )
  })

  it('falls back to index key when lineNo missing', () => {
    expect(contaLineExpenseSourceId('inv-1', null, 2)).toBe(
      'conta-sales-line-inv-1-i2',
    )
  })
})

describe('contaLineExpenseDescription', () => {
  it('uses trimmed description', () => {
    expect(contaLineExpenseDescription({ description: '  Parking  ' })).toBe(
      'Parking',
    )
  })

  it('falls back when empty', () => {
    expect(contaLineExpenseDescription({ description: '   ' })).toBe(
      'Conta line',
    )
  })
})

describe('computeContaLineExpenseAmount', () => {
  it('returns rounded positive net', () => {
    expect(computeContaLineExpenseAmount({ sumNet: 1048.125 })).toBe(1048.13)
  })

  it('rejects zero or invalid', () => {
    expect(computeContaLineExpenseAmount({ sumNet: 0 })).toBeNull()
    expect(computeContaLineExpenseAmount({ sumNet: -5 })).toBeNull()
    expect(computeContaLineExpenseAmount({ sumNet: Number.NaN })).toBeNull()
  })
})

describe('contaLineExpenseDate', () => {
  it('keeps YYYY-MM-DD', () => {
    expect(contaLineExpenseDate('2026-11-18')).toBe('2026-11-18')
  })

  it('takes date prefix from ISO datetime', () => {
    expect(contaLineExpenseDate('2026-11-18T12:00:00Z')).toBe('2026-11-18')
  })

  it('returns null for empty', () => {
    expect(contaLineExpenseDate(null)).toBeNull()
    expect(contaLineExpenseDate('')).toBeNull()
  })
})

describe('contaLineExpenseReference', () => {
  it('includes invoice number and line', () => {
    expect(
      contaLineExpenseReference({
        invoiceNo: '1828',
        lineNo: 1,
        lineIndex: 0,
      }),
    ).toBe('#1828 L1')
  })

  it('falls back to line only', () => {
    expect(
      contaLineExpenseReference({
        invoiceNo: null,
        lineNo: null,
        lineIndex: 4,
      }),
    ).toBe('L5')
  })
})
