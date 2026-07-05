import { describe, expect, it } from 'vitest'
import {
  formatInternational,
  formatNational,
  isPhoneValid,
  normalizeToE164,
  parsePastedPhoneNumber,
  prettyPhone,
} from './phone'

describe('normalizeToE164', () => {
  it('normalizes valid Norwegian numbers', () => {
    expect(normalizeToE164('91234567', 'NO')).toBe('+4791234567')
  })

  it('returns null for invalid numbers', () => {
    expect(normalizeToE164('123', 'NO')).toBeNull()
  })
})

describe('formatInternational', () => {
  it('formats Norwegian numbers with custom spacing', () => {
    expect(formatInternational('+4791234567')).toBe('+47 912 34 567')
  })
})

describe('formatNational', () => {
  it('formats Norwegian national layout', () => {
    expect(formatNational('+4791234567')).toBe('912 34 567')
  })
})

describe('isPhoneValid', () => {
  it('validates Norwegian mobile numbers', () => {
    expect(isPhoneValid('91234567', 'NO')).toBe(true)
    expect(isPhoneValid('000', 'NO')).toBe(false)
  })
})

describe('prettyPhone', () => {
  it('formats valid numbers and falls back gracefully', () => {
    expect(prettyPhone('+4791234567')).toBe('+47 912 34 567')
    expect(prettyPhone(null)).toBe('—')
    expect(prettyPhone('invalid')).toBe('invalid')
  })

  it('formats empty string as em dash', () => {
    expect(prettyPhone('')).toBe('—')
  })
})

describe('international numbers', () => {
  it('normalizes numbers with country code prefix', () => {
    expect(normalizeToE164('+4791234567', 'NO')).toBe('+4791234567')
  })

  it('rejects too-short international input', () => {
    expect(normalizeToE164('+47', 'NO')).toBeNull()
  })
})

describe('parsePastedPhoneNumber', () => {
  it('parses E.164 paste and extracts country', () => {
    expect(parsePastedPhoneNumber('+4791234567', 'NO')).toEqual({
      country: 'NO',
      e164: '+4791234567',
    })
  })

  it('parses 00 international prefix', () => {
    expect(parsePastedPhoneNumber('004791234567', 'NO')).toEqual({
      country: 'NO',
      e164: '+4791234567',
    })
  })

  it('parses foreign numbers with country code', () => {
    expect(parsePastedPhoneNumber('+46701234567', 'NO')).toEqual({
      country: 'SE',
      e164: '+46701234567',
    })
  })

  it('ignores national numbers without country code indicator', () => {
    expect(parsePastedPhoneNumber('91234567', 'NO')).toBeNull()
  })

  it('ignores bare country codes', () => {
    expect(parsePastedPhoneNumber('+47', 'NO')).toBeNull()
  })
})
