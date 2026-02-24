// src/pages/CalendarPage.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Calendar, List, Search, ShareAndroid } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import CompanyCalendarPro from '@features/calendar/components/CompanyCalendarPro'
import SubscribeToCalendarDialog from '@features/calendar/components/SubscribeToCalendarDialog'
import {
  applyCalendarFilter,
  toEventInputs,
} from '@features/calendar/components/domain'
import { companyCalendarQuery } from '@features/calendar/api/queries'
import { vehiclesIndexQuery } from '@features/vehicles/api/queries'
import { inventoryIndexQuery } from '@features/inventory/api/queries'
import { crewIndexQuery } from '@features/crew/api/queries'
import { jobsIndexQuery } from '@features/jobs/api/queries'
import { fuzzySearch } from '@shared/lib/generalFunctions'

type Category = 'jobDuration' | 'equipment' | 'crew' | 'transport' | 'all'

export default function CalendarPage() {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const [category, setCategory] = React.useState<Category>('jobDuration')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(
    null,
  )
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [listMode, setListMode] = React.useState(false)
  const [subscribeDialogOpen, setSubscribeDialogOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLDivElement>(null)

  // Set default category based on role
  React.useEffect(() => {
    if (companyRole === 'freelancer') {
      setCategory('crew')
    }
  }, [companyRole])

  // Close suggestions when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showSuggestions])

  // Fetch all calendar events for the company (all categories)
  const { data: calendarRecords = [] } = useQuery({
    ...companyCalendarQuery({
      companyId: companyId ?? '',
      categories: undefined, // Fetch all categories
      userId,
      companyRole,
    }),
    enabled: !!companyId,
  })

  // Fetch suggestions based on category
  const shouldFetchSuggestions = category !== 'all' && !!companyId

  // Vehicles for transport
  const { data: vehicles = [] } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '',
      includeExternal: true,
      search: searchQuery,
    }),
    enabled: shouldFetchSuggestions && category === 'transport',
  })

  // Items for equipment
  const { data: itemsData } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '',
      page: 1,
      pageSize: 100,
      search: searchQuery,
      showActive: true,
      showInactive: false,
      showInternal: true,
      showExternal: true,
      showGroupOnlyItems: false,
      showGroups: false,
      showItems: true,
      category: null,
      sortBy: 'name',
      sortDir: 'asc',
    }),
    enabled: shouldFetchSuggestions && category === 'equipment',
  })
  const items = itemsData?.rows || []

  // Crew for crew
  const { data: crew = [] } = useQuery({
    ...crewIndexQuery({
      companyId: companyId ?? '',
      kind: undefined,
    }),
    enabled: shouldFetchSuggestions && category === 'crew',
  })

  // Jobs for job duration
  const { data: jobs = [] } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '',
      search: searchQuery,
    }),
    enabled: shouldFetchSuggestions && category === 'jobDuration',
  })

  // Get suggestions based on category with fuzzy search filtering
  const suggestions = React.useMemo(() => {
    let allSuggestions: Array<{ id: string; name: string; subtitle?: string }> =
      []

    if (category === 'transport') {
      allSuggestions = vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        subtitle: v.registration_no || undefined,
      }))
    } else if (category === 'equipment') {
      allSuggestions = items.map((item) => ({
        id: item.id,
        name: item.name,
        subtitle: item.category_name || undefined,
      }))
    } else if (category === 'crew') {
      allSuggestions = crew.map((c) => ({
        id: c.user_id,
        name:
          c.display_name ||
          [c.first_name, c.last_name].filter(Boolean).join(' ') ||
          c.email,
        subtitle: c.email,
      }))
    } else if (category === 'jobDuration') {
      allSuggestions = jobs.map((job) => ({
        id: job.id,
        name: job.title,
        subtitle: job.customer?.name || undefined,
      }))
    }

    // Apply fuzzy search filtering if search query exists
    if (searchQuery.trim()) {
      return fuzzySearch(
        allSuggestions,
        searchQuery,
        [(s) => s.name, (s) => s.subtitle ?? ''],
        0.3,
      )
    }

    return allSuggestions
  }, [category, vehicles, items, crew, jobs, searchQuery])

  // Helper to check if time period is Job duration
  const isJobDuration = (record: { title?: string | null }) =>
    record.title?.toLowerCase().includes('job duration') ?? false

  // Filter events based on category and selected entity
  const events = React.useMemo(() => {
    let baseEvents = toEventInputs(calendarRecords)

    // Always filter out regular program periods (keep only job duration for job events)
    // But keep all other event types (equipment, crew, transport)
    baseEvents = baseEvents.filter((event) => {
      const record = calendarRecords.find((r) => r.id === event.id)
      if (!record) return false
      const kind = (event.extendedProps as any)?.kind
      // If it's a job event, only include if it's job duration (not regular program)
      if (kind === 'job') {
        return isJobDuration(record)
      }
      // For other kinds (item, vehicle, crew), always include them
      return true
    })

    // Map category to kind for filtering
    const categoryToKind: Record<
      Category,
      Array<'job' | 'item' | 'vehicle' | 'crew'> | null
    > = {
      all: null, // Show all (already filtered above)
      jobDuration: ['job'],
      equipment: ['item'],
      transport: ['vehicle'],
      crew: ['crew'],
    }

    const kinds = categoryToKind[category]
    const scope = selectedEntityId
      ? category === 'transport'
        ? { vehicleId: selectedEntityId }
        : category === 'equipment'
          ? { itemId: selectedEntityId }
          : category === 'crew'
            ? { userId: selectedEntityId }
            : category === 'jobDuration'
              ? { jobId: selectedEntityId }
              : undefined
      : undefined

    return applyCalendarFilter(baseEvents, {
      kinds: kinds || undefined,
      scope,
    })
  }, [calendarRecords, category, selectedEntityId])

  const handleSelectSuggestion = (id: string) => {
    setSelectedEntityId(id)
    const suggestion = suggestions.find((s) => s.id === id)
    if (suggestion) {
      setSearchQuery(suggestion.name)
    }
    setShowSuggestions(false)
  }

  const handleCategoryChange = (value: string) => {
    setCategory(value as Category)
    setSelectedEntityId(null)
    setSearchQuery('')
    setShowSuggestions(false)
  }

  return (
    <Card>
      <Box p="4">
        {/* Filters - on same line */}
        <Flex align="center" gap="3" mb="4" wrap="wrap">
          {/* Category Dropdown */}
          <Flex align="center" gap="2">
            <Text weight="bold" size="2">
              Category:
            </Text>
            <Select.Root value={category} onValueChange={handleCategoryChange}>
              <Select.Trigger style={{ minWidth: 150 }} />
              <Select.Content>
                <Select.Item value="all">All</Select.Item>
                <Select.Item value="jobDuration">Jobs</Select.Item>
                <Select.Item value="equipment">Equipment</Select.Item>
                <Select.Item value="transport">Transport</Select.Item>
                <Select.Item value="crew">Crew</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          {/* Search with Autocomplete */}
          {category !== 'all' && (
            <Flex
              align="center"
              gap="2"
              style={{ flex: '1 1 300px', position: 'relative' }}
            >
              <Text weight="bold" size="2">
                Search:
              </Text>
              <div ref={searchRef} style={{ position: 'relative', flex: 1 }}>
                <TextField.Root
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSuggestions(true)
                    if (!e.target.value) {
                      setSelectedEntityId(null)
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={
                    category === 'transport'
                      ? 'Search vehicles...'
                      : category === 'equipment'
                        ? 'Search items...'
                        : category === 'crew'
                          ? 'Search crew...'
                          : 'Search jobs...'
                  }
                  style={{ width: '100%' }}
                >
                  <TextField.Slot side="left">
                    <Search />
                  </TextField.Slot>
                </TextField.Root>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <Box
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      marginTop: 4,
                      maxHeight: 300,
                      overflowY: 'auto',
                      border: '1px solid var(--gray-a6)',
                      borderRadius: 8,
                      backgroundColor: 'var(--color-panel-solid)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    {suggestions.map((suggestion) => (
                      <Box
                        key={suggestion.id}
                        onClick={() => handleSelectSuggestion(suggestion.id)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--gray-a6)',
                          backgroundColor:
                            selectedEntityId === suggestion.id
                              ? 'var(--accent-a3)'
                              : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedEntityId !== suggestion.id) {
                            e.currentTarget.style.backgroundColor =
                              'var(--gray-a2)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedEntityId !== suggestion.id) {
                            e.currentTarget.style.backgroundColor =
                              'transparent'
                          }
                        }}
                      >
                        <Text size="2" weight="medium">
                          {suggestion.name}
                        </Text>
                        {suggestion.subtitle && (
                          <Text
                            size="1"
                            color="gray"
                            style={{ display: 'block', marginTop: 4 }}
                          >
                            {suggestion.subtitle}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </div>
            </Flex>
          )}

          {/* Subscribe to calendar */}
          <Button
            type="button"
            variant="soft"
            size="2"
            onClick={() => setSubscribeDialogOpen(true)}
            title="Subscribe to calendar"
          >
            <ShareAndroid /> Subscribe to calendar
          </Button>

          {/* View Toggle */}
          <Flex align="center" gap="2" style={{ marginLeft: 'auto' }}>
            <IconButton
              type="button"
              variant={listMode ? 'soft' : 'solid'}
              onClick={() => setListMode(false)}
              title="Calendar view"
            >
              <Calendar />
            </IconButton>
            <IconButton
              type="button"
              variant={listMode ? 'solid' : 'soft'}
              onClick={() => setListMode(true)}
              title="List view"
            >
              <List />
            </IconButton>
          </Flex>
        </Flex>

        <SubscribeToCalendarDialog
          open={subscribeDialogOpen}
          onOpenChange={setSubscribeDialogOpen}
        />

        {/* Calendar */}
        <CompanyCalendarPro
          events={events}
          onCreate={() => {}}
          onUpdate={() => {}}
          onDelete={() => {}}
          defaultKinds={
            category === 'all'
              ? ['job', 'item', 'vehicle', 'crew']
              : category === 'jobDuration'
                ? ['job']
                : category === 'equipment'
                  ? ['item']
                  : category === 'transport'
                    ? ['vehicle']
                    : ['crew']
          }
          hideCreateButton
          initialListMode={listMode}
          onListModeChange={setListMode}
        />
      </Box>
    </Card>
  )
}
