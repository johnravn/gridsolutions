// Centralized job status color utilities using Radix theme colors
import type { JobStatus } from '../types'

/**
 * Radix theme color names for badges
 * Available colors: gray, blue, green, red, amber, orange, yellow, purple, violet,
 * indigo, cyan, teal, mint, lime, grass, brown, bronze, gold, sky, plum, pink,
 * crimson, ruby, tomato
 */

// Radix Badge color type
export type RadixBadgeColor =
  | 'gray'
  | 'blue'
  | 'green'
  | 'red'
  | 'amber'
  | 'orange'
  | 'yellow'
  | 'purple'
  | 'violet'
  | 'indigo'
  | 'cyan'
  | 'teal'
  | 'mint'
  | 'lime'
  | 'grass'
  | 'brown'
  | 'bronze'
  | 'gold'
  | 'sky'
  | 'plum'
  | 'pink'
  | 'crimson'
  | 'ruby'
  | 'tomato'

/**
 * Get the Radix theme color for a job status badge
 * Each status has a semantically appropriate color:
 * - draft: gray (neutral, not started)
 * - planned: blue (planning phase)
 * - requested: cyan (request sent, waiting)
 * - confirmed: indigo (confirmed, committed)
 * - in_progress: amber (active work)
 * - completed: teal (done but not invoiced)
 * - canceled: red (cancelled)
 * - invoiced: purple (invoiced, pending payment)
 * - paid: green (success, paid)
 */
export function getJobStatusColor(status: JobStatus): RadixBadgeColor {
  switch (status) {
    case 'draft':
      return 'gray'
    case 'planned':
      return 'blue'
    case 'requested':
      return 'cyan'
    case 'confirmed':
      return 'indigo'
    case 'in_progress':
      return 'amber'
    case 'completed':
      return 'teal'
    case 'canceled':
      return 'red'
    case 'invoiced':
      return 'purple'
    case 'paid':
      return 'green'
    default:
      return 'gray'
  }
}

/**
 * Freelancers must not see billing statuses past completed.
 * Single owner for list, inspector header, and overview timeline.
 */
export function maskJobStatusForRole(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (
    companyRole === 'freelancer' &&
    (status === 'invoiced' || status === 'paid')
  ) {
    return 'completed'
  }
  return status
}

/**
 * Type-safe record of all status colors
 */
export const JOB_STATUS_COLORS: Record<JobStatus, RadixBadgeColor> = {
  draft: 'gray',
  planned: 'blue',
  requested: 'cyan',
  confirmed: 'indigo',
  in_progress: 'amber',
  completed: 'teal',
  canceled: 'red',
  invoiced: 'purple',
  paid: 'green',
}

/**
 * Get CSS variables for timeline visualization (dots, lines, backgrounds)
 * Returns appropriate Radix theme CSS variables based on the status color
 */
export function getStatusTimelineColors(status: JobStatus): {
  bg: string
  border: string
  text: string
  dotBg: string
} {
  const colorName = getJobStatusColor(status)

  // Map Radix color names to CSS variable scales
  // Using appropriate scales for timeline visualization
  switch (colorName) {
    case 'gray':
      return {
        bg: 'var(--gray-3)',
        border: 'var(--gray-6)',
        text: 'var(--gray-11)',
        dotBg: 'var(--gray-5)',
      }
    case 'blue':
      return {
        bg: 'var(--blue-4)',
        border: 'var(--blue-7)',
        text: 'var(--blue-11)',
        dotBg: 'var(--blue-6)',
      }
    case 'cyan':
      return {
        bg: 'var(--cyan-4)',
        border: 'var(--cyan-7)',
        text: 'var(--cyan-11)',
        dotBg: 'var(--cyan-6)',
      }
    case 'indigo':
      return {
        bg: 'var(--indigo-4)',
        border: 'var(--indigo-7)',
        text: 'var(--indigo-11)',
        dotBg: 'var(--indigo-6)',
      }
    case 'amber':
      return {
        bg: 'var(--amber-4)',
        border: 'var(--amber-7)',
        text: 'var(--amber-11)',
        dotBg: 'var(--amber-6)',
      }
    case 'teal':
      return {
        bg: 'var(--teal-4)',
        border: 'var(--teal-7)',
        text: 'var(--teal-11)',
        dotBg: 'var(--teal-6)',
      }
    case 'red':
      return {
        bg: 'var(--red-3)',
        border: 'var(--red-6)',
        text: 'var(--red-11)',
        dotBg: 'var(--red-5)',
      }
    case 'purple':
      return {
        bg: 'var(--purple-4)',
        border: 'var(--purple-7)',
        text: 'var(--purple-11)',
        dotBg: 'var(--purple-6)',
      }
    case 'green':
      return {
        bg: 'var(--green-4)',
        border: 'var(--green-7)',
        text: 'var(--green-11)',
        dotBg: 'var(--green-6)',
      }
    default:
      return {
        bg: 'var(--gray-3)',
        border: 'var(--gray-6)',
        text: 'var(--gray-11)',
        dotBg: 'var(--gray-5)',
      }
  }
}
