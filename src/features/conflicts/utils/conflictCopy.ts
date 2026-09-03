import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import type { OverlapConflict } from '../api/overlapChecks'
import type { ConflictDisplayEntry } from './groupConflictsForDisplay'

export type ConflictCountBuckets = {
  crew?: number
  vehicles?: number
  groups?: number
  items?: number
}

export type OverlapSide = {
  jobId: string | null
  title: string
  startAt: string
  endAt: string
}

const PERSONAL_BOOKING = 'a personal booking'
const UNTITLED_JOB = 'Untitled job'

export function formatNamedJob(
  title: string | null | undefined,
  hasJob: boolean,
): string {
  const trimmed = title?.trim()
  if (trimmed) return trimmed
  return hasJob ? UNTITLED_JOB : PERSONAL_BOOKING
}

export function formatConflictPeriod(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${start} – ${end}`
  }
  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'HH:mm', { locale: nb })}`
  }
  return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'd. MMM HH:mm', { locale: nb })}`
}

export function joinWithAnd(parts: Array<string>): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

export function formatConflictCountParts(
  counts: ConflictCountBuckets,
): Array<string> {
  const parts: Array<string> = []
  if (counts.crew) {
    parts.push(
      `${counts.crew} ${counts.crew === 1 ? 'crew member' : 'crew members'}`,
    )
  }
  if (counts.vehicles) {
    parts.push(
      `${counts.vehicles} ${counts.vehicles === 1 ? 'vehicle' : 'vehicles'}`,
    )
  }
  if (counts.groups) {
    parts.push(`${counts.groups} ${counts.groups === 1 ? 'group' : 'groups'}`)
  }
  if (counts.items) {
    parts.push(`${counts.items} ${counts.items === 1 ? 'item' : 'items'}`)
  }
  return parts
}

export function formatConflictCountLabel(
  counts: ConflictCountBuckets,
  fallback = 'conflicts',
): string {
  return joinWithAnd(formatConflictCountParts(counts)) || fallback
}

export function overlapSidesFromPair(row: {
  job_id_1: string | null
  job_id_2: string | null
  job_title_1: string | null
  job_title_2: string | null
  start_1: string
  end_1: string
  start_2: string
  end_2: string
}): [OverlapSide, OverlapSide] {
  return [
    {
      jobId: row.job_id_1,
      title: formatNamedJob(row.job_title_1, !!row.job_id_1),
      startAt: row.start_1,
      endAt: row.end_1,
    },
    {
      jobId: row.job_id_2,
      title: formatNamedJob(row.job_title_2, !!row.job_id_2),
      startAt: row.start_2,
      endAt: row.end_2,
    },
  ]
}

export function formatPairOverlapLine(
  name: string,
  row: {
    job_id_1: string | null
    job_id_2: string | null
    job_title_1: string | null
    job_title_2: string | null
    start_1: string
    end_1: string
    start_2: string
    end_2: string
  },
  formatPeriod: (start: string, end: string) => string,
): string {
  const [left, right] = overlapSidesFromPair(row)
  return `${name} overlaps ${left.title} (${formatPeriod(left.startAt, left.endAt)}) and ${right.title} (${formatPeriod(right.startAt, right.endAt)})`
}

export function uniqueOverlapJobLabels(
  conflicts: Array<OverlapConflict>,
): Array<string> {
  const seen = new Set<string>()
  const labels: Array<string> = []
  for (const conflict of conflicts) {
    const label = formatNamedJob(conflict.jobTitle, !!conflict.jobId)
    const key = conflict.jobId ?? `title:${label}`
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels
}

export function formatOverlapJobs(conflicts: Array<OverlapConflict>): string {
  return joinWithAnd(uniqueOverlapJobLabels(conflicts))
}

export function formatGroupOverlapWarning(
  groupName: string,
  conflicts: Array<OverlapConflict>,
): string {
  const jobs = formatOverlapJobs(conflicts)
  if (!jobs) return `${groupName} overlaps another booking`
  return `${groupName} overlaps ${jobs}`
}

export function formatVehicleOverlapWarning(
  vehicleName: string,
  conflicts: Array<OverlapConflict>,
): string {
  return formatGroupOverlapWarning(vehicleName, conflicts)
}

export function formatItemCapacityWarning({
  itemName,
  newQty,
  existingQty,
  onHand,
  conflicts,
}: {
  itemName: string
  newQty: number
  existingQty: number
  onHand: number
  conflicts?: Array<OverlapConflict>
}): string {
  const existingPart =
    existingQty > 0 ? ` (${existingQty} already reserved)` : ''
  const jobs = conflicts ? formatOverlapJobs(conflicts) : ''
  const stock = `${itemName}: booking ${newQty}${existingPart}, but only ${onHand} available`
  return jobs ? `${stock} — overlaps ${jobs}` : stock
}

export function formatForceBookingDescription(
  resourceLabel: string,
  conflicts: Array<OverlapConflict>,
): string {
  const jobs = formatOverlapJobs(conflicts)
  const overlap = jobs
    ? `${resourceLabel} overlaps ${jobs}`
    : `${resourceLabel} is already booked in an overlapping period`
  return `${overlap}. You can force this booking if the overlap is intentional. Forced overlaps appear on the Conflicts page.`
}

export function formatConflictEntriesSummary(
  entries: Array<ConflictDisplayEntry>,
): string {
  if (entries.length === 0) return 'None'

  const lines = entries.slice(0, 3).map((entry) => {
    if (entry.kind === 'group') {
      return formatGroupOverlapWarning(entry.groupName, entry.items)
    }
    const name = entry.conflict.itemName?.trim()
    const job = formatNamedJob(entry.conflict.jobTitle, !!entry.conflict.jobId)
    return name ? `${name} overlaps ${job}` : `Overlaps ${job}`
  })

  const extra = entries.length - lines.length
  const suffix = extra > 0 ? ` and ${extra} more` : ''
  return `${lines.join('. ')}${suffix}.`
}
