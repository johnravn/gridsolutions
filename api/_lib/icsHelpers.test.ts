import { describe, expect, it } from 'vitest'
import {
  buildICS,
  foldLine,
  formatICalDate,
  formatIcsTriggerBefore,
  icsAlarmMinutesBefore,
  icsEscape,
  parseTstzRange,
  rangesOverlap,
  withRecurringJobPrefix,
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

describe('withRecurringJobPrefix', () => {
  it('prefixes titles with the recurring job series name', () => {
    expect(withRecurringJobPrefix('JOB: Concert', 'Weekly Show')).toBe(
      'Weekly Show: JOB: Concert',
    )
  })

  it('returns the original title when no recurring job name is set', () => {
    expect(withRecurringJobPrefix('JOB: Concert', null)).toBe('JOB: Concert')
    expect(withRecurringJobPrefix('JOB: Concert', '   ')).toBe('JOB: Concert')
  })
})

describe('formatIcsTriggerBefore', () => {
  it('formats whole hours as PT#H', () => {
    expect(formatIcsTriggerBefore(60)).toBe('-PT1H')
    expect(formatIcsTriggerBefore(120)).toBe('-PT2H')
  })

  it('formats other durations as minutes', () => {
    expect(formatIcsTriggerBefore(15)).toBe('-PT15M')
  })
})

describe('icsAlarmMinutesBefore', () => {
  it('returns 60 only for opted-in project lead job feeds', () => {
    expect(
      icsAlarmMinutesBefore({
        kind: 'project_lead_jobs',
        remind1hBefore: true,
      }),
    ).toBe(60)
    expect(
      icsAlarmMinutesBefore({
        kind: 'project_lead_jobs',
        remind1hBefore: false,
      }),
    ).toBeUndefined()
    expect(
      icsAlarmMinutesBefore({ kind: 'all_jobs', remind1hBefore: true }),
    ).toBeUndefined()
    expect(
      icsAlarmMinutesBefore({ kind: 'crew_jobs', remind1hBefore: true }),
    ).toBeUndefined()
    expect(
      icsAlarmMinutesBefore({ kind: 'crew_user', remind1hBefore: true }),
    ).toBeUndefined()
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
    expect(ics).not.toContain('BEGIN:VALARM')
  })

  it('adds a 1-hour DISPLAY VALARM when requested', () => {
    const ics = buildICS([
      {
        id: 'evt-2',
        title: 'Lead job',
        start: '2026-06-26T08:00:00.000Z',
        end: '2026-06-26T10:00:00.000Z',
        alarmMinutesBefore: 60,
      },
    ])
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('ACTION:DISPLAY')
    expect(ics).toContain('DESCRIPTION:Job starts in 1 hour')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics).toContain('END:VALARM')
  })
})
