import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Checkbox, Flex, Text } from '@radix-ui/themes'
import FullCalendar from '@fullcalendar/react'
import '@shared/calendar/fullcalendar.radix.css'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { jobTimePeriodsQuery } from '@features/jobs/api/queries'
import { supabase } from '@shared/api/supabase'
import type { EventInput } from '@fullcalendar/core'
import type { TimePeriodLite } from '../../types'

type CategoryFilter =
  | 'jobDuration'
  | 'program'
  | 'equipment'
  | 'crew'
  | 'transport'

export default function CalendarTab({ jobId }: { jobId: string }) {
  // Fetch job to get duration
  const { data: job } = useQuery({
    queryKey: ['jobs-detail', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_at, end_at')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data
    },
  })

  // Fetch time periods
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))

  // Filter state
  const [selectedFilters, setSelectedFilters] = React.useState<
    Set<CategoryFilter>
  >(new Set(['jobDuration', 'program', 'equipment', 'crew', 'transport']))

  // Helper to check if time period is Job duration
  const isJobDuration = (tp: TimePeriodLite) =>
    tp.title?.toLowerCase().includes('job duration')

  // Convert time periods to calendar events with filtering
  const events: Array<EventInput> = React.useMemo(() => {
    return timePeriods
      .filter((tp) => {
        if (isJobDuration(tp)) {
          return selectedFilters.has('jobDuration')
        }
        const category = tp.category || 'program'
        return selectedFilters.has(category as CategoryFilter)
      })
      .map((tp) => {
        const c = getRadixColorsForPeriod(tp.title, tp.category)
        return {
          id: tp.id,
          title: tp.title || '(untitled)',
          start: tp.start_at,
          end: tp.end_at,
          backgroundColor: c.bg,
          borderColor: c.border,
          textColor: c.text,
          extendedProps: {
            timePeriodId: tp.id,
          },
        }
      })
  }, [timePeriods, selectedFilters])

  const toggleFilter = (filter: CategoryFilter) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filter)) {
        next.delete(filter)
      } else {
        next.add(filter)
      }
      return next
    })
  }

  // Default to the custom Job view (relevant days)

  // Set initial date to job start
  const initialDate = job && job.start_at ? new Date(job.start_at) : new Date()

  // Compute relevant-days config for a separate "Job" view
  const jobRelevantConfig = React.useMemo(() => {
    if (!job || !job.start_at || !job.end_at) return null
    const start = new Date(job.start_at)
    const end = new Date(job.end_at)
    const durationDays =
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (durationDays > 365) return null // avoid extremely long spans

    // Build list of day indices (0=Sun..6=Sat) to show
    const daysToShow: Array<number> = []
    const cur = new Date(start)
    // include last day fully
    while (cur <= end) {
      daysToShow.push(cur.getDay())
      cur.setDate(cur.getDate() + 1)
    }
    // Unique
    const uniqueDays = Array.from(new Set(daysToShow))
    const allDays = [0, 1, 2, 3, 4, 5, 6]
    const hiddenDays = allDays.filter((d) => !uniqueDays.includes(d))

    // visibleRange to exactly the job span (end is exclusive → add 1 day)
    const range = {
      start: new Date(start.getFullYear(), start.getMonth(), start.getDate())
        .toISOString()
        .split('T')[0],
      end: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
        .toISOString()
        .split('T')[0],
    }

    return { hiddenDays, visibleRange: range }
  }, [job])

  const [currentView, setCurrentView] = React.useState<string>('job')

  return (
    <Box>
      {/* Filter Controls */}
      <Box
        mb="3"
        p="3"
        style={{
          background: 'var(--gray-a2)',
          borderRadius: 8,
          border: '1px solid var(--gray-a4)',
        }}
      >
        <Flex align="center" gap="4" wrap="wrap" style={{ width: '100%' }}>
          <Text
            size="2"
            weight="medium"
            color="gray"
            style={{ minWidth: 'fit-content' }}
          >
            Show:
          </Text>
          {(
            [
              { key: 'jobDuration' as CategoryFilter, label: 'Job Duration' },
              { key: 'program' as CategoryFilter, label: 'Program' },
              { key: 'equipment' as CategoryFilter, label: 'Equipment' },
              { key: 'crew' as CategoryFilter, label: 'Crew' },
              { key: 'transport' as CategoryFilter, label: 'Transport' },
            ] as const
          ).map(({ key, label }) => {
            const colors = getCategoryColor(key)
            const isChecked = selectedFilters.has(key)
            return (
              <Flex
                key={key}
                align="center"
                gap="1"
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background-color 0.2s',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFilter(key)
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked !== isChecked) {
                      toggleFilter(key)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Text
                  as="span"
                  size="2"
                  style={{
                    color: isChecked ? 'var(--gray-12)' : 'var(--gray-11)',
                    fontWeight: isChecked ? '500' : '400',
                    transition: 'color 0.2s',
                  }}
                >
                  {label}
                </Text>
                <Box
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    flexShrink: 0,
                    boxShadow: `0 0 0 1px ${colors.border}20`,
                  }}
                />
              </Flex>
            )
          })}
          {selectedFilters.size > 0 && (
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => setSelectedFilters(new Set())}
              style={{ marginLeft: 'auto' }}
            >
              Remove all
            </Button>
          )}
        </Flex>
      </Box>

      {/* Calendar */}
      <Box className="jobCalendar" style={{ height: 'calc(100vh - 270px)' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="job"
          initialDate={initialDate}
          events={events}
          views={{ job: { type: 'timeGridWeek' } }}
          buttonText={{ job: 'Job' }}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,job',
          }}
          firstDay={1}
          height="100%"
          contentHeight="100%"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          expandRows={true}
          nowIndicator={true}
          datesSet={(arg) => setCurrentView(arg.view.type)}
          editable={false}
          selectable={false}
          selectMirror={true}
          eventOverlap={false}
          eventDisplay="block"
          eventMaxStack={5}
          dayMaxEvents={5}
          eventOrderStrict={true}
          weekends={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          // Limit visible date range to job duration
          validRange={
            job && job.start_at && job.end_at
              ? {
                  start: new Date(job.start_at).toISOString().split('T')[0],
                  end: new Date(
                    new Date(job.end_at).getTime() + 24 * 60 * 60 * 1000,
                  )
                    .toISOString()
                    .split('T')[0],
                }
              : undefined
          }
          // Relevant days only in the custom "Job" view
          hiddenDays={
            currentView === 'job' && jobRelevantConfig
              ? jobRelevantConfig.hiddenDays
              : undefined
          }
          visibleRange={
            currentView === 'job' && jobRelevantConfig
              ? jobRelevantConfig.visibleRange
              : undefined
          }
        />
      </Box>
    </Box>
  )
}

// Helper to get color for a category filter (for the filter UI)
function getCategoryColor(category: CategoryFilter): {
  bg: string
  border: string
  text: string
} {
  switch (category) {
    case 'jobDuration':
      return {
        bg: 'var(--blue-a6)',
        border: 'var(--blue-a8)',
        text: 'var(--blue-12)',
      }
    case 'equipment':
      return {
        bg: 'var(--violet-a6)',
        border: 'var(--violet-a8)',
        text: 'var(--violet-12)',
      }
    case 'crew':
      return {
        bg: 'var(--green-a6)',
        border: 'var(--green-a8)',
        text: 'var(--green-12)',
      }
    case 'transport':
      return {
        bg: 'var(--amber-a6)',
        border: 'var(--amber-a8)',
        text: 'var(--amber-12)',
      }
    case 'program':
      return {
        bg: 'var(--pink-a6)',
        border: 'var(--pink-a8)',
        text: 'var(--pink-12)',
      }
    default:
      return {
        bg: 'var(--gray-a6)',
        border: 'var(--gray-a8)',
        text: 'var(--gray-12)',
      }
  }
}

// Helper to assign colors to time periods
function getRadixColorsForPeriod(
  title: string | null,
  category?: 'program' | 'equipment' | 'crew' | 'transport' | null,
): {
  bg: string
  border: string
  text: string
} {
  const t = (title || '').toLowerCase()

  // Use Radix alpha tokens for less transparent backgrounds (a6 instead of a4)
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

  // Default (e.g., external owner equipment periods)
  return {
    bg: 'var(--indigo-a6)',
    border: 'var(--indigo-a8)',
    text: 'var(--indigo-12)',
  }
}
