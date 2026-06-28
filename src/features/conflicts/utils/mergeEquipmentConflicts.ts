import type { EquipmentConflictRow } from '../api/queries'

function jobIdsKey(ids: Array<string> | null | undefined): string {
  return [...(ids ?? [])].sort().join('|')
}

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && start2 < end1
}

/** Merge duplicate equipment conflict rows (same item + jobs, overlapping windows). */
export function mergeEquipmentConflicts(
  rows: Array<EquipmentConflictRow>,
): Array<EquipmentConflictRow> {
  const merged: Array<EquipmentConflictRow> = []

  for (const row of rows) {
    const key = `${row.item_id}:${jobIdsKey(row.job_ids)}`
    const existing = merged.find(
      (candidate) =>
        `${candidate.item_id}:${jobIdsKey(candidate.job_ids)}` === key &&
        periodsOverlap(
          candidate.start_at,
          candidate.end_at,
          row.start_at,
          row.end_at,
        ),
    )

    if (existing) {
      if (row.start_at < existing.start_at) existing.start_at = row.start_at
      if (row.end_at > existing.end_at) existing.end_at = row.end_at
      if (row.total_reserved > existing.total_reserved) {
        existing.total_reserved = row.total_reserved
      }
      existing.has_forced = existing.has_forced || row.has_forced
      continue
    }

    merged.push({
      ...row,
      job_ids: row.job_ids ? [...row.job_ids] : null,
      job_titles: row.job_titles ? [...row.job_titles] : null,
    })
  }

  return merged
}

export function formatEquipmentConflictJobs(row: EquipmentConflictRow): string {
  const ids = row.job_ids ?? []
  const titles = row.job_titles ?? []

  if (ids.length === 0) return 'Unknown jobs'

  return ids
    .map((id, index) => titles[index]?.trim() || `Job ${id.slice(0, 8)}`)
    .join(' and ')
}
