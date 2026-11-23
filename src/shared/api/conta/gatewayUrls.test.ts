import { describe, expect, it } from 'vitest'
import {
  getContaInvoiceAppUrl,
  getContaTransactionAppUrl,
  isContaEhfTransactionSource,
  isContaSandboxUrl,
  resolveContaBilagsjournalDateRange,
  resolveContaGatewayUrls,
  yearFromContaDate,
} from './gatewayUrls'

describe('resolveContaGatewayUrls', () => {
  it('uses explicit prod and sandbox URLs', () => {
    expect(
      resolveContaGatewayUrls({
        prod: 'https://api.gateway.conta.no',
        sandbox: 'https://api.gateway.conta-sandbox.no',
      }),
    ).toEqual({
      prod: 'https://api.gateway.conta.no',
      sandbox: 'https://api.gateway.conta-sandbox.no',
    })
  })

  it('does not treat a sandbox VITE_CONTA_API_URL as production', () => {
    expect(
      resolveContaGatewayUrls({
        fallback: 'https://api.gateway.conta-sandbox.no',
      }),
    ).toEqual({
      prod: 'https://api.gateway.conta.no',
      sandbox: 'https://api.gateway.conta-sandbox.no',
    })
  })

  it('uses a non-sandbox fallback as production', () => {
    expect(
      resolveContaGatewayUrls({
        fallback: 'https://api.gateway.conta.no',
      }),
    ).toEqual({
      prod: 'https://api.gateway.conta.no',
      sandbox: 'https://api.gateway.conta-sandbox.no',
    })
  })

  it('detects sandbox hosts', () => {
    expect(isContaSandboxUrl('https://api.gateway.conta-sandbox.no')).toBe(true)
    expect(isContaSandboxUrl('https://api.gateway.conta.no')).toBe(false)
  })
})

describe('getContaInvoiceAppUrl', () => {
  it('builds production and sandbox deep links', () => {
    expect(
      getContaInvoiceAppUrl('org-1', 'inv-9', 'https://api.gateway.conta.no'),
    ).toBe('https://app.conta.no/faktura/org-1/fakturaer/inv-9')
    expect(
      getContaInvoiceAppUrl(
        'org-1',
        'inv-9',
        'https://api.gateway.conta-sandbox.no',
      ),
    ).toBe('https://app.conta-sandbox.no/faktura/org-1/fakturaer/inv-9')
  })

  it('returns null without an invoice id', () => {
    expect(getContaInvoiceAppUrl('org-1', null)).toBeNull()
  })
})

describe('resolveContaBilagsjournalDateRange', () => {
  it('uses explicit from/to dates', () => {
    expect(
      resolveContaBilagsjournalDateRange({
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
      }),
    ).toEqual({ fromDate: '2026-02-01', toDate: '2026-02-28' })
  })

  it('derives calendar year from ledger date', () => {
    expect(resolveContaBilagsjournalDateRange({ date: '2026-03-12' })).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    })
  })

  it('returns null without usable dates', () => {
    expect(resolveContaBilagsjournalDateRange({})).toBeNull()
    expect(yearFromContaDate('not-a-date')).toBeNull()
  })
})

describe('getContaTransactionAppUrl', () => {
  it('builds bilagsjournal deep links from bilag number + year', () => {
    expect(
      getContaTransactionAppUrl(327064, 805, {
        date: '2026-06-15',
        gatewayUrl: 'https://api.gateway.conta.no',
      }),
    ).toBe(
      'https://app.conta.no/regnskap/327064/rapporter/bilagsjournal?fraBilag=805&fraDato=2026-01-01&tilBilag=805&tilDato=2026-12-31',
    )
    expect(
      getContaTransactionAppUrl('org-1', '99', {
        date: '2025-01-02',
        gatewayUrl: 'https://api.gateway.conta-sandbox.no',
      }),
    ).toBe(
      'https://app.conta-sandbox.no/regnskap/org-1/rapporter/bilagsjournal?fraBilag=99&fraDato=2025-01-01&tilBilag=99&tilDato=2025-12-31',
    )
  })

  it('accepts explicit invoice date range', () => {
    expect(
      getContaTransactionAppUrl('327064', 805, {
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      }),
    ).toBe(
      'https://app.conta.no/regnskap/327064/rapporter/bilagsjournal?fraBilag=805&fraDato=2026-03-01&tilBilag=805&tilDato=2026-03-31',
    )
  })

  it('returns null without bilag number or date context', () => {
    expect(
      getContaTransactionAppUrl('org-1', null, { date: '2026-01-01' }),
    ).toBe(null)
    expect(getContaTransactionAppUrl('org-1', 805)).toBeNull()
  })
})

describe('isContaEhfTransactionSource', () => {
  it('detects received EHF sources', () => {
    expect(isContaEhfTransactionSource('EHF_RECEIVED')).toBe(true)
    expect(isContaEhfTransactionSource('EHF_AUTOMATICALLY_PROCESSED')).toBe(
      true,
    )
    expect(isContaEhfTransactionSource('REGISTER_PURCHASE')).toBe(false)
    expect(isContaEhfTransactionSource(null)).toBe(false)
  })
})
