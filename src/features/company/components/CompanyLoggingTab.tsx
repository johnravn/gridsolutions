import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Select,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Lock } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompany } from '@shared/companies/CompanyProvider'
import {  crewIndexQuery } from '../../crew/api/queries'
import {
  loggingPeriodsQuery,
  setLoggingPeriodLock,
} from '../../logging/api/loggingPeriods'
import { timeEntriesQuery } from '../../logging/api/timeEntries'
import TimeEntriesTable from '../../logging/components/TimeEntriesTable'
import {
  formatMonthInput,
  getMonthOptions,
  getRange,
} from '../../logging/lib/timeEntryRange'
import type {CrewPerson} from '../../crew/api/queries';
import type { LoggingPeriod } from '../../logging/api/loggingPeriods'

type UserFilter = 'all' | string

export default function CompanyLoggingTab() {
  const { companyId } = useCompany()
  const { companyRole, isGlobalSuperuser, userId } = useAuthz()
  const qc = useQueryClient()
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    formatMonthInput(new Date()),
  )
  const selectedYear =
    Number(selectedMonth.split('-')[0]) || new Date().getFullYear()
  const monthOptions = React.useMemo(
    () => getMonthOptions(selectedYear),
    [selectedYear],
  )
  const yearOptions = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  }, [])
  const { from, to, label } = React.useMemo(
    () => getRange('month', selectedMonth),
    [selectedMonth],
  )

  const [selectedUserId, setSelectedUserId] = React.useState<UserFilter>('all')

  const { data: employees = [], isLoading: isEmployeesLoading } = useQuery({
    ...(companyId
      ? crewIndexQuery({ companyId, kind: 'all' })
      : {
          queryKey: ['company', 'none', 'crew-index', 'all'] as const,
          queryFn: async () => [],
        }),
    enabled: !!companyId,
  })

  const employeesSorted = React.useMemo(() => {
    const list = employees.filter((person) => person.role !== 'freelancer')
    list.sort((a, b) => getEmployeeLabel(a).localeCompare(getEmployeeLabel(b)))
    return list
  }, [employees])

  React.useEffect(() => {
    if (
      selectedUserId !== 'all' &&
      employeesSorted.length > 0 &&
      !employeesSorted.some((employee) => employee.user_id === selectedUserId)
    ) {
      setSelectedUserId('all')
    }
  }, [employeesSorted, selectedUserId])

  const effectiveUserId = selectedUserId === 'all' ? null : selectedUserId

  const entriesEnabled = Boolean(companyId)
  const { data: entries = [], isLoading } = useQuery({
    ...timeEntriesQuery({
      companyId: companyId ?? '',
      userId: effectiveUserId,
      from,
      to,
    }),
    enabled: entriesEnabled,
  })

  const { data: loggingPeriods = [] } = useQuery<Array<LoggingPeriod>>({
    queryKey: ['logging_periods', companyId ?? 'none', selectedYear],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return []
      const { queryFn } = loggingPeriodsQuery({ companyId, year: selectedYear })
      return queryFn()
    },
  })

  const lockedMonthSet = React.useMemo(() => {
    const set = new Set<string>()
    loggingPeriods.forEach((period) => {
      if (!period.is_locked) return
      const monthKey = toMonthKey(period.period_start)
      set.add(monthKey)
    })
    return set
  }, [loggingPeriods])

  const isPeriodLocked = lockedMonthSet.has(selectedMonth)
  const canManageLocks =
    companyRole === 'owner' || companyRole === 'super_user' || isGlobalSuperuser

  const toggleLockMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Missing company')
      if (!userId) throw new Error('Missing user')
      const periodStart = `${selectedMonth}-01`
      await setLoggingPeriodLock({
        companyId,
        periodStart,
        isLocked: !isPeriodLocked,
        lockedByUserId: userId,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['logging_periods', companyId, selectedYear],
      })
    },
  })

  const totalHours = React.useMemo(() => {
    const total = entries.reduce((acc, entry) => {
      const start = new Date(entry.start_at).getTime()
      const end = new Date(entry.end_at).getTime()
      const durationMs = Math.max(0, end - start)
      return acc + durationMs
    }, 0)
    return total / (1000 * 60 * 60)
  }, [entries])

  return (
    <section style={{ minHeight: 0 }}>
      <Flex direction="column" gap="4">
        <Card size="3">
          <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
            <Heading size="5">Logging</Heading>
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                Person
              </Text>
              <Select.Root
                value={selectedUserId}
                onValueChange={(value) => setSelectedUserId(value)}
                disabled={isEmployeesLoading}
              >
                <Select.Trigger placeholder="Select employee" />
                <Select.Content>
                  <Select.Item value="all">All staff</Select.Item>
                  {employeesSorted.map((employee) => (
                    <Select.Item
                      key={employee.user_id}
                      value={employee.user_id}
                    >
                      {getEmployeeLabel(employee)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
          </Flex>

          <Text size="2" color="gray" mb="3">
            Showing entries for {label}
          </Text>
          <Separator size="4" mb="3" />

          <Flex align="center" gap="3" wrap="wrap" mb="3">
            <Text size="2" color="gray">
              {entries.length} total
            </Text>
            <Select.Root
              value={String(selectedYear)}
              onValueChange={(value) => {
                const monthPart = selectedMonth.split('-')[1] ?? '01'
                setSelectedMonth(`${value}-${monthPart}`)
              }}
            >
              <Select.Trigger />
              <Select.Content>
                {yearOptions.map((year) => (
                  <Select.Item key={year} value={String(year)}>
                    {year}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <SegmentedControl.Root
              value={selectedMonth}
              onValueChange={(value) => setSelectedMonth(value)}
            >
              {monthOptions.map((month) => {
                const isLocked = lockedMonthSet.has(month.value)
                return (
                  <SegmentedControl.Item
                    key={month.value}
                    value={month.value}
                    style={
                      isLocked
                        ? {
                            backgroundColor: 'var(--green-3)',
                            color: 'var(--green-11)',
                          }
                        : undefined
                    }
                  >
                    <Flex align="center" gap="1">
                      <Text size="1">{month.label}</Text>
                      {isLocked && <Lock width={12} height={12} />}
                    </Flex>
                  </SegmentedControl.Item>
                )
              })}
            </SegmentedControl.Root>
            {canManageLocks && (
              <Flex align="center" gap="2">
                <Text size="2" color={isPeriodLocked ? 'green' : 'gray'}>
                  {isPeriodLocked ? 'Period locked' : 'Period open'}
                </Text>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => toggleLockMutation.mutate()}
                  disabled={toggleLockMutation.isPending}
                >
                  <Lock width={14} height={14} />
                  {isPeriodLocked ? 'Unlock period' : 'Lock period'}
                </Button>
              </Flex>
            )}
          </Flex>

          <Box style={{ overflowX: 'auto' }}>
            {isEmployeesLoading ? (
              <Text>Loading employees...</Text>
            ) : employeesSorted.length === 0 && selectedUserId !== 'all' ? (
              <Text color="gray">No employees found.</Text>
            ) : (
              <TimeEntriesTable entries={entries} isLoading={isLoading} />
            )}
          </Box>

          <Flex justify="end" mt="3">
            <Text size="4" weight="bold">
              Total: {totalHours.toFixed(2)} hours
            </Text>
          </Flex>
        </Card>
      </Flex>
    </section>
  )
}

function getEmployeeLabel(employee: CrewPerson) {
  return (
    employee.display_name ||
    [employee.first_name, employee.last_name].filter(Boolean).join(' ') ||
    employee.email
  )
}

function toMonthKey(value: string) {
  const match = value.match(/^(\d{4}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 7)
  }
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
