import { describe, expect, it } from 'vitest'
import {
  buildICS,
  foldLine,
  formatICalDate,
  icsEscape,
  parseTstzRange,
  rangesOverlap,
} from './icsHelpers'

describe('icsEscape', () => {
  it('escapes special iCalendar characters', () => {
    expect(icsEscape('a;b,c\\n')).toBe('a\\;b\\,c\\\\n')
  })
})

describe('foldLine', () => {
  it('returns short lines unchanged', () => {
    expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short')
  })

  it('folds long lines at 75 characters', () => {
    const long = 'SUMMARY:' + 'x'.repeat(80)
    const folded = foldLine(long)
    expect(folded).toContain('SUMMARY:')
    expect(folded).toContain('\r\n ')
    expect(folded.length).toBeGreaterThan(long.length)
  })
})

describe('formatICalDate', () => {
  it('formats UTC timestamps for ICS', () => {
    expect(formatICalDate('2026-06-26T14:30:00.000Z')).toBe('20260626T143000Z')
  })
})

describe('parseTstzRange', () => {
  it('parses Postgres tstzrange strings', () => {
    expect(
      parseTstzRange('[2026-05-11 10:00:00+00,2026-05-11 18:00:00+00)'),
    ).toEqual({
      start: '2026-05-11T10:00:00.000Z',
      end: '2026-05-11T18:00:00.000Z',
    })
  })

  it('returns null for invalid input', () => {
    expect(parseTstzRange(null)).toBeNull()
    expect(parseTstzRange('not-a-range')).toBeNull()
  })
})

describe('rangesOverlap', () => {
  it('detects overlapping intervals', () => {
    expect(
      rangesOverlap(
        '2026-06-01T08:00:00.000Z',
        '2026-06-01T12:00:00.000Z',
        '2026-06-01T10:00:00.000Z',
        '2026-06-01T14:00:00.000Z',
      ),
    ).toBe(true)
    expect(
      rangesOverlap(
        '2026-06-01T08:00:00.000Z',
        '2026-06-01T10:00:00.000Z',
        '2026-06-01T10:00:00.000Z',
        '2026-06-01T12:00:00.000Z',
      ),
    ).toBe(false)
  })
})

describe('buildICS', () => {
  it('builds a valid calendar with escaped content', () => {
    const ics = buildICS([
      {
        id: 'evt-1',
        title: 'Job; test',
        start: '2026-06-26T08:00:00.000Z',
        end: '2026-06-26T10:00:00.000Z',
        description: 'Line one\nLine two',
      },
    ])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Job\\; test')
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two')
    expect(ics).toContain('END:VCALENDAR')
  })
})
