import { describe, expect, it } from 'vitest'
import { financialKpis } from './kpis'

describe('financialKpis', () => {
  const rows = [{ income: 1000, expenses: 400, profit: 600 }]

  it('appends Incomplete then Not verified when both counts are positive', () => {
    const items = financialKpis(rows, {
      incompleteCount: 2,
      unverifiedCount: 5,
    })
    const labels = items.map((i) => i.label)
    expect(labels.indexOf('Incomplete Accounting')).toBeLessThan(
      labels.indexOf('Not verified'),
    )
    expect(items.find((i) => i.label === 'Not verified')).toMatchObject({
      value: '5',
    })
  })

  it('omits zero or missing attention counts', () => {
    const labels = financialKpis(rows, {
      incompleteCount: 0,
      unverifiedCount: 0,
    }).map((i) => i.label)
    expect(labels).not.toContain('Incomplete Accounting')
    expect(labels).not.toContain('Not verified')
  })
})
