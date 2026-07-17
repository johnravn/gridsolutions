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
      title: 'Redesigned home dashboard',
      description:
        'Attention band for conflicts, invoices, and matters; multi-week job spans; active recurring series; and a clearer week overview.',
    },
    {
      title: 'Keyboard shortcuts',
      description:
        'Navigate, switch tabs, collapse panels, and create records from the keyboard. Customize bindings in Profile → Shortcuts.',
    },
    {
      title: 'Unified list + inspector layout',
      description:
        'Jobs, customers, inventory, and other list pages share a consistent resizable split view with smoother mobile stacking.',
    },
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
      title: 'Smarter conflicts',
      description:
        'Home conflict alerts focus on jobs where you are project lead, with clearer overlap duration and period context.',
    },
    {
      title: 'Recurring job periods',
      description:
        'Set an active start and optional end date on recurring series so they only generate within that window.',
    },
    {
      title: 'Polish throughout',
      description:
        'Animated tab indicators, improved date range pickers, denser UI chrome, and unsaved-change guards when closing offer editors.',
    },
  ],
} as const satisfies {
  version: string
  title: string
  highlights: ReadonlyArray<ReleaseHighlight>
}
