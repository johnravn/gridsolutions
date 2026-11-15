import { describe, expect, it } from 'vitest'
import {
  buildContaErrorLog,
  extractContaErrorLogFromDetails,
  normalizeContaCompanyResultForPersist,
  tallyErrorMessages,
  totalContaErrorCount,
} from './contaErrorLog'

describe('tallyErrorMessages', () => {
  it('collapses duplicate Conta 401s', () => {
    expect(
      tallyErrorMessages([
        'Conta 401: bad',
        'Conta 401: bad',
        'Conta 404: missing',
      ]),
    ).toEqual([
      { message: 'Conta 401: bad', count: 2 },
      { message: 'Conta 404: missing', count: 1 },
    ])
  })
})

describe('normalizeContaCompanyResultForPersist', () => {
  it('stores unique errors plus tallies', () => {
    const normalized = normalizeContaCompanyResultForPersist({
      companyId: 'c1',
      companyName: 'Ekte Lyd AS TEST',
      errors: ['Conta 401: x', 'Conta 401: x', 'Conta 401: x'],
    })
    expect(normalized.errors).toEqual(['Conta 401: x'])
    expect(normalized.errorEntries).toEqual([
      { message: 'Conta 401: x', count: 3 },
    ])
  })
})

describe('buildContaErrorLog / extractContaErrorLogFromDetails', () => {
  it('builds a flat inspectable log', () => {
    const log = buildContaErrorLog([
      {
        companyId: 'healthy',
        companyName: 'Ekte Lyd',
        errors: [],
      },
      {
        companyId: 'test',
        companyName: 'Ekte Lyd AS TEST',
        errors: ['Conta 401: Invalid authentication credentials'],
        errorEntries: [
          {
            message: 'Conta 401: Invalid authentication credentials',
            count: 30,
          },
        ],
      },
    ])
    expect(log).toEqual([
      {
        companyId: 'test',
        companyName: 'Ekte Lyd AS TEST',
        message: 'Conta 401: Invalid authentication credentials',
        count: 30,
      },
    ])
    expect(
      totalContaErrorCount([
        {
          companyId: 'test',
          errors: [],
          errorEntries: [
            {
              message: 'Conta 401: Invalid authentication credentials',
              count: 30,
            },
          ],
        },
      ]),
    ).toBe(30)
  })

  it('reads errorLog from details when present', () => {
    expect(
      extractContaErrorLogFromDetails({
        errorLog: [
          {
            companyId: 'x',
            companyName: 'Acme',
            message: 'boom',
            count: 2,
          },
        ],
      }),
    ).toEqual([
      {
        companyId: 'x',
        companyName: 'Acme',
        message: 'boom',
        count: 2,
      },
    ])
  })

  it('rebuilds from legacy results[].errors', () => {
    expect(
      extractContaErrorLogFromDetails({
        results: [
          {
            companyId: 'x',
            companyName: null,
            errors: ['a', 'a', 'b'],
          },
        ],
      }),
    ).toEqual([
      { companyId: 'x', companyName: null, message: 'a', count: 2 },
      { companyId: 'x', companyName: null, message: 'b', count: 1 },
    ])
  })
})
