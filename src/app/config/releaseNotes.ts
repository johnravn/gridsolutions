/**
 * Application version and release notes for the "What's new" popover.
 *
 * Release checklist:
 * 1. Bump APP_VERSION below
 * 2. Update RELEASE_NOTES (title + highlights for that release)
 * 3. Run npm run test && npm run build:check
 * 4. Merge PR and verify on Vercel preview
 */
export const APP_VERSION = '1.12.0'

export type ReleaseHighlight = {
  title: string
  description: string
}

export const RELEASE_NOTES = {
  version: APP_VERSION,
  title: "What's new in Grid",
  highlights: [
    {
      title: 'Offer options block',
      description:
        'Add optional packages and add-ons to pretty offers. Customers choose on the public offer page and totals update live.',
    },
    {
      title: 'Sync basis to bookings',
      description:
        'When applying an offer basis to a job, preview what will change and review equipment conflicts before confirming.',
    },
    {
      title: 'Smarter home conflicts',
      description:
        'Conflict alerts on the home dashboard focus on jobs where you are project lead.',
    },
    {
      title: 'Clearer conflict details',
      description: 'Conflict cards show overlap duration and period context.',
    },
  ],
} as const satisfies {
  version: string
  title: string
  highlights: ReadonlyArray<ReleaseHighlight>
}
