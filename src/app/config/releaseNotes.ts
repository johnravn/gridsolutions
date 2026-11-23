/**
 * Application version and release notes for the "What's new" popover.
 *
 * The popover only auto-opens when major or minor changes (1.13.x → 1.14.0).
 * Patch bumps (1.13.10 → 1.13.11) still update the sidebar version, but do
 * not prompt users again.
 *
 * Patch bumps on `main` are automatic (GitHub Action + Vercel ignoreCommand).
 * Do **not** push a standalone "Bump APP_VERSION" commit after ship.
 *
 * Release checklist (notable / What's New ships only):
 * 1. Bump major or minor below (or leave patch to the main bump bot)
 * 2. On major/minor bumps, update RELEASE_NOTES (title + highlights)
 * 3. Run npm run test && npm run build:check
 * 4. Merge to main when John asks — bot bumps patch if you did not
 */
export const APP_VERSION = '1.14.25'

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
      title: 'Accounting verified',
      description:
        'Project leads mark job Accounting as verified. Reporting charts and KPIs use verified jobs; the Jobs list shows Verified / Not verified on paid and invoiced work.',
    },
    {
      title: 'Conta on Accounting',
      description:
        'Open sent Conta invoice lines beside the ledger when the Accounting panel is wide enough. Link an existing Conta invoice by number, or refetch with an Updated … ago badge.',
    },
    {
      title: 'Crew org number + Conta costs',
      description:
        'Store a freelancer org number on the crew profile. Accounting suggests Conta received invoices by orgnr near job end, or falls back to the crew billing rate.',
    },
    {
      title: 'Ready to verify queues',
      description:
        'Home and Jobs surface paid/invoiced jobs that still need Accounting verification, so leads can clear the queue quickly.',
    },
    {
      title: 'Richer Reporting',
      description:
        'Monthly job profitability charts, Lead avatar + name, calendar-year period picker, Incomplete Accounting and Not verified KPI cards, and zero-aligned dual axes.',
    },
    {
      title: 'Jobs search',
      description:
        'Find jobs by number (including padded / # forms) and by project lead name. Empty search can show how many hits exist with filters cleared.',
    },
  ],
} as const satisfies {
  version: string
  title: string
  highlights: ReadonlyArray<ReleaseHighlight>
}
