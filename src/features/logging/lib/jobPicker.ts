const DEFAULT_MAX_OTHER_JOBS = 50

export type LoggingJobPickerItem = {
  id: string
  title: string
  jobnr: number | null
  start_at: string | null
  end_at: string | null
  customer?: { name: string | null } | null
  project_lead?: {
    display_name: string | null
    email?: string | null
  } | null
}

export type LoggingJobPickerSectionId = 'recent' | 'today' | 'jobs'

export type LoggingJobPickerSection<T extends LoggingJobPickerItem> = {
  id: LoggingJobPickerSectionId
  label: string
  jobs: Array<T>
}

export function loggingSearchTerm(search: string) {
  return search.trim().replace(/^#/, '')
}

export function jobStartsWithinLoggingWindow(
  startAt: string | null,
  now: Date,
): boolean {
  if (!startAt) return true
  const endOfWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2,
    23,
    59,
    59,
    999,
  )
  return new Date(startAt).getTime() <= endOfWindow.getTime()
}

export function loggingJobMatchesSearch(
  job: LoggingJobPickerItem,
  search: string,
): boolean {
  const q = loggingSearchTerm(search).toLowerCase()
  if (!q) return true
  const fields = [
    job.title,
    job.jobnr != null ? String(job.jobnr) : '',
    job.customer?.name ?? '',
    job.project_lead?.display_name ?? '',
    job.project_lead?.email ?? '',
  ]
  return fields.some((field) => field.toLowerCase().includes(q))
}

function sortJobsByStartDesc<T extends LoggingJobPickerItem>(jobs: Array<T>) {
  return [...jobs].sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0
    return bTime - aTime
  })
}

/**
 * Build the logging job picker as labeled sections.
 * - Empty search: today → recent logged → other jobs in the logging window
 * - Active search: matching recent + all matching index jobs (no date window)
 */
export function buildLoggingJobPickerSections<T extends LoggingJobPickerItem>({
  jobs,
  previouslyLoggedJobs,
  search,
  now,
  maxOtherJobs = DEFAULT_MAX_OTHER_JOBS,
}: {
  jobs: Array<T>
  previouslyLoggedJobs: Array<T>
  search: string
  now: Date
  maxOtherJobs?: number
}): Array<LoggingJobPickerSection<T>> {
  const searching = Boolean(loggingSearchTerm(search))
  const recent = previouslyLoggedJobs.filter((job) =>
    loggingJobMatchesSearch(job, search),
  )
  const recentIds = new Set(recent.map((job) => job.id))

  const indexJobs = jobs.filter((job) => !recentIds.has(job.id))
  const windowed = searching
    ? indexJobs
    : indexJobs.filter((job) => jobStartsWithinLoggingWindow(job.start_at, now))

  const today: Array<T> = []
  const others: Array<T> = []
  for (const job of windowed) {
    if (isJobOnToday(job, now)) today.push(job)
    else others.push(job)
  }

  const cappedOthers = sortJobsByStartDesc(others).slice(0, maxOtherJobs)
  const todaySorted = sortJobsByStartDesc(today)

  const sections: Array<LoggingJobPickerSection<T>> = []
  // Browse: Today first (most common attach target), then recent, then the rest.
  // Search: keep matches grouped with recent still easy to re-attach.
  if (!searching && todaySorted.length > 0) {
    sections.push({
      id: 'today',
      label: 'Today',
      jobs: todaySorted,
    })
  }
  if (recent.length > 0) {
    sections.push({
      id: 'recent',
      label: searching ? 'Matching recent' : 'Recently logged',
      jobs: recent,
    })
  }
  if (searching && todaySorted.length > 0) {
    sections.push({
      id: 'today',
      label: 'Today',
      jobs: todaySorted,
    })
  }
  if (cappedOthers.length > 0) {
    sections.push({
      id: 'jobs',
      label: searching ? 'Matching jobs' : 'Jobs',
      jobs: cappedOthers,
    })
  }
  return sections
}

export function buildLoggingJobPickerList<T extends LoggingJobPickerItem>({
  jobs,
  previouslyLoggedJobs,
  search,
  now,
  maxOtherJobs = DEFAULT_MAX_OTHER_JOBS,
}: {
  jobs: Array<T>
  previouslyLoggedJobs: Array<T>
  search: string
  now: Date
  maxOtherJobs?: number
}): Array<T> {
  return buildLoggingJobPickerSections({
    jobs,
    previouslyLoggedJobs,
    search,
    now,
    maxOtherJobs,
  }).flatMap((section) => section.jobs)
}

export function formatJobOption(
  job: Pick<LoggingJobPickerItem, 'title' | 'jobnr' | 'start_at'>,
  formatDate: (iso: string) => string,
) {
  const numberPart = job.jobnr != null ? `#${job.jobnr}` : 'Job'
  const titlePart = job.title ? ` — ${job.title}` : ''
  const datePart = job.start_at ? ` (${formatDate(job.start_at)})` : ''
  return `${numberPart}${titlePart}${datePart}`
}

export function isJobOnToday(
  job: Pick<LoggingJobPickerItem, 'start_at' | 'end_at'>,
  now = new Date(),
): boolean {
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1
  if (job.start_at) {
    const t = new Date(job.start_at).getTime()
    if (t >= todayStart && t < todayEnd) return true
  }
  if (job.end_at) {
    const t = new Date(job.end_at).getTime()
    if (t >= todayStart && t < todayEnd) return true
  }
  return false
}
