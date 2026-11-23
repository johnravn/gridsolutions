import { describe, expect, it } from 'vitest'
import {
  contaBilagEditKindFromSourceType,
  getContaInvoiceAppUrl,
  getContaTransactionAppUrl,
  isContaEhfTransactionSource,
  isContaSandboxUrl,
  resolveContaGatewayUrls,
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

describe('getContaTransactionAppUrl', () => {
  it('builds bookkeeping bilag deep links with rediger/kjop by default', () => {
    expect(
      getContaTransactionAppUrl('org-1', 42, 'https://api.gateway.conta.no'),
    ).toBe('https://app.conta.no/regnskap/org-1/bilag/42/rediger/kjop')
    expect(
      getContaTransactionAppUrl(
        'org-1',
        '99',
        'https://api.gateway.conta-sandbox.no',
      ),
    ).toBe('https://app.conta-sandbox.no/regnskap/org-1/bilag/99/rediger/kjop')
  })

  it('uses ehf kind for received EHF source types', () => {
    expect(
      getContaTransactionAppUrl(
        '327064',
        75275314,
        'https://api.gateway.conta.no',
        'EHF_RECEIVED',
      ),
    ).toBe('https://app.conta.no/regnskap/327064/bilag/75275314/rediger/ehf')
  })

  it('returns null without a transaction id', () => {
    expect(getContaTransactionAppUrl('org-1', null)).toBeNull()
  })
})

describe('contaBilagEditKindFromSourceType', () => {
  it('maps Conta source types to rediger kinds', () => {
    expect(contaBilagEditKindFromSourceType('EHF_RECEIVED')).toBe('ehf')
    expect(
      contaBilagEditKindFromSourceType('EHF_AUTOMATICALLY_PROCESSED'),
    ).toBe('ehf')
    expect(contaBilagEditKindFromSourceType('REGISTER_PURCHASE')).toBe('kjop')
    expect(contaBilagEditKindFromSourceType('REGISTER_INCOME')).toBe('inntekt')
    expect(contaBilagEditKindFromSourceType('ADVANCED_TRANSACTION')).toBe(
      'avansert',
    )
    expect(contaBilagEditKindFromSourceType(null)).toBe('kjop')
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
