/** iCalendar formatting helpers shared by the calendar feed API. */

export function icsEscape(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function foldLine(line: string): string {
  const max = 75
  if (line.length <= max) return line
  const parts: Array<string> = []
  let rest = line
  while (rest.length > 0) {
    parts.push(rest.slice(0, max))
    rest = rest.slice(max)
    if (rest.length > 0) rest = '\r\n ' + rest
  }
  return parts.join('\r\n ')
}

export function formatICalDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export function parseTstzRange(
  during: unknown,
): { start: string; end: string } | null {
  if (typeof during !== 'string') return null
  const s = during.trim()
  if (!s) return null

  const m = s.match(/^[\[(]\s*"?([^,"]+)"?\s*,\s*"?([^)\]"]+)"?\s*[\])]\s*$/)
  if (!m) return null

  const startRaw = m[1].trim()
  const endRaw = m[2].trim()
  if (!startRaw || !endRaw) return null
  if (
    endRaw.toLowerCase() === 'infinity' ||
    startRaw.toLowerCase() === '-infinity'
  )
    return null

  const start = new Date(startRaw)
  const end = new Date(endRaw)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start: start.toISOString(), end: end.toISOString() }
}

export function rangesOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string,
): boolean {
  const aStart = new Date(aStartIso).getTime()
  const aEnd = new Date(aEndIso).getTime()
  const bStart = new Date(bStartIso).getTime()
  const bEnd = new Date(bEndIso).getTime()
  if ([aStart, aEnd, bStart, bEnd].some((t) => Number.isNaN(t))) return false
  return aStart < bEnd && bStart < aEnd
}

/** Prefix calendar event titles with the recurring job series name when applicable. */
export function withRecurringJobPrefix(
  title: string,
  recurringJobTitle: string | null | undefined,
): string {
  const seriesName = recurringJobTitle?.trim()
  if (!seriesName) return title
  return `${seriesName}: ${title}`
}

export function buildICS(
  events: Array<{
    id: string
    title: string
    start: string
    end: string
    description?: string
  }>,
): string {
  const lines: Array<string> = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grid//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const e of events) {
    const summary = foldLine('SUMMARY:' + icsEscape(e.title))
    const desc = e.description
      ? foldLine('DESCRIPTION:' + icsEscape(e.description))
      : null
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + e.id + '@grid-calendar',
      'DTSTAMP:' + formatICalDate(new Date().toISOString()),
      'DTSTART:' + formatICalDate(e.start),
      'DTEND:' + formatICalDate(e.end),
      summary,
      ...(desc ? [desc] : []),
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
