import { describe, expect, it } from 'vitest'
import {
  extractContaResultsFromDetails,
  formatContaSyncCompanyErrors,
  getContaErrorLogForDetails,
} from './monitorQueries'

describe('formatContaSyncCompanyErrors', () => {
  it('prefers company name and shows tally count', () => {
    const lines = formatContaSyncCompanyErrors([
      {
        companyId: 'healthy',
        companyName: 'Ekte Lyd',
        skipped: 0,
        errors: [],
      },
      {
        companyId: 'test',
        companyName: 'Ekte Lyd AS TEST',
        skipped: 0,
        errors: [
          'Conta 401: Invalid authentication credentials',
          'Conta 401: Invalid authentication credentials',
        ],
      },
    ])
    expect(lines).toEqual([
      'Ekte Lyd AS TEST: Conta 401: Invalid authentication credentials ×2',
    ])
  })

  it('falls back to company id and skippedReason', () => {
    expect(
      formatContaSyncCompanyErrors([
        {
          companyId: 'abc',
          skipped: 0,
          skippedReason: 'No active Conta API key for company',
          errors: [],
        },
      ]),
    ).toEqual(['abc: No active Conta API key for company'])
  })
})

describe('extractContaResultsFromDetails / getContaErrorLogForDetails', () => {
  it('reads results array from scheduled_job_runs details', () => {
    expect(
      extractContaResultsFromDetails({
        summary: '1 errors',
        results: [{ companyId: 'x', skipped: 0, errors: ['boom'] }],
      }),
    ).toEqual([{ companyId: 'x', skipped: 0, errors: ['boom'] }])
    expect(extractContaResultsFromDetails(null)).toEqual([])
  })

  it('prefers persisted errorLog', () => {
    expect(
      getContaErrorLogForDetails({
        errorLog: [
          {
            companyId: 'test',
            companyName: 'Ekte Lyd AS TEST',
            message: 'Conta 401: Invalid authentication credentials',
            count: 30,
          },
        ],
      }),
    ).toHaveLength(1)
  })
})
