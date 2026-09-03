// src/pages/CalendarPage.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@tanstack/react-pacer'
import {
  Button,
  Card,
  DropdownMenu,
  Flex,
  IconButton,
  Select,
} from '@radix-ui/themes'
import { Calendar, List, MoreHoriz, Plus, ShareAndroid } from 'iconoir-react'
import { SearchableSelect } from '@shared/ui/components/SearchableSelect'
import { useCompany } from '@shared/companies/CompanyProvider'
import CalendarPageSkeleton from '@shared/ui/components/CalendarPageSkeleton'
import { useAuthz } from '@shared/auth/useAuthz'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { MobileBottomActionBar } from '@app/layout/mobile'
import CompanyCalendarPro from '@features/calendar/components/CompanyCalendarPro'
import SubscribeToCalendarDialog from '@features/calendar/components/SubscribeToCalendarDialog'
import PersonalCalendarEventDialog from '@features/calendar/components/dialogs/PersonalCalendarEventDialog'
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
import type { PersonalEventDraft } from '@features/calendar/components/dialogs/PersonalCalendarEventDialog'
import type { CalendarKind } from '@features/calendar/components/domain'

type Category = 'jobDuration' | 'equipment' | 'crew' | 'transport' | 'all'

export default function CalendarPage() {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const isFreelancer = companyRole === 'freelancer'
  const [category, setCategory] = React.useState<Category>('jobDuration')
  const [searchInput, setSearchInput] = React.useState('')
  const [debouncedSearchInput] = useDebouncedValue(searchInput, { wait: 300 })
  const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(
    null,
  )
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false)
  const [listMode, setListMode] = React.useState(false)
  const [subscribeDialogOpen, setSubscribeDialogOpen] = React.useState(false)
  const [personalDialogOpen, setPersonalDialogOpen] = React.useState(false)
  const [personalEvent, setPersonalEvent] =
    React.useState<PersonalEventDraft | null>(null)

  const calendarWindow = React.useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const to = new Date()
    to.setDate(to.getDate() + 90)
    return { fromDate: from.toISOString(), toDate: to.toISOString() }
  }, [])

  // Set default category based on role
  React.useEffect(() => {
    if (isFreelancer) {
      setCategory('crew')
    }
  }, [isFreelancer])

  // Freelancers only see their own crew shifts — no crew directory search needed
  React.useEffect(() => {
    if (isFreelancer) {
      setSelectedEntityId(null)
    }
  }, [isFreelancer])

  // Fetch all calendar events for the company (all categories)
  const { data: calendarRecords = [], isLoading: calendarLoading } = useQuery({
    ...companyCalendarQuery({
      companyId: companyId ?? '',
      categories: undefined, // Fetch all categories
      userId,
      companyRole,
      ...calendarWindow,
    }),
    enabled: !!companyId,
  })

  // Fetch suggestions based on category
  // Important: these index queries can be very expensive if they fire on every keystroke.
  // Only fetch when the suggestion dropdown is actually open.
  const shouldFetchSuggestions =
    !isFreelancer && category !== 'all' && !!companyId && suggestionsOpen

  // Vehicles for transport
  const { data: vehicles = [] } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '',
      includeExternal: true,
      search: debouncedSearchInput,
    }),
    enabled: shouldFetchSuggestions && category === 'transport',
  })

  // Items for equipment
  const { data: itemsData } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '',
      page: 1,
      pageSize: 100,
      search: debouncedSearchInput,
      showActive: true,
      showInactive: false,
      showStock: true,
      showSubrental: true,
      showGroupOnlyItems: false,
      showGroups: false,
      showItems: true,
      category: null,
      sortBy: 'name',
      sortDir: 'asc',
    }),
    enabled: shouldFetchSuggestions && category === 'equipment',
  })
  const items = React.useMemo(() => itemsData?.rows || [], [itemsData?.rows])

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
      search: debouncedSearchInput,
      userId,
      companyRole,
      maxRows: 100,
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

    // Apply fuzzy search filtering if search input exists
    if (searchInput.trim()) {
      return fuzzySearch(
        allSuggestions,
        searchInput,
        [(s) => s.name, (s) => s.subtitle ?? ''],
        0.3,
      )
    }

    return allSuggestions
  }, [category, vehicles, items, crew, jobs, searchInput])

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
    const categoryToKind: Record<Category, Array<CalendarKind> | null> = {
      all: null, // Show all (already filtered above)
      jobDuration: ['job'],
      equipment: ['item'],
      transport: ['vehicle'],
      crew: ['crew', 'personal'],
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

  const defaultKinds = React.useMemo((): Array<CalendarKind> => {
    if (category === 'all')
      return ['job', 'item', 'vehicle', 'crew', 'personal']
    if (category === 'jobDuration') return ['job']
    if (category === 'equipment') return ['item']
    if (category === 'transport') return ['vehicle']
    return ['crew', 'personal']
  }, [category])

  const handleCategoryChange = (value: string) => {
    setCategory(value as Category)
    setSelectedEntityId(null)
    setSearchInput('')
    setSuggestionsOpen(false)
  }

  const entitySearchPlaceholder =
    category === 'transport'
      ? 'Search vehicles...'
      : category === 'equipment'
        ? 'Search items...'
        : category === 'crew'
          ? 'Search crew...'
          : 'Search jobs...'

  const entityOptions = React.useMemo(
    () =>
      suggestions.map((s) => ({
        value: s.id,
        label: s.name,
        description: s.subtitle,
      })),
    [suggestions],
  )

  if (!companyId || calendarLoading) {
    return <CalendarPageSkeleton />
  }

  const page = (
    <Flex className="calendar-page" direction="column" gap="2">
      <Flex align="center" gap="3" wrap="wrap" style={{ flexShrink: 0 }}>
        <Flex
          align="center"
          gap="2"
          wrap="nowrap"
          style={{ flex: 1, minWidth: 0 }}
        >
          <Select.Root value={category} onValueChange={handleCategoryChange}>
            <Select.Trigger
              aria-label="Category"
              style={{
                flexShrink: 0,
                minWidth: isMobile ? 0 : 150,
                width: isMobile ? 'auto' : undefined,
              }}
            />
            <Select.Content>
              {!isFreelancer && <Select.Item value="all">All</Select.Item>}
              <Select.Item value="jobDuration">Jobs</Select.Item>
              {!isFreelancer && (
                <>
                  <Select.Item value="equipment">Equipment</Select.Item>
                  <Select.Item value="transport">Transport</Select.Item>
                </>
              )}
              <Select.Item value="crew">Crew</Select.Item>
            </Select.Content>
          </Select.Root>

          {!isFreelancer && category !== 'all' && (
            <SearchableSelect
              options={entityOptions}
              value={selectedEntityId ?? ''}
              onValueChange={(v) => setSelectedEntityId(v || null)}
              onInputChange={(v) => {
                setSearchInput(v)
                if (!v) setSelectedEntityId(null)
              }}
              onOpenChange={setSuggestionsOpen}
              filterLocally={false}
              placeholder={entitySearchPlaceholder}
              dropdownMaxHeight={300}
              style={{ flex: 1, minWidth: 0, maxWidth: 'none' }}
            />
          )}
        </Flex>

        {!isMobile && (
          <Button
            type="button"
            variant="soft"
            size="2"
            onClick={() => {
              setPersonalEvent(null)
              setPersonalDialogOpen(true)
            }}
            title="Add personal event"
          >
            Add personal event
          </Button>
        )}

        {!isMobile && (
          <Button
            type="button"
            variant="soft"
            size="2"
            onClick={() => setSubscribeDialogOpen(true)}
            title="Subscribe to calendar"
          >
            <ShareAndroid /> Subscribe to calendar
          </Button>
        )}

        {!isMobile && (
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
        )}
      </Flex>

      <SubscribeToCalendarDialog
        open={subscribeDialogOpen}
        onOpenChange={setSubscribeDialogOpen}
      />

      {userId && (
        <PersonalCalendarEventDialog
          open={personalDialogOpen}
          onOpenChange={(open) => {
            setPersonalDialogOpen(open)
            if (!open) setPersonalEvent(null)
          }}
          userId={
            personalEvent && personalEvent.userId !== userId
              ? personalEvent.userId
              : userId
          }
          event={personalEvent}
          readOnly={Boolean(personalEvent && personalEvent.userId !== userId)}
        />
      )}

      <CompanyCalendarPro
        events={events}
        onCreate={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
        defaultKinds={defaultKinds}
        hideCreateButton
        initialListMode={listMode}
        onListModeChange={setListMode}
        onPersonalEventClick={(payload) => {
          setPersonalEvent(payload)
          setPersonalDialogOpen(true)
        }}
      />

      <MobileBottomActionBar extendRight>
        <Button
          variant="ghost"
          size="3"
          aria-label="Add personal event"
          onClick={() => {
            setPersonalEvent(null)
            setPersonalDialogOpen(true)
          }}
        >
          <Plus width={18} height={18} />
          Event
        </Button>
        <div className="app-mobile-bottom-action-trailing">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton
                variant="ghost"
                size="3"
                aria-label="More calendar actions"
              >
                <MoreHoriz width={18} height={18} />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onSelect={() => setSubscribeDialogOpen(true)}>
                Subscribe to calendar
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </MobileBottomActionBar>
    </Flex>
  )

  if (isMobile) return page

  return (
    <Card
      size="3"
      className="calendar-page-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {page}
    </Card>
  )
}
