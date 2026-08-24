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
  const logged = previouslyLoggedJobs.filter((job) =>
    loggingJobMatchesSearch(job, search),
  )
  const loggedIds = new Set(logged.map((job) => job.id))
  const others = jobs
    .filter((job) => !loggedIds.has(job.id))
    .filter((job) => jobStartsWithinLoggingWindow(job.start_at, now))
    .slice(0, maxOtherJobs)
  return [...logged, ...others]
}
