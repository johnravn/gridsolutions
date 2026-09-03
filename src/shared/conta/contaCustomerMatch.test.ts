import { describe, expect, it } from 'vitest'
import {
  MIN_CONTA_MATCH_SCORE,
  isValidOrgNo,
  normalizeEmail,
  normalizeOrgNo,
  rankContaCustomerMatches,
  resolveContaCustomerType,
  scoreContaCustomerMatch,
} from './contaCustomerMatch'

describe('normalize helpers', () => {
  it('strips non-digits from org numbers', () => {
    expect(normalizeOrgNo('123 456 789')).toBe('123456789')
    expect(isValidOrgNo('12345')).toBe(false)
    expect(isValidOrgNo('123456')).toBe(true)
  })

  it('lowercases emails', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com')
  })
})

describe('resolveContaCustomerType', () => {
  it('uses ORGANIZATION when a VAT/org number is present', () => {
    expect(resolveContaCustomerType('123 456 789')).toBe('ORGANIZATION')
  })

  it('uses INDIVIDUAL when there is no org number', () => {
    expect(resolveContaCustomerType(null)).toBe('INDIVIDUAL')
    expect(resolveContaCustomerType('12')).toBe('INDIVIDUAL')
  })
})

describe('scoreContaCustomerMatch', () => {
  it('scores an exact org-number match highest', () => {
    const result = scoreContaCustomerMatch(
      { name: 'Acme', vat_number: '123456789' },
      { id: 1, name: 'Acme AS', orgNo: '123456789' },
    )
    expect(result.reasons).toContain('orgNo')
    expect(result.score).toBeGreaterThanOrEqual(100)
  })

  it('rejects hits whose org number differs', () => {
    const result = scoreContaCustomerMatch(
      { name: 'Acme', vat_number: '123456789' },
      { id: 1, name: 'Acme', orgNo: '999999999' },
    )
    expect(result.score).toBe(0)
  })

  it('matches private customers by email without an org number', () => {
    const result = scoreContaCustomerMatch(
      { name: 'Ada Lovelace', email: 'ada@example.com', vat_number: null },
      {
        id: 7,
        customerName: 'Ada Lovelace',
        emailAddress: 'ada@example.com',
        customerType: 'INDIVIDUAL',
      },
    )
    expect(result.reasons).toEqual(expect.arrayContaining(['email', 'name']))
    expect(result.score).toBeGreaterThanOrEqual(MIN_CONTA_MATCH_SCORE)
  })

  it('matches private customers by name alone', () => {
    const result = scoreContaCustomerMatch(
      { name: 'Ola Nordmann', email: null, vat_number: null },
      { id: 3, customerName: 'Ola Nordmann', customerType: 'INDIVIDUAL' },
    )
    expect(result.reasons).toContain('name')
    expect(result.score).toBeGreaterThanOrEqual(MIN_CONTA_MATCH_SCORE)
  })
})

describe('rankContaCustomerMatches', () => {
  it('dedupes by id and sorts the best match first', () => {
    const ranked = rankContaCustomerMatches(
      { name: 'Ada Lovelace', email: 'ada@example.com', vat_number: null },
      [
        { id: 2, customerName: 'Ada Other', emailAddress: 'other@example.com' },
        {
          id: 1,
          customerName: 'Ada Lovelace',
          emailAddress: 'ada@example.com',
        },
        { id: 1, name: 'Ada Lovelace', emailAddress: 'ada@example.com' },
      ],
    )
    expect(ranked.map((h) => h.id)).toEqual([1])
    expect(ranked[0]?.reasons).toEqual(
      expect.arrayContaining(['email', 'name']),
    )
  })

  it('keeps several same-name private customers so the user can choose', () => {
    const ranked = rankContaCustomerMatches(
      { name: 'Ada Lovelace', vat_number: null },
      [
        { id: 1, customerName: 'Ada Lovelace', emailAddress: 'a@example.com' },
        { id: 2, customerName: 'Ada Lovelace', emailAddress: 'b@example.com' },
      ],
    )
    expect(ranked.map((h) => h.id)).toEqual([1, 2])
  })

  it('drops hits below the score threshold', () => {
    const ranked = rankContaCustomerMatches(
      { name: 'Ada Lovelace', vat_number: null },
      [{ id: 9, customerName: 'Completely Different Person' }],
    )
    expect(ranked).toEqual([])
  })
})
