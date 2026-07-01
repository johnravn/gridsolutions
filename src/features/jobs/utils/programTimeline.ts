import type { PrettyOfferModuleBlockItem, TimePeriodLite  } from '../types'

export type TimelineBlockItem = PrettyOfferModuleBlockItem & {
  start_at: string | null
  end_at: string | null
}

export function filterProgramPeriods(
  periods: Array<TimePeriodLite>,
): Array<TimePeriodLite> {
  return periods.filter(
    (tp) =>
      (tp.category === 'program' || !tp.category) &&
      !tp.title?.toLowerCase().includes('job duration'),
  )
}

export function sortProgramPeriods(
  periods: Array<TimePeriodLite>,
): Array<TimePeriodLite> {
  return [...periods].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )
}

export function groupProgramPeriods(
  periods: Array<TimePeriodLite>,
): Array<[string | null, Array<TimePeriodLite>]> {
  const sorted = sortProgramPeriods(periods)
  const groups = new Map<string | null, Array<TimePeriodLite>>()

  for (const period of sorted) {
    const key = period.program_group?.trim() || null
    const list = groups.get(key) ?? []
    list.push(period)
    groups.set(key, list)
  }

  return Array.from(groups.entries()).sort(([keyA, listA], [keyB, listB]) => {
    if (keyA === null) return -1
    if (keyB === null) return 1
    const minA = Math.min(...listA.map((p) => new Date(p.start_at).getTime()))
    const minB = Math.min(...listB.map((p) => new Date(p.start_at).getTime()))
    return minA - minB
  })
}

export function formatProgramTime(iso: string): string {
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatProgramDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatProgramDuration(startAt: string, endAt: string): string {
  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime()
  const durationHours = durationMs / (1000 * 60 * 60)
  const durationMins = durationMs / (1000 * 60)

  if (durationHours >= 1) {
    const hours = Math.floor(durationHours)
    const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return `${Math.floor(durationMins)}m`
}

export function mapProgramPeriodsToTimelineItems(
  blockId: string,
  periods: Array<TimePeriodLite>,
  createItemId: () => string,
): Array<TimelineBlockItem> {
  return sortProgramPeriods(filterProgramPeriods(periods)).map(
    (period, index) => ({
      id: createItemId(),
      block_id: blockId,
      label: period.title?.trim() || '(untitled)',
      summary: period.program_group?.trim() || null,
      detail: null,
      start_at: period.start_at,
      end_at: period.end_at,
      sort_order: index,
    }),
  )
}
