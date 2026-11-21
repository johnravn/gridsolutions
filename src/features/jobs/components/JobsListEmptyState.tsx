import { Button, Flex, Text } from '@radix-ui/themes'
import { jobsListEmptyMessage } from '../utils/jobsListEmptyMessage'

export function JobsListEmptyState({
  scoped,
  hasFilter,
  search = '',
  unfilteredSearchCount,
  unfilteredSearchCountLoading,
  onClearFilters,
}: {
  scoped: boolean
  hasFilter: boolean
  search?: string
  unfilteredSearchCount?: number
  unfilteredSearchCountLoading?: boolean
  onClearFilters?: () => void
}) {
  const trimmed = search.trim()
  const showUnfilteredHint =
    !scoped &&
    hasFilter &&
    trimmed.length > 0 &&
    !unfilteredSearchCountLoading &&
    (unfilteredSearchCount ?? 0) > 0 &&
    !!onClearFilters

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3"
      py="6"
      style={{ textAlign: 'center', maxWidth: 360, marginInline: 'auto' }}
    >
      <Text size="2" color="gray">
        {jobsListEmptyMessage({ scoped, hasFilter })}
      </Text>
      {showUnfilteredHint ? (
        <>
          <Text size="2">
            {unfilteredSearchCount === 1
              ? `1 job matches “${trimmed}” with filters cleared`
              : `${unfilteredSearchCount} jobs match “${trimmed}” with filters cleared`}
          </Text>
          <Button size="2" variant="soft" onClick={onClearFilters}>
            Clear filters
          </Button>
        </>
      ) : null}
    </Flex>
  )
}
