import type { JobBookingConflicts } from '@features/conflicts/api/queries'

export const COPY_JOB_CONFLICT_KINDS = [
  'crew',
  'equipment',
  'groups',
  'vehicles',
] as const

export type CopyJobConflictKind = (typeof COPY_JOB_CONFLICT_KINDS)[number]

export type CopyJobResult = {
  jobId: string
  conflicts: Array<CopyJobConflictKind>
}

const LABELS: Record<CopyJobConflictKind, string> = {
  crew: 'crew',
  equipment: 'equipment',
  groups: 'group',
  vehicles: 'vehicle',
}

export function copyJobConflictKinds(
  conflicts: JobBookingConflicts | null | undefined,
): Array<CopyJobConflictKind> {
  if (!conflicts) return []
  const kinds: Array<CopyJobConflictKind> = []
  if (conflicts.crew.length > 0) kinds.push('crew')
  if (conflicts.equipment.length > 0) kinds.push('equipment')
  if (conflicts.groups.length > 0) kinds.push('groups')
  if (conflicts.vehicles.length > 0) kinds.push('vehicles')
  return kinds
}

export function parseCopyJobConflictKinds(
  value: unknown,
): Array<CopyJobConflictKind> {
  if (!Array.isArray(value)) return []
  const kinds = new Set(value.filter((item) => typeof item === 'string'))
  return COPY_JOB_CONFLICT_KINDS.filter((kind) => kinds.has(kind))
}

export function parseCopyJobRpcResult(data: unknown): CopyJobResult {
  if (typeof data === 'string' && data.length > 0) {
    return { jobId: data, conflicts: [] }
  }
  if (data && typeof data === 'object') {
    const row = data as {
      job_id?: unknown
      jobId?: unknown
      conflicts?: unknown
    }
    const jobId =
      typeof row.job_id === 'string'
        ? row.job_id
        : typeof row.jobId === 'string'
          ? row.jobId
          : null
    if (!jobId) throw new Error('Copy job did not return an id')
    return {
      jobId,
      conflicts: parseCopyJobConflictKinds(row.conflicts),
    }
  }
  throw new Error('Copy job did not return an id')
}

export function formatCopyJobConflictMessage(
  kinds: Array<CopyJobConflictKind>,
  jobTitle?: string | null,
): string {
  const labels = kinds.map((kind) => LABELS[kind])
  if (labels.length === 0) return ''
  const name = jobTitle?.trim()
  const prefix = name
    ? `Copying "${name}" created conflicts`
    : 'There are conflicts'
  if (labels.length === 1) {
    return `${prefix} on ${labels[0]} bookings.`
  }
  if (labels.length === 2) {
    return `${prefix} on ${labels[0]} and ${labels[1]} bookings.`
  }
  return `${prefix} on ${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)} bookings.`
}

export function copyJobConflictToastTitle(jobTitle: string): string {
  const name = jobTitle.trim()
  return name ? `Copied "${name}"` : 'Copied job'
}

export function copyJobResultTab(
  conflicts: Array<CopyJobConflictKind>,
): 'bookings' | 'overview' {
  return conflicts.length > 0 ? 'bookings' : 'overview'
}
