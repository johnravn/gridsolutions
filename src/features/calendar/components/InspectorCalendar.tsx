// src/features/calendar/InspectorCalendar.tsx
import * as React from 'react'
import { Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { ArrowRight, Calendar, List } from 'iconoir-react'
import FullCalendar from '@shared/calendar/FullCalendarSafe'
import nbLocale from '@fullcalendar/core/locales/nb'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { CALENDAR_TIME_ZONE, getCalendarExtendedProps } from './domain'
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core'

type Props = {
  events: Array<EventInput>
  onCreate?: (e: {
    title: string
    start: string
    end?: string
    allDay: boolean
  }) => void
  onUpdate?: (id: string, patch: Partial<EventInput>) => void
  onDelete?: (id: string) => void
  // Pagination props for list view
  hasMore?: boolean // whether there are more events to load
  onLoadNext?: () => void // callback to load next page
  showPagination?: boolean // whether to show pagination controls
}

export default function InspectorCalendar({
  events,
  onCreate,
  onUpdate,
  onDelete,
  hasMore = false,
  onLoadNext,
  showPagination = false,
}: Props) {
  const [listMode, setListMode] = React.useState(true)
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date())
  const calendarRef = React.useRef<any>(null)

  const canMutate = Boolean(onCreate || onUpdate || onDelete)

  function handleSelect(sel: DateSelectArg) {
    if (!onCreate) return
    const title = window.prompt('New booking title?')
    if (!title) return
    onCreate({
      title,
      start: sel.startStr,
      end: sel.endStr,
      allDay: sel.allDay,
    })
  }

  function handleEventClick(arg: EventClickArg) {
    if (!onUpdate && !onDelete) return
    const { id, title } = arg.event
    const action = window.prompt('Edit title, or type "delete"', title || '')
    if (!action) return
    if (action.toLowerCase() === 'delete') onDelete?.(id)
    else onUpdate?.(id, { title: action })
  }

  // Render event in list mode to show job name instead of time period name
  function renderListEvent(arg: EventContentArg) {
    const jobTitle = getCalendarExtendedProps(arg.event).jobTitle
    // Use job title if available, otherwise fall back to event title
    const displayTitle = jobTitle || arg.event.title || 'Event'
    return <span>{displayTitle}</span>
  }

  return (
    <Box
      className="companyCalendar"
      p="2"
      style={{ background: 'transparent' }}
    >
      <Flex align="center" justify="between" mb="2">
        <Text weight="bold">
          {listMode
            ? currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })
            : 'Schedule'}
        </Text>
        <Flex gap="2" align="center">
          <IconButton
            type="button"
            size="1"
            variant={listMode ? 'soft' : 'solid'}
            onClick={() => setListMode(false)}
            title="3-day view"
          >
            <Calendar />
          </IconButton>
          <IconButton
            type="button"
            size="1"
            variant={listMode ? 'solid' : 'soft'}
            onClick={() => setListMode(true)}
            title="List view"
          >
            <List />
          </IconButton>
        </Flex>
      </Flex>

      {!listMode ? (
        <FullCalendar
          key="timegrid"
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridThreeDay"
          headerToolbar={false}
          views={{
            timeGridThreeDay: {
              type: 'timeGrid',
              duration: { days: 3 },
              buttonText: '3 days',
            },
          }}
          height="420px"
          timeZone={CALENDAR_TIME_ZONE}
          locale={nbLocale}
          selectable={canMutate}
          selectMirror={canMutate}
          select={canMutate ? handleSelect : undefined}
          eventClick={canMutate ? handleEventClick : undefined}
          events={events}
          nowIndicator
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          eventDisplay="block"
        />
      ) : (
        <>
          <FullCalendar
            ref={calendarRef}
            key="list-month"
            plugins={[listPlugin]}
            initialView="listMonth"
            headerToolbar={{
              start: 'prev',
              center: 'title',
              end: 'next',
            }}
            datesSet={(dateInfo) => {
              if (dateInfo.view.type === 'listMonth' && dateInfo.start) {
                setCurrentDate(dateInfo.start)
              }
            }}
            timeZone={CALENDAR_TIME_ZONE}
            locale={nbLocale}
            events={events}
            height="auto"
            stickyHeaderDates={false}
            eventContent={renderListEvent}
            // Removed validRange to allow viewing past reservations
            listDayFormat={{ weekday: 'short', day: '2-digit', month: 'short' }}
            listDaySideFormat={false}
            noEventsContent="No bookings"
          />
          {/* Pagination footer for list mode */}
          {showPagination && hasMore && onLoadNext && (
            <Flex justify="center" mt="2">
              <Button size="2" variant="soft" onClick={onLoadNext}>
                <Text>Next 5</Text>
                <ArrowRight />
              </Button>
            </Flex>
          )}
        </>
      )}
    </Box>
  )
}
