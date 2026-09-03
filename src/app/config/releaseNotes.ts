/**
 * Application version and release notes for the "What's new" popover.
 *
 * The popover only auto-opens when major or minor changes (1.13.x → 1.14.0).
 * Patch bumps (1.13.10 → 1.13.11) still update the sidebar version, but do
 * not prompt users again.
 *
 * Release checklist:
 * 1. Bump APP_VERSION below
 * 2. On major/minor bumps, update RELEASE_NOTES (title + highlights)
 * 3. Run npm run test && npm run build:check
 * 4. Merge PR and verify on Vercel preview
 */
export const APP_VERSION = '1.13.13'

/** Major.minor used to decide when to show "What's new". Patch is ignored. */
export function whatsNewReleaseChannel(version: string): string {
  const [major = version, minor = '0'] = version.split('.')
  return `${major}.${minor}`
}

export type ReleaseHighlight = {
  title: string
  description: string
}

export const RELEASE_NOTES = {
  version: APP_VERSION,
  title: "What's new in Grid",
  highlights: [
    {
      title: 'My jobs on the Jobs list',
      description:
        'Filter the Jobs tab to jobs you are crew or project lead on, sorted by date — without the two-week window on Home.',
    },
    {
      title: 'Hourly crew hours on offers',
      description:
        'The offer editor no longer bills hourly crew as 24 hours per day. Set start and end times, or type hours per day, before crew bookings exist.',
    },
    {
      title: 'Private customers in Conta',
      description:
        'Sync private / individual customers without an organisation number. Search Conta by name or email, pick the right match when several exist, and see which Conta customers are already linked.',
    },
    {
      title: 'Technician crew booking on new jobs',
      description:
        'New jobs always create a Technician crew slot for the job duration. Choose whether to leave it open or confirm yourself on it.',
    },
    {
      title: 'One Invoice tab',
      description:
        'Create, preview, and review invoice history on a single Invoice tab — for jobs and for recurring series.',
    },
    {
      title: 'Reorder invoice lines',
      description:
        'Drag lines in the job invoice editor to choose the order that is sent to Conta.',
    },
    {
      title: 'Recurring jobs for the whole company',
      description:
        'Everyone on staff can see recurring series in the jobs list. Jobs that belong to a series stay hidden until you turn on “Show jobs in recurring series”.',
    },
    {
      title: 'Multi-job invoicing',
      description:
        'Invoice several jobs from a recurring series on one Conta invoice, with linked history and editable line-description templates.',
    },
    {
      title: 'Daily verse fix',
      description:
        'The home daily verse loads again after the 1.13 release — the serverless endpoint no longer fails on cold start.',
    },
    {
      title: 'Mobile list + inspector',
      description:
        'List pages open details in a slide-over drawer with a floating action button and sticky bottom actions — built for phones without losing the split-view desktop layout.',
    },
    {
      title: 'Jobs list that keeps going',
      description:
        'Jobs load as you scroll, and the status filter defaults to all statuses so you can find older work without hunting.',
    },
    {
      title: 'Flexible time logging',
      description:
        'Log hours against more than the job you are currently on, with a clearer month scroller and when/hours fields when creating or editing entries.',
    },
    {
      title: 'Group booking conflicts',
      description:
        'Booked equipment groups are checked as units. Overlaps show up on home conflict cards and in attention counts alongside item-level conflicts.',
    },
    {
      title: 'Simpler equipment bookings',
      description:
        'Equipment and vehicle bookings are treated as booked when they exist — less status noise when planning and packing a job.',
    },
    {
      title: 'Recurring job times',
      description:
        'Edit recurring job windows with the range picker, including adjusting the end time directly without redoing the whole period.',
    },
    {
      title: 'Bible version preference',
      description:
        'Choose BM11, NN11, NRSV, or The Message for the daily verse from Profile → Personalization.',
    },
    {
      title: 'Polish and fixes',
      description:
        'Matter cards show the correct author, offer PDF totals line up, public technical offer groups expand again, and toast/tab interactions feel smoother.',
    },
  ],
} as const satisfies {
  version: string
  title: string
  highlights: ReadonlyArray<ReleaseHighlight>
}
