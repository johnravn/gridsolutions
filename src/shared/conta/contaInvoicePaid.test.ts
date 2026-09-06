import { describe, expect, it } from 'vitest'
import { isContaInvoicePaid } from './contaInvoicePaid'

describe('isContaInvoicePaid', () => {
  it('returns false for null/undefined', () => {
    expect(isContaInvoicePaid(null)).toBe(false)
    expect(isContaInvoicePaid(undefined)).toBe(false)
  })

  it('detects CLOSED_BY_PAYMENT status', () => {
    expect(isContaInvoicePaid({ status: 'CLOSED_BY_PAYMENT' })).toBe(true)
  })

  it('detects CLOSED_BY_EASYBANK status', () => {
    expect(isContaInvoicePaid({ status: 'CLOSED_BY_EASYBANK' })).toBe(true)
  })

  it('detects PAID extendedStatus', () => {
    expect(isContaInvoicePaid({ extendedStatus: 'PAID' })).toBe(true)
  })

  it('detects PAID_IN_CASH extendedStatus', () => {
    expect(isContaInvoicePaid({ extendedStatus: 'PAID_IN_CASH' })).toBe(true)
  })

  it('detects CLOSED_BY_EASYBANK extendedStatus', () => {
    expect(isContaInvoicePaid({ extendedStatus: 'CLOSED_BY_EASYBANK' })).toBe(
      true,
    )
  })

  it('does not treat credit notes as paid', () => {
    expect(
      isContaInvoicePaid({
        status: 'CLOSED_BY_CREDIT_NOTE',
        extendedStatus: 'CREDIT_NOTE',
      }),
    ).toBe(false)
  })

  it('does not treat write-offs as paid', () => {
    expect(
      isContaInvoicePaid({
        status: 'WRITTEN_OFF_AS_LOSS',
        extendedStatus: 'WRITTEN_OFF_AS_LOSS',
      }),
    ).toBe(false)
  })

  it('does not treat open invoices as paid', () => {
    expect(
      isContaInvoicePaid({
        status: 'INVOICE_CREATED',
        extendedStatus: 'NOT_OVERDUE',
      }),
    ).toBe(false)
  })
})
