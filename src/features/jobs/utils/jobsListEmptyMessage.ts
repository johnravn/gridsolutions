export function jobsListEmptyMessage({
  scoped,
  hasFilter,
}: {
  scoped: boolean
  hasFilter: boolean
}): string {
  if (scoped) {
    return hasFilter ? 'No jobs match your filters' : 'No jobs in this series'
  }
  return hasFilter ? 'No jobs match your filters' : 'No jobs yet'
}
