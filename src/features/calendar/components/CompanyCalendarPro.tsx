// src/features/calendar/CompanyCalendarPro.tsx
import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Flex,
  HoverCard,
  IconButton,
  Select,
  Separator,
  Switch,
  Text,
  TextField,
} from '@radix-ui/themes'
import FullCalendar from '@shared/calendar/FullCalendarSafe'
import '@shared/calendar/fullcalendar.radix.css'
import enLocale from '@fullcalendar/core/locales/en-gb'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, List } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { MobileBottomDrawer } from '@app/layout/mobile'
import { useAuthz } from '@shared/auth/useAuthz'
import { getInitials } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { applyCalendarFilter } from './domain'
import type { CalendarFilter, CalendarKind } from './domain'
import type {
  EventApi,
  EventClickArg,
  EventContentArg,
  EventInput,
  MoreLinkArg,
} from '@fullcalendar/core'

const CALENDAR_PLUGINS = [
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
]
const LIST_PLUGINS = [listPlugin]
const CALENDAR_HEADER = {
  start: 'prev,next today',
  center: 'title',
  end: 'dayGridMonth,timeGridWeek,timeGridDay',
}
const MONTH_ONLY_HEADER = {
  start: 'prev,next today',
  center: 'title',
  end: '',
}
const LIST_HEADER = {
  start: 'prev,next today',
  center: 'title',
  end: 'listMonth,listWeek,listDay',
}

function getRadixColorsForPeriod(
  title: string | null,
  category?: 'program' | 'equipment' | 'crew' | 'transport' | null,
): {
  bg: string
  border: string
  text: string
} {
  const t = (title || '').toLowerCase()

  if (t.includes('job duration'))
    return {
      bg: 'var(--blue-a6)',
      border: 'var(--blue-a8)',
      text: 'var(--blue-12)',
    }
  if (category === 'equipment' || t.includes('equipment'))
    return {
      bg: 'var(--violet-a6)',
      border: 'var(--violet-a8)',
      text: 'var(--violet-12)',
    }
  if (category === 'crew' || t.includes('crew'))
    return {
      bg: 'var(--green-a6)',
      border: 'var(--green-a8)',
      text: 'var(--green-12)',
    }
  if (
    category === 'transport' ||
    t.includes('vehicle') ||
    t.includes('transport')
  )
    return {
      bg: 'var(--amber-a6)',
      border: 'var(--amber-a8)',
      text: 'var(--amber-12)',
    }
  if (category === 'program' || t.includes('show') || t.includes('event'))
    return {
      bg: 'var(--pink-a6)',
      border: 'var(--pink-a8)',
      text: 'var(--pink-12)',
    }
  if (t.includes('setup') || t.includes('load in'))
    return {
      bg: 'var(--cyan-a6)',
      border: 'var(--cyan-a8)',
      text: 'var(--cyan-12)',
    }
  if (t.includes('teardown') || t.includes('load out'))
    return {
      bg: 'var(--red-a6)',
      border: 'var(--red-a8)',
      text: 'var(--red-12)',
    }

  return {
    bg: 'var(--indigo-a6)',
    border: 'var(--indigo-a8)',
    text: 'var(--indigo-12)',
  }
}

type Props = {
  events: Array<EventInput>
  onCreate?: (e: {
    title: string
    start: string
    end?: string
    allDay: boolean
    context?: any
  }) => void
  onUpdate?: (id: string, patch: Partial<EventInput>) => void
  onDelete?: (id: string) => void
  defaultKinds?: Array<CalendarKind>
  // Optional: controlled filter from outside
  initialScope?: CalendarFilter['scope']
  // Hide the create booking button
  hideCreateButton?: boolean
  // Control list mode externally
  initialListMode?: boolean
  onListModeChange?: (listMode: boolean) => void
}

export default function CompanyCalendarPro({
  events,
  onCreate: _onCreate,
  onUpdate: _onUpdate,
  onDelete: _onDelete,
  defaultKinds = ['job'],
  initialScope,
  hideCreateButton = false,
  initialListMode = false,
  onListModeChange,
}: Props) {
  const navigate = useNavigate()
  const { userId } = useAuthz()
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const isSmallScreen = useMediaQuery('(max-width: 1023px)')
  const calendarRef = React.useRef<FullCalendar>(null)
  const [overflowDay, setOverflowDay] = React.useState<{
    date: Date
    events: Array<EventApi>
  } | null>(null)

  const closeOverflow = React.useCallback(() => {
    setOverflowDay(null)
  }, [])

  useMobileDetailBack(isSmallScreen, overflowDay !== null, closeOverflow)

  React.useEffect(() => {
    if (!isSmallScreen) setOverflowDay(null)
  }, [isSmallScreen])

  React.useEffect(() => {
    if (!isSmallScreen) return
    const api = calendarRef.current?.getApi()
    if (api && api.view.type !== 'dayGridMonth') {
      api.changeView('dayGridMonth')
    }
  }, [isSmallScreen])
  // UI state
  const [kinds, setKinds] = React.useState<Array<CalendarKind>>(defaultKinds)
  const [scopeKind, setScopeKind] = React.useState<'none' | CalendarKind>(
    'none',
  )
  const [scopeId, setScopeId] = React.useState<string>('')
  const [query, setQuery] = React.useState('')
  const [internalListMode, setInternalListMode] =
    React.useState(initialListMode)

  // Use external control if provided, otherwise use internal state.
  // Phones stay on the month grid — list mode and week/day views are desktop-only.
  const listMode = isSmallScreen
    ? false
    : onListModeChange !== undefined
      ? initialListMode
      : internalListMode
  const setListMode = React.useCallback(
    (value: boolean) => {
      if (onListModeChange) {
        onListModeChange(value)
      } else {
        setInternalListMode(value)
      }
    },
    [onListModeChange],
  )

  // Sync internal state with external prop changes
  React.useEffect(() => {
    if (onListModeChange === undefined) {
      setInternalListMode(initialListMode)
    }
  }, [initialListMode, onListModeChange])

  // When hideCreateButton is true, sync kinds with defaultKinds since user can't control it
  React.useEffect(() => {
    if (hideCreateButton) {
      setKinds(defaultKinds)
    }
  }, [hideCreateButton, defaultKinds])

  // turn scopeKind + scopeId into a scope object
  const scope = React.useMemo(() => {
    if (initialScope) return initialScope
    if (scopeKind === 'none' || !scopeId) return undefined
    return {
      jobId: scopeKind === 'job' ? scopeId : undefined,
      itemId: scopeKind === 'item' ? scopeId : undefined,
      vehicleId: scopeKind === 'vehicle' ? scopeId : undefined,
      userId: scopeKind === 'crew' ? scopeId : undefined,
    }
  }, [initialScope, scopeKind, scopeId])

  const filtered = React.useMemo(() => {
    // When hideCreateButton is true, events are already filtered by parent
    // Only apply additional filters if controls are visible
    if (hideCreateButton) {
      return events
    }
    return applyCalendarFilter(events, { kinds, scope, text: query })
  }, [events, kinds, scope, query, hideCreateButton])

  const coloredEvents = React.useMemo(
    () =>
      filtered.map((event) => {
        const props = event.extendedProps as any
        const category = props?.category
        const status = props?.status
        const title = event.title || ''
        const isCanceled = status === 'canceled'
        const colors = isCanceled
          ? {
              bg: 'var(--gray-a3)',
              border: 'var(--gray-a5)',
              text: 'var(--gray-9)',
            }
          : getRadixColorsForPeriod(title, category)
        return {
          ...event,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          classNames: isCanceled
            ? [
                ...((event.classNames as Array<string>) || []),
                'fc-event-canceled',
              ]
            : event.classNames,
        }
      }),
    [filtered],
  )

  // Removed handleSelect and handleEventClick - no prompts needed

  // Map event category to job tab
  function getTabForCategory(
    category?: 'program' | 'equipment' | 'crew' | 'transport' | null,
  ): string {
    switch (category) {
      case 'equipment':
        return 'equipment'
      case 'crew':
        return 'crew'
      case 'transport':
        return 'transport'
      case 'program':
      default:
        return 'calendar'
    }
  }

  function openJobFromEvent(event: EventApi) {
    const extendedProps = event.extendedProps as any
    const jobId = extendedProps?.ref?.jobId as string | undefined
    const category = extendedProps?.category as
      | 'program'
      | 'equipment'
      | 'crew'
      | 'transport'
      | null
      | undefined

    if (jobId) {
      const tab = getTabForCategory(category)
      navigate({
        to: '/jobs',
        search: { jobId, recurringJobId: undefined, tab },
      })
    }
  }

  function handleEventClick(arg: EventClickArg) {
    openJobFromEvent(arg.event)
  }

  const handleMoreLinkClick = React.useCallback(
    (arg: MoreLinkArg) => {
      if (!isSmallScreen) return 'popover'

      const seen = new Set<string>()
      const dayEvents = arg.allSegs
        .map((seg) => seg.event)
        .filter((event) => {
          if (seen.has(event.id)) return false
          seen.add(event.id)
          return true
        })
        .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0))

      // FullCalendar still opens its popover when the handler returns void.
      // A truthy non-string skips both the popover and view-zoom. Defer our
      // state update so it does not land inside FullCalendar's flushSync.
      queueMicrotask(() => {
        setOverflowDay({ date: arg.date, events: dayEvents })
      })
      return true as unknown as 'popover'
    },
    [isSmallScreen],
  )

  // Using shared getInitials from generalFunctions

  function formatTimeRange(start: Date | null, end: Date | null): string {
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (!start) return ''
    if (!end || start.getTime() === end.getTime()) return fmt(start)
    return `${fmt(start)}–${fmt(end)}`
  }

  function overflowEventRow(event: EventApi) {
    const props = event.extendedProps as any
    const projectLead = props?.projectLead as
      | {
          display_name: string | null
          email: string
          avatar_url: string | null
        }
      | null
      | undefined
    const displayTitle = (props?.jobTitle as string | undefined) || event.title
    const timeStr = formatTimeRange(event.start, event.end)
    const isCanceled = (props?.status as string | undefined) === 'canceled'
    const avatarUrl = projectLead?.avatar_url
      ? supabase.storage.from('avatars').getPublicUrl(projectLead.avatar_url)
          .data.publicUrl
      : null
    const leadName = projectLead
      ? projectLead.display_name || projectLead.email
      : null
    const colors = isCanceled
      ? {
          bg: 'var(--gray-a3)',
          text: 'var(--gray-9)',
        }
      : {
          bg: event.backgroundColor || 'var(--indigo-a6)',
          text: event.textColor || 'var(--indigo-12)',
        }

    return (
      <button
        key={event.id}
        type="button"
        className={
          isCanceled
            ? 'calendar-overflow-event calendar-overflow-event--canceled'
            : 'calendar-overflow-event'
        }
        style={{ background: colors.bg, color: colors.text }}
        onClick={() => {
          closeOverflow()
          openJobFromEvent(event)
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            width: '100%',
            minWidth: 0,
          }}
        >
          {timeStr && (
            <span
              style={{
                fontWeight: 600,
                fontSize: 'var(--font-size-2)',
                flexShrink: 0,
              }}
            >
              {timeStr}
            </span>
          )}
          <span
            style={{
              fontSize: 'var(--font-size-2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {displayTitle}
          </span>
          {projectLead && (
            <Avatar
              className="fc-event-lead-avatar"
              size="2"
              radius="full"
              src={avatarUrl ?? undefined}
              fallback={getInitials(leadName)}
              title={leadName ?? undefined}
              style={{
                flexShrink: 0,
                border: '1px solid var(--gray-a6)',
              }}
            />
          )}
        </div>
      </button>
    )
  }

  // Compact event UI (time xx:xx, job title). Hover shows HoverCard with details.
  function renderEvent(arg: EventContentArg) {
    const props = arg.event.extendedProps as any
    const projectLead = props?.projectLead as
      | {
          user_id: string
          display_name: string | null
          email: string
          avatar_url: string | null
        }
      | null
      | undefined
    const jobTitle = props?.jobTitle as string | undefined
    const status = props?.status as string | undefined
    const category = props?.category as string | undefined
    const crewUserIds = (props?.crewUserIds as Array<string> | undefined) || []
    const crewStatusByUserId =
      (props?.crewStatusByUserId as Record<string, string> | undefined) || {}
    const jobCrewUserIds =
      (props?.jobCrewUserIds as Array<string> | undefined) || []
    const jobCrewStatusByUserId =
      (props?.jobCrewStatusByUserId as Record<string, string> | undefined) || {}
    const ref = props?.ref as { userId?: string } | undefined

    const displayTitle = jobTitle || arg.event.title
    const timeStr = formatTimeRange(
      arg.event.start ? new Date(arg.event.start) : null,
      arg.event.end ? new Date(arg.event.end) : null,
    )

    const isProjectLead = !!userId && projectLead?.user_id === userId
    const isCrewOnPeriod =
      !!userId && (crewUserIds.includes(userId) || ref?.userId === userId)
    const isCrewOnJob =
      !!userId && jobCrewUserIds.length > 0 && jobCrewUserIds.includes(userId)
    const isCrew = isCrewOnPeriod || isCrewOnJob
    const crewStatus =
      isCrew && userId
        ? (crewStatusByUserId[userId] ?? jobCrewStatusByUserId[userId])
        : undefined
    const isConfirmedCrew = isCrew && crewStatus === 'confirmed'

    const avatarUrl = projectLead?.avatar_url
      ? supabase.storage.from('avatars').getPublicUrl(projectLead.avatar_url)
          .data.publicUrl
      : null
    const leadName = projectLead
      ? projectLead.display_name || projectLead.email
      : null

    const eventInner = (
      <div
        style={{
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          lineHeight: 1.25,
        }}
      >
        {timeStr && (
          <span
            style={{
              fontWeight: 600,
              fontSize: 'var(--font-size-1)',
              flexShrink: 0,
            }}
          >
            {timeStr}
          </span>
        )}
        <span
          style={{
            fontSize: 'var(--font-size-1)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          {displayTitle}
        </span>
        {projectLead && (
          <Avatar
            className="fc-event-lead-avatar"
            size="2"
            radius="full"
            src={avatarUrl ?? undefined}
            fallback={getInitials(leadName)}
            title={leadName ?? undefined}
            style={{
              flexShrink: 0,
              border: '1px solid var(--gray-a6)',
            }}
          />
        )}
      </div>
    )

    if (!canHover) return eventInner

    const hoverContent = (
      <HoverCard.Content
        size="1"
        side="top"
        minWidth="280px"
        maxWidth="min(360px, calc(100vw - 24px))"
        collisionPadding={12}
      >
        <Box p="2">
          <Text as="div" size="2" weight="bold" mb="2">
            {displayTitle}
          </Text>
          <Flex direction="column" gap="2">
            {arg.event.title && arg.event.title !== displayTitle && (
              <Text size="1" color="gray">
                {arg.event.title}
              </Text>
            )}
            {timeStr && <Text size="1">Time: {timeStr}</Text>}
            {projectLead && (
              <Flex align="center" gap="2">
                <Avatar
                  size="1"
                  radius="full"
                  src={avatarUrl ?? undefined}
                  fallback={getInitials(leadName)}
                  style={{ border: '1px solid var(--gray-a6)' }}
                />
                <Flex direction="column" gap="0">
                  <Text size="1">Project lead</Text>
                  <Text size="1" weight="medium">
                    {leadName}
                  </Text>
                </Flex>
              </Flex>
            )}
            {(isProjectLead || isCrew) && (
              <Badge
                size="1"
                color={
                  isProjectLead ? 'blue' : isConfirmedCrew ? 'green' : 'amber'
                }
                variant="outline"
              >
                You are{' '}
                {isProjectLead
                  ? 'project lead'
                  : isConfirmedCrew
                    ? 'crew (confirmed)'
                    : 'crew'}
              </Badge>
            )}
            {status && (
              <Text size="1" style={{ textTransform: 'capitalize' }}>
                Status: {status.replace(/_/g, ' ')}
              </Text>
            )}
            {category && (
              <Text size="1" style={{ textTransform: 'capitalize' }}>
                Type: {category}
              </Text>
            )}
            <Text size="1" color="gray" mt="1">
              Click to open job
            </Text>
          </Flex>
        </Box>
      </HoverCard.Content>
    )

    return (
      <HoverCard.Root openDelay={0} closeDelay={100}>
        <HoverCard.Trigger>{eventInner}</HoverCard.Trigger>
        {hoverContent}
      </HoverCard.Root>
    )
  }

  return (
    <Box
      className="companyCalendar"
      style={{
        background: 'transparent',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Controls - only show if hideCreateButton is false (for backward compatibility) */}
      {!hideCreateButton && (
        <Flex
          align="center"
          wrap="wrap"
          gap="3"
          mb="2"
          style={{ flexShrink: 0 }}
        >
          {/* Kind filter */}
          <Flex align="center" gap="2">
            <Text weight="bold" size="2">
              Show:
            </Text>
            <ToggleKind
              label="Jobs"
              value="job"
              kinds={kinds}
              setKinds={setKinds}
            />
            <ToggleKind
              label="Items"
              value="item"
              kinds={kinds}
              setKinds={setKinds}
            />
            <ToggleKind
              label="Vehicles"
              value="vehicle"
              kinds={kinds}
              setKinds={setKinds}
            />
            <ToggleKind
              label="Crew"
              value="crew"
              kinds={kinds}
              setKinds={setKinds}
            />
          </Flex>

          <Separator orientation="vertical" />

          {/* Scope */}
          <Flex align="center" gap="2">
            <Text weight="bold" size="2">
              Scope:
            </Text>
            <Select.Root
              value={scopeKind}
              onValueChange={(v) => setScopeKind(v as any)}
            >
              <Select.Trigger placeholder="Scope kind" />
              <Select.Content>
                <Select.Item value="none">None</Select.Item>
                <Select.Item value="job">Job</Select.Item>
                <Select.Item value="item">Item</Select.Item>
                <Select.Item value="vehicle">Vehicle</Select.Item>
                <Select.Item value="crew">Crew</Select.Item>
              </Select.Content>
            </Select.Root>
            <TextField.Root
              placeholder="ID…"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            />
          </Flex>

          <Separator orientation="vertical" />

          {/* Search */}
          <TextField.Root
            placeholder="Search title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {!isSmallScreen && (
            <>
              <Separator orientation="vertical" />

              {/* View toggle — desktop only; phones stay on month grid */}
              <Flex align="center" gap="2">
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
                <Text size="1" color="gray">
                  Default shows Jobs this month
                </Text>
              </Flex>
            </>
          )}
        </Flex>
      )}

      {/* Calendar or List */}
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!listMode ? (
          <FullCalendar
            ref={calendarRef}
            key="calendar"
            plugins={CALENDAR_PLUGINS}
            initialView="dayGridMonth"
            headerToolbar={isSmallScreen ? MONTH_ONLY_HEADER : CALENDAR_HEADER}
            timeZone="Europe/Oslo"
            locale={enLocale}
            selectable={false}
            editable={false}
            select={undefined}
            eventClick={handleEventClick}
            eventContent={renderEvent}
            moreLinkClick={handleMoreLinkClick}
            events={coloredEvents}
            height="100%"
            expandRows
            dayMaxEventRows
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            eventDisplay="block"
          />
        ) : (
          <FullCalendar
            key="list"
            plugins={LIST_PLUGINS}
            initialView="listMonth"
            headerToolbar={LIST_HEADER}
            buttonText={{
              listMonth: 'month',
              listWeek: 'week',
              listDay: 'day',
            }}
            timeZone="Europe/Oslo"
            locale={enLocale}
            eventClick={handleEventClick}
            eventContent={renderEvent}
            events={coloredEvents}
            height="100%"
            noEventsContent="No bookings found"
          />
        )}
      </Box>

      <MobileBottomDrawer
        open={overflowDay !== null}
        onOpenChange={(open) => {
          if (!open) closeOverflow()
        }}
        title={
          overflowDay
            ? overflowDay.date.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : 'Events'
        }
      >
        <div className="calendar-overflow-list">
          {overflowDay?.events.map((event) => overflowEventRow(event))}
        </div>
      </MobileBottomDrawer>
    </Box>
  )
}

function ToggleKind({
  label,
  value,
  kinds,
  setKinds,
}: {
  label: string
  value: CalendarKind
  kinds: Array<CalendarKind>
  setKinds: React.Dispatch<React.SetStateAction<Array<CalendarKind>>>
}) {
  const checked = kinds.includes(value)
  return (
    <Flex align="center" gap="1">
      <Switch
        checked={checked}
        onCheckedChange={(c) =>
          setKinds((prev) =>
            c
              ? Array.from(new Set([...prev, value]))
              : prev.filter((k) => k !== value),
          )
        }
      />
      <Text size="2">{label}</Text>
    </Flex>
  )
}
