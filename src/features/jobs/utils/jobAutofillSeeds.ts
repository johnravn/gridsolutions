import type { JobStatus } from '../types'

/**
 * Temporary testing seeds for New job autofill.
 * List indices are applied with modulo against the company's current lists
 * (project leads, customers, contacts, recurring jobs). Use -1 for "none".
 */
export type JobAutofillSeed = {
  id: number
  /** Short label shown in the seed picker */
  label: string
  title: string
  description: string
  status: JobStatus
  /** Start date offset from today */
  daysFromNow: number
  startHour: number
  durationHours: number
  /** Index into company project leads (-1 = leave empty) */
  projectLeadIndex: number
  /** Index into company customers (-1 = none) */
  customerIndex: number
  /** Index into that customer's contacts (-1 = none) */
  contactIndex: number
  /** Index into company recurring jobs (-1 = none) */
  recurringJobIndex: number
  createCrewBooking: boolean
}

export const JOB_AUTOFILL_SEEDS: Array<JobAutofillSeed> = [
  {
    id: 1,
    label: 'Corporate kickoff',
    title: 'Corporate Event Setup',
    description: 'Full production setup for corporate event',
    status: 'planned',
    daysFromNow: 3,
    startHour: 9,
    durationHours: 4,
    projectLeadIndex: 0,
    customerIndex: 0,
    contactIndex: 0,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 2,
    label: 'Concert A',
    title: 'Concert Production',
    description: 'Complete concert production package',
    status: 'requested',
    daysFromNow: 7,
    startHour: 14,
    durationHours: 6,
    projectLeadIndex: 1,
    customerIndex: 1,
    contactIndex: 0,
    recurringJobIndex: 0,
    createCrewBooking: true,
  },
  {
    id: 3,
    label: 'Conference AV',
    title: 'Conference AV',
    description: 'AV equipment for conference',
    status: 'confirmed',
    daysFromNow: 10,
    startHour: 8,
    durationHours: 8,
    projectLeadIndex: 0,
    customerIndex: 2,
    contactIndex: 1,
    recurringJobIndex: -1,
    createCrewBooking: false,
  },
  {
    id: 4,
    label: 'Wedding S&L',
    title: 'Wedding Sound & Lighting',
    description: 'Sound and lighting for wedding',
    status: 'planned',
    daysFromNow: 14,
    startHour: 12,
    durationHours: 5,
    projectLeadIndex: 2,
    customerIndex: 0,
    contactIndex: 1,
    recurringJobIndex: 1,
    createCrewBooking: true,
  },
  {
    id: 5,
    label: 'Festival stage',
    title: 'Festival Stage Management',
    description: 'Stage management for festival',
    status: 'in_progress',
    daysFromNow: 1,
    startHour: 10,
    durationHours: 10,
    projectLeadIndex: 1,
    customerIndex: 3,
    contactIndex: 0,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 6,
    label: 'Presentation',
    title: 'Corporate Presentation',
    description: 'Presentation equipment setup',
    status: 'draft',
    daysFromNow: 5,
    startHour: 11,
    durationHours: 3,
    projectLeadIndex: 0,
    customerIndex: 1,
    contactIndex: 2,
    recurringJobIndex: 2,
    createCrewBooking: false,
  },
  {
    id: 7,
    label: 'Livestream',
    title: 'Live Streaming Setup',
    description: 'Live streaming equipment package',
    status: 'requested',
    daysFromNow: 21,
    startHour: 15,
    durationHours: 4,
    projectLeadIndex: 3,
    customerIndex: 4,
    contactIndex: 0,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 8,
    label: 'Theater',
    title: 'Theater Production',
    description: 'Theater production equipment',
    status: 'confirmed',
    daysFromNow: 28,
    startHour: 13,
    durationHours: 7,
    projectLeadIndex: 1,
    customerIndex: 2,
    contactIndex: 0,
    recurringJobIndex: 0,
    createCrewBooking: true,
  },
  {
    id: 9,
    label: 'Trade show',
    title: 'Trade Show Installation',
    description: 'Trade show installation and setup',
    status: 'planned',
    daysFromNow: 18,
    startHour: 7,
    durationHours: 9,
    projectLeadIndex: 2,
    customerIndex: 5,
    contactIndex: 1,
    recurringJobIndex: 1,
    createCrewBooking: false,
  },
  {
    id: 10,
    label: 'Product launch',
    title: 'Product Launch Event',
    description: 'Product launch event production',
    status: 'requested',
    daysFromNow: 12,
    startHour: 16,
    durationHours: 5,
    projectLeadIndex: 0,
    customerIndex: 3,
    contactIndex: 2,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 11,
    label: 'Town hall',
    title: 'Company Town Hall AV',
    description: 'Internal town hall with screens and mics',
    status: 'planned',
    daysFromNow: 4,
    startHour: 9,
    durationHours: 3,
    projectLeadIndex: 4,
    customerIndex: 0,
    contactIndex: 0,
    recurringJobIndex: 3,
    createCrewBooking: true,
  },
  {
    id: 12,
    label: 'Gala dinner',
    title: 'Gala Dinner Production',
    description: 'Lighting and audio for seated gala',
    status: 'confirmed',
    daysFromNow: 25,
    startHour: 17,
    durationHours: 6,
    projectLeadIndex: 1,
    customerIndex: 6,
    contactIndex: 0,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 13,
    label: 'Sports broadcast',
    title: 'Sports Broadcast Package',
    description: 'Cameras and commentary feed for sports',
    status: 'in_progress',
    daysFromNow: 2,
    startHour: 8,
    durationHours: 8,
    projectLeadIndex: 2,
    customerIndex: 1,
    contactIndex: 1,
    recurringJobIndex: 2,
    createCrewBooking: false,
  },
  {
    id: 14,
    label: 'Museum install',
    title: 'Museum Exhibition Install',
    description: 'Temporary AV install for exhibition opening',
    status: 'draft',
    daysFromNow: 30,
    startHour: 10,
    durationHours: 4,
    projectLeadIndex: 0,
    customerIndex: 7,
    contactIndex: 0,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 15,
    label: 'Press conference',
    title: 'Press Conference Kit',
    description: 'PA, recording, and mult boxes',
    status: 'requested',
    daysFromNow: 6,
    startHour: 11,
    durationHours: 2,
    projectLeadIndex: 3,
    customerIndex: 2,
    contactIndex: 3,
    recurringJobIndex: 0,
    createCrewBooking: true,
  },
  {
    id: 16,
    label: 'Club night',
    title: 'Club Night Rig',
    description: 'DJ booth, lights, and FOH',
    status: 'planned',
    daysFromNow: 9,
    startHour: 18,
    durationHours: 7,
    projectLeadIndex: 1,
    customerIndex: 4,
    contactIndex: 1,
    recurringJobIndex: 1,
    createCrewBooking: false,
  },
  {
    id: 17,
    label: 'Award show',
    title: 'Awards Ceremony',
    description: 'Stage, IMAG, and walk-in music',
    status: 'confirmed',
    daysFromNow: 16,
    startHour: 14,
    durationHours: 6,
    projectLeadIndex: 0,
    customerIndex: 5,
    contactIndex: 0,
    recurringJobIndex: -1,
    createCrewBooking: true,
  },
  {
    id: 18,
    label: 'Hybrid meetup',
    title: 'Hybrid Meetup Streaming',
    description: 'Room + remote audience streaming',
    status: 'planned',
    daysFromNow: 11,
    startHour: 13,
    durationHours: 3,
    projectLeadIndex: 2,
    customerIndex: 8,
    contactIndex: 0,
    recurringJobIndex: 4,
    createCrewBooking: true,
  },
  {
    id: 19,
    label: 'Outdoor promo',
    title: 'Outdoor Promo Activation',
    description: 'Weatherproof PA and LED for plaza',
    status: 'requested',
    daysFromNow: 20,
    startHour: 12,
    durationHours: 5,
    projectLeadIndex: 4,
    customerIndex: 3,
    contactIndex: 1,
    recurringJobIndex: -1,
    createCrewBooking: false,
  },
  {
    id: 20,
    label: 'Studio session',
    title: 'Studio Recording Session',
    description: 'Controlled studio capture day',
    status: 'draft',
    daysFromNow: 8,
    startHour: 10,
    durationHours: 8,
    projectLeadIndex: 1,
    customerIndex: 9,
    contactIndex: 2,
    recurringJobIndex: 0,
    createCrewBooking: true,
  },
]

export function getJobAutofillSeed(id: number): JobAutofillSeed | undefined {
  return JOB_AUTOFILL_SEEDS.find((seed) => seed.id === id)
}

/** Pick a random seed id, optionally avoiding the current one. */
export function pickRandomJobAutofillSeedId(excludeId?: number | null): number {
  if (JOB_AUTOFILL_SEEDS.length === 0) return 1
  if (JOB_AUTOFILL_SEEDS.length === 1) return JOB_AUTOFILL_SEEDS[0].id

  const candidates =
    excludeId == null
      ? JOB_AUTOFILL_SEEDS
      : JOB_AUTOFILL_SEEDS.filter((seed) => seed.id !== excludeId)
  const pool = candidates.length > 0 ? candidates : JOB_AUTOFILL_SEEDS
  return pool[Math.floor(Math.random() * pool.length)].id
}

/** Resolve a seed list index against a company list. -1 or empty → null. */
export function pickBySeedIndex<T>(list: Array<T>, index: number): T | null {
  if (index < 0 || list.length === 0) return null
  return list[index % list.length] ?? null
}
