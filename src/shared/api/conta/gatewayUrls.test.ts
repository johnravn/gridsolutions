import { describe, expect, it } from 'vitest'
import {
  getContaInvoiceAppUrl,
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
