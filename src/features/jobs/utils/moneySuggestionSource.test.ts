import { describe, expect, it } from 'vitest'
import {
  getMoneySourceBadgeColor,
  getMoneySourceLabel,
} from './moneySuggestionSource'

describe('getMoneySourceLabel', () => {
  it('labels crew booking rates as Booking', () => {
    expect(
      getMoneySourceLabel({
        source: 'crew',
        type: 'expense',
        category: 'crew',
        sourceId: 'crew-1',
      }),
    ).toBe('Booking')
    expect(
      getMoneySourceLabel({
        source: 'crew',
        type: 'income',
        category: 'crew',
        sourceId: 'crew-income-1',
      }),
    ).toBe('Booking')
  })

  it('labels Conta received / supplier lines as Conta incoming invoice', () => {
    expect(
      getMoneySourceLabel({
        source: 'conta',
        type: 'expense',
        category: 'crew',
        sourceId: 'crew-conta-1',
      }),
    ).toBe('Conta incoming invoice')
    expect(
      getMoneySourceLabel({
        source: 'conta',
        type: 'expense',
        category: 'conta',
        sourceId: 'conta-99',
      }),
    ).toBe('Conta incoming invoice')
  })

  it('labels Conta sales income separately', () => {
    expect(
      getMoneySourceLabel({
        source: 'conta',
        type: 'income',
        category: 'other',
        sourceId: 'invoice-1',
      }),
    ).toBe('Conta sales invoice')
  })

  it('labels logging-originated expenses as Logging', () => {
    expect(
      getMoneySourceLabel({
        source: 'logging',
        type: 'expense',
        category: 'crew',
        source_id: 'logging-entry-1',
      }),
    ).toBe('Logging')
    // Pre-migration rows stored as manual + logging- source_id
    expect(
      getMoneySourceLabel({
        source: 'manual',
        type: 'expense',
        category: 'crew',
        source_id: 'logging-legacy',
      }),
    ).toBe('Logging')
  })

  it('names the other coded sources plainly', () => {
    expect(
      getMoneySourceLabel({
        source: 'offer',
        type: 'income',
        category: 'other',
        sourceId: 'offer-1',
      }),
    ).toBe('Offer')
    expect(
      getMoneySourceLabel({
        source: 'manual',
        type: 'expense',
        category: 'equipment',
        sourceId: 'quote-q1',
      }),
    ).toBe('Subcontractor quote')
    expect(
      getMoneySourceLabel({
        source: 'manual',
        type: 'expense',
        category: 'transport',
        sourceId: 'transport-km',
      }),
    ).toBe('Transport')
    expect(
      getMoneySourceLabel({
        source: 'manual',
        type: 'expense',
        category: 'other',
        source_id: null,
      }),
    ).toBe('Manual')
  })

  it('prefers quote- / logging- heuristics over raw source', () => {
    expect(
      getMoneySourceLabel({
        source: 'manual',
        category: 'equipment',
        source_id: 'quote-abc',
      }),
    ).toBe('Subcontractor quote')
  })
})

describe('getMoneySourceBadgeColor', () => {
  it('keeps Conta incoming and sales visually distinct', () => {
    expect(
      getMoneySourceBadgeColor({
        source: 'conta',
        type: 'expense',
        category: 'conta',
      }),
    ).toBe('blue')
    expect(
      getMoneySourceBadgeColor({
        source: 'conta',
        type: 'income',
        category: 'other',
      }),
    ).toBe('teal')
  })

  it('colors Booking red, Offer green, Logging violet', () => {
    expect(getMoneySourceBadgeColor({ source: 'crew' })).toBe('red')
    expect(getMoneySourceBadgeColor({ source: 'offer' })).toBe('green')
    expect(getMoneySourceBadgeColor({ source: 'logging' })).toBe('violet')
  })
})
