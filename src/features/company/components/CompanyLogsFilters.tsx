import { Box, Flex, Select, Text, TextField } from '@radix-ui/themes'
import {
  ACTIVITY_CATEGORY_GROUPS,
  ACTIVITY_CATEGORY_OPTIONS,
} from '@features/latest/utils/activityCategories'
import type { ActivityType } from '@features/latest/types'
import type { CrewPerson } from '../../crew/api/queries'

export type LogsDatePreset = 'all' | '24h' | '7d' | '30d' | 'custom'

export type CompanyLogsFilterState = {
  category: string
  actorUserId: string
  datePreset: LogsDatePreset
  dateFrom: string
  dateTo: string
  search: string
}

export const DEFAULT_LOGS_FILTERS: CompanyLogsFilterState = {
  category: 'All',
  actorUserId: 'all',
  datePreset: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
}

export function activityTypesForCategory(
  category: string,
): Array<ActivityType> | undefined {
  if (!category || category === 'All') return undefined
  const types = ACTIVITY_CATEGORY_GROUPS[category]
  return types && types.length > 0 ? types : undefined
}

export function dateRangeFromFilters(filters: CompanyLogsFilterState): {
  from: string | null
  to: string | null
} {
  const now = new Date()
  if (filters.datePreset === 'all') return { from: null, to: null }
  if (filters.datePreset === '24h') {
    return {
      from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      to: null,
    }
  }
  if (filters.datePreset === '7d') {
    return {
      from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      to: null,
    }
  }
  if (filters.datePreset === '30d') {
    return {
      from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: null,
    }
  }
  const from = filters.dateFrom
    ? new Date(`${filters.dateFrom}T00:00:00`).toISOString()
    : null
  const to = filters.dateTo
    ? new Date(`${filters.dateTo}T23:59:59.999`).toISOString()
    : null
  return { from, to }
}

function getEmployeeLabel(employee: CrewPerson) {
  return (
    employee.display_name ||
    [employee.first_name, employee.last_name].filter(Boolean).join(' ') ||
    employee.email
  )
}

export default function CompanyLogsFilters({
  filters,
  onChange,
  actors,
  actorsLoading,
}: {
  filters: CompanyLogsFilterState
  onChange: (next: CompanyLogsFilterState) => void
  actors: Array<CrewPerson>
  actorsLoading?: boolean
}) {
  const set = <TKey extends keyof CompanyLogsFilterState>(
    key: TKey,
    value: CompanyLogsFilterState[TKey],
  ) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <Flex direction="column" gap="3" style={{ minWidth: 0 }}>
      <Flex align="center" gap="3" wrap="wrap">
        <Box style={{ minWidth: 160, flex: '1 1 160px' }}>
          <TextField.Root
            placeholder="Search title or description…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            size="2"
          />
        </Box>

        <Flex align="center" gap="2">
          <Text size="1" color="gray">
            Type
          </Text>
          <Select.Root
            value={filters.category}
            onValueChange={(value) => set('category', value)}
          >
            <Select.Trigger placeholder="Type" />
            <Select.Content>
              <Select.Item value="All">All types</Select.Item>
              {ACTIVITY_CATEGORY_OPTIONS.map((category) => (
                <Select.Item key={category} value={category}>
                  {category}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex align="center" gap="2">
          <Text size="1" color="gray">
            Actor
          </Text>
          <Select.Root
            value={filters.actorUserId}
            onValueChange={(value) => set('actorUserId', value)}
            disabled={actorsLoading}
          >
            <Select.Trigger placeholder="Actor" />
            <Select.Content>
              <Select.Item value="all">Anyone</Select.Item>
              {actors.map((person) => (
                <Select.Item key={person.user_id} value={person.user_id}>
                  {getEmployeeLabel(person)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex align="center" gap="2">
          <Text size="1" color="gray">
            When
          </Text>
          <Select.Root
            value={filters.datePreset}
            onValueChange={(value) =>
              set('datePreset', value as LogsDatePreset)
            }
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="all">All time</Select.Item>
              <Select.Item value="24h">Last 24 hours</Select.Item>
              <Select.Item value="7d">Last 7 days</Select.Item>
              <Select.Item value="30d">Last 30 days</Select.Item>
              <Select.Item value="custom">Custom range</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>

      {filters.datePreset === 'custom' && (
        <Flex align="center" gap="3" wrap="wrap">
          <Flex align="center" gap="2">
            <Text size="1" color="gray">
              From
            </Text>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              style={{
                font: 'inherit',
                fontSize: 'var(--font-size-2)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-2)',
                border: '1px solid var(--gray-a6)',
                background: 'var(--color-panel-solid)',
                color: 'inherit',
              }}
            />
          </Flex>
          <Flex align="center" gap="2">
            <Text size="1" color="gray">
              To
            </Text>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              style={{
                font: 'inherit',
                fontSize: 'var(--font-size-2)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-2)',
                border: '1px solid var(--gray-a6)',
                background: 'var(--color-panel-solid)',
                color: 'inherit',
              }}
            />
          </Flex>
        </Flex>
      )}
    </Flex>
  )
}
