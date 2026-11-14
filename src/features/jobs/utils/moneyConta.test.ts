import { describe, expect, it } from 'vitest'
import {
  contaExpenseConfidence,
  contaIncomeConfidence,
  contaLedgerDateRange,
  resolveContaLinkStatus,
} from './moneyConta'

describe('contaLedgerDateRange', () => {
  it('uses job dates with no pad', () => {
    expect(
      contaLedgerDateRange(
        '2026-03-10T10:00:00Z',
        '2026-03-12T18:00:00Z',
        'job',
      ),
    ).toEqual({ startDate: '2026-03-10', endDate: '2026-03-12' })
  })

  it('pads ±30 days', () => {
    expect(
      contaLedgerDateRange(
        '2026-03-10T00:00:00Z',
        '2026-03-12T00:00:00Z',
        'pad30',
      ),
    ).toEqual({ startDate: '2026-02-08', endDate: '2026-04-11' })
  })

  it('returns empty for open', () => {
    expect(
      contaLedgerDateRange(
        '2026-03-10T00:00:00Z',
        '2026-03-12T00:00:00Z',
        'open',
      ),
    ).toEqual({})
  })
})

describe('confidence helpers', () => {
  it('rates project match high and jobnr medium', () => {
    expect(contaExpenseConfidence('project')).toBe('high')
    expect(contaExpenseConfidence('jobnr')).toBe('medium')
  })

  it('rates single invoice high and multiple medium', () => {
    expect(contaIncomeConfidence(1)).toBe('high')
    expect(contaIncomeConfidence(3)).toBe('medium')
  })
})

describe('resolveContaLinkStatus', () => {
  it('resolves statuses', () => {
    expect(
      resolveContaLinkStatus({
        hasOrganizationId: false,
        contaProjectId: null,
        hasJobnr: true,
      }),
    ).toBe('not_configured')
    expect(
      resolveContaLinkStatus({
        hasOrganizationId: true,
        contaProjectId: 12,
        hasJobnr: true,
      }),
    ).toBe('configured_with_project')
    expect(
      resolveContaLinkStatus({
        hasOrganizationId: true,
        contaProjectId: null,
        hasJobnr: true,
      }),
    ).toBe('configured_jobnr_only')
    expect(
      resolveContaLinkStatus({
        hasOrganizationId: true,
        contaProjectId: null,
        hasJobnr: false,
      }),
    ).toBe('configured_no_project')
  })
})
