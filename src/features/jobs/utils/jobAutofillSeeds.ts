import type { JobStatus } from '../types'
import type { TechnicianCrewBookingMode } from './technicianCrewBooking'

/**
 * Temporary testing seeds for New job autofill.
 * List indices are applied with modulo against the company's current lists
 * (project leads, customers, contacts, recurring jobs, company users).
 * Use -1 for "none".
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
  /** When true, use companyCustomerIndex instead of customer/contact */
  isCompanyCustomer: boolean
  /** Index into company customers (-1 = none) */
  customerIndex: number
  /** Index into that customer's contacts (-1 = none) */
  contactIndex: number
  /** Index into company members when isCompanyCustomer (-1 = none) */
  companyCustomerIndex: number
  /** Index into company recurring jobs (-1 = none) */
  recurringJobIndex: number
  technicianCrewBooking: TechnicianCrewBookingMode
}

const JOB_STATUSES: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
]

type JobTemplate = {
  label: string
  title: string
  description: string
}

const JOB_TEMPLATES: Array<JobTemplate> = [
  {
    label: 'Corporate kickoff',
    title: 'Corporate Event Setup',
    description: 'Full production setup for corporate event',
  },
  {
    label: 'Concert production',
    title: 'Concert Production',
    description: 'Complete concert production package',
  },
  {
    label: 'Conference AV',
    title: 'Conference AV',
    description: 'AV equipment and operator support for conference',
  },
  {
    label: 'Wedding S&L',
    title: 'Wedding Sound & Lighting',
    description: 'Sound and lighting package for wedding reception',
  },
  {
    label: 'Festival stage',
    title: 'Festival Stage Management',
    description: 'Stage management and backline for festival day',
  },
  {
    label: 'Presentation',
    title: 'Corporate Presentation',
    description: 'Presentation screens, mics, and confidence monitors',
  },
  {
    label: 'Livestream',
    title: 'Live Streaming Setup',
    description: 'Multi-camera live streaming equipment package',
  },
  {
    label: 'Theater',
    title: 'Theater Production',
    description: 'Theater lighting, sound, and rigging support',
  },
  {
    label: 'Trade show',
    title: 'Trade Show Installation',
    description: 'Booth AV install and teardown for trade show',
  },
  {
    label: 'Product launch',
    title: 'Product Launch Event',
    description: 'Launch event production with IMAG and PA',
  },
  {
    label: 'Town hall',
    title: 'Company Town Hall AV',
    description: 'Internal town hall with screens, mics, and streaming',
  },
  {
    label: 'Gala dinner',
    title: 'Gala Dinner Production',
    description: 'Lighting and audio for seated gala dinner',
  },
  {
    label: 'Sports broadcast',
    title: 'Sports Broadcast Package',
    description: 'Cameras and commentary feed for sports coverage',
  },
  {
    label: 'Museum install',
    title: 'Museum Exhibition Install',
    description: 'Temporary AV install for exhibition opening',
  },
  {
    label: 'Press conference',
    title: 'Press Conference Kit',
    description: 'PA, recording, and mult boxes for press briefing',
  },
  {
    label: 'Club night',
    title: 'Club Night Rig',
    description: 'DJ booth, lights, and FOH for club night',
  },
  {
    label: 'Award show',
    title: 'Awards Ceremony',
    description: 'Stage, IMAG, and walk-in music for awards show',
  },
  {
    label: 'Hybrid meetup',
    title: 'Hybrid Meetup Streaming',
    description: 'In-room and remote audience streaming setup',
  },
  {
    label: 'Outdoor promo',
    title: 'Outdoor Promo Activation',
    description: 'Weatherproof PA and LED wall for plaza activation',
  },
  {
    label: 'Studio session',
    title: 'Studio Recording Session',
    description: 'Controlled studio capture day with engineer',
  },
  {
    label: 'School assembly',
    title: 'School Assembly AV',
    description: 'Simple PA and projection for school assembly',
  },
  {
    label: 'Church service',
    title: 'Church Service Production',
    description: 'Broadcast mix and camera coverage for service',
  },
  {
    label: 'Fashion show',
    title: 'Fashion Show Runway',
    description: 'Runway lighting, music playback, and follow spots',
  },
  {
    label: 'Charity gala',
    title: 'Charity Gala Evening',
    description: 'Auction AV, speeches, and ambient lighting',
  },
  {
    label: 'Outdoor cinema',
    title: 'Outdoor Cinema Night',
    description: 'Projector, screen, and wireless audio for cinema night',
  },
  {
    label: 'Panel discussion',
    title: 'Panel Discussion Recording',
    description: 'Multi-mic panel setup with ISO recording',
  },
  {
    label: 'Product demo',
    title: 'Product Demo Roadshow',
    description: 'Portable demo rig for retail activations',
  },
  {
    label: 'Esports broadcast',
    title: 'Esports Broadcast Desk',
    description: 'Caster desks, comms, and program feed for esports',
  },
  {
    label: 'Parade sound',
    title: 'Parade Route Sound',
    description: 'Mobile PA and wireless mics along parade route',
  },
  {
    label: 'Graduation',
    title: 'Graduation Ceremony',
    description: 'Ceremony PA, streaming, and stage monitors',
  },
  {
    label: 'Investor day',
    title: 'Investor Day Webcast',
    description: 'Investor presentations with secure webcast feed',
  },
  {
    label: 'Training workshop',
    title: 'Training Workshop AV',
    description: 'Workshop room mics, capture, and breakout support',
  },
  {
    label: 'Retail opening',
    title: 'Retail Store Opening',
    description: 'In-store PA, ribbon-cut mic, and background music',
  },
  {
    label: 'Boat event',
    title: 'Harbor Event Production',
    description: 'Waterfront stage with weather-rated equipment',
  },
  {
    label: 'Photo shoot',
    title: 'Brand Photo Shoot',
    description: 'Lighting and playback support for photo production',
  },
  {
    label: 'Podcast live',
    title: 'Live Podcast Recording',
    description: 'Multi-host podcast capture with live audience feed',
  },
  {
    label: 'Drive-in show',
    title: 'Drive-In Concert',
    description: 'FM transmitters and large-format PA for drive-in show',
  },
  {
    label: 'Exhibition demo',
    title: 'Exhibition Demo Stand',
    description: 'Interactive demo AV for exhibition booth',
  },
  {
    label: 'VIP lounge',
    title: 'VIP Lounge Experience',
    description: 'Ambient lighting and background AV for VIP lounge',
  },
  {
    label: 'New year party',
    title: 'New Year Celebration',
    description: 'Countdown show production with pyro-safe rigging',
  },
]

const DAY_OFFSETS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 21, 25, 28, 30,
]
const START_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
const DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10]

function buildJobAutofillSeeds(): Array<JobAutofillSeed> {
  const seeds: Array<JobAutofillSeed> = []
  let id = 1

  for (
    let templateIndex = 0;
    templateIndex < JOB_TEMPLATES.length;
    templateIndex += 1
  ) {
    const template = JOB_TEMPLATES[templateIndex]
    for (let variant = 0; variant < 5; variant += 1) {
      const mix = templateIndex * 5 + variant
      const customerMode = mix % 10
      const isCompanyCustomer = customerMode === 7 || customerMode === 8

      seeds.push({
        id: id++,
        label:
          variant === 0 ? template.label : `${template.label} ${variant + 1}`,
        title:
          variant === 0 ? template.title : `${template.title} (${variant + 1})`,
        description: `${template.description}. Variant ${variant + 1}.`,
        status: JOB_STATUSES[mix % JOB_STATUSES.length],
        daysFromNow: DAY_OFFSETS[mix % DAY_OFFSETS.length],
        startHour: START_HOURS[mix % START_HOURS.length],
        durationHours: DURATIONS[mix % DURATIONS.length],
        projectLeadIndex: mix % 8,
        isCompanyCustomer,
        customerIndex: isCompanyCustomer ? -1 : mix % 12,
        contactIndex: isCompanyCustomer ? -1 : mix % 4,
        companyCustomerIndex: isCompanyCustomer ? mix % 6 : -1,
        recurringJobIndex: mix % 5 === 0 ? -1 : mix % 6,
        technicianCrewBooking: mix % 3 === 0 ? 'open' : 'confirm_myself',
      })
    }
  }

  return seeds
}

export const JOB_AUTOFILL_SEEDS: Array<JobAutofillSeed> =
  buildJobAutofillSeeds()

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
