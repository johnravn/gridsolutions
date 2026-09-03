export type OverlapWindow = {
  start: Date
  end: Date
  durationMs: number
}

function toDate(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function periodWindow(
  startAt: string,
  endAt: string,
): OverlapWindow | null {
  const start = toDate(startAt)
  const end = toDate(endAt)
  if (!start || !end || end <= start) return null
  return {
    start,
    end,
    durationMs: end.getTime() - start.getTime(),
  }
}

export function overlapWindow(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): OverlapWindow | null {
  const leftStart = toDate(start1)
  const leftEnd = toDate(end1)
  const rightStart = toDate(start2)
  const rightEnd = toDate(end2)
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return null

  const start = leftStart > rightStart ? leftStart : rightStart
  const end = leftEnd < rightEnd ? leftEnd : rightEnd
  if (end <= start) return null

  return {
    start,
    end,
    durationMs: end.getTime() - start.getTime(),
  }
}

export function formatOverlapDuration(durationMs: number): string {
  if (durationMs <= 0) return 'less than a minute'
  const minutes = Math.round(durationMs / 60_000)
  if (minutes < 60) {
    if (minutes <= 0) return 'less than a minute'
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  const hours = minutes / 60
  const rounded = Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
}
