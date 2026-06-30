import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  IconButton,
  Select,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Plus, Trash } from 'iconoir-react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import {
  createRecurringJobTemplate,
  updateRecurringJobTemplate,
} from '../../api/recurringJobQueries'
import {
  formatTemplateStartTimeForInput,
  normalizeTemplateStartTimeForDb,
} from '../../utils/recurringJobCreateDefaults'
import type {
  JobStatus,
  RecurringJobTemplate,
  RecurringJobTemplateCrewRole,
  UUID,
} from '../../types'

const STATUS_OPTIONS: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
]

const TITLE_SUGGESTIONS = [
  'Technician',
  'Loader',
  'FOH',
  'Monitors',
  'Hands',
  'Driver',
]

const CATEGORY_SUGGESTIONS = ['Audio', 'Lights', 'AV', 'Transport', 'Rigging']

function emptyCrewRole(): RecurringJobTemplateCrewRole {
  return { title: '', needed_count: 1, role_category: null }
}

function TemplateCrewRoleFields({
  role,
  onChange,
  onRemove,
}: {
  role: RecurringJobTemplateCrewRole
  onChange: (patch: Partial<RecurringJobTemplateCrewRole>) => void
  onRemove: () => void
}) {
  const [neededDraft, setNeededDraft] = React.useState<string | null>(null)

  return (
    <Box
      p="2"
      style={{
        borderRadius: 'var(--radius-2)',
        background: 'var(--gray-a2)',
      }}
    >
      <Flex gap="2" align="end" wrap="wrap">
        <label style={{ flex: '2 1 120px', minWidth: 0 }}>
          <Text as="div" size="1" mb="1" color="gray">
            Title
          </Text>
          <TextField.Root
            placeholder="e.g. FOH"
            value={role.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label style={{ flex: '0 1 72px' }}>
          <Text as="div" size="1" mb="1" color="gray">
            Needed
          </Text>
          <TextField.Root
            type="number"
            min="1"
            value={neededDraft ?? String(role.needed_count)}
            onChange={(e) => {
              const nextValue = e.target.value
              setNeededDraft(nextValue)

              if (nextValue === '') return
              const parsed = Number(nextValue)
              if (Number.isNaN(parsed)) return

              onChange({ needed_count: Math.max(1, parsed) })
              setNeededDraft(null)
            }}
            onBlur={() => {
              if (neededDraft === '') {
                setNeededDraft(null)
              }
            }}
          />
        </label>
        <label style={{ flex: '1 1 100px', minWidth: 0 }}>
          <Text as="div" size="1" mb="1" color="gray">
            Category
          </Text>
          <TextField.Root
            placeholder="e.g. Audio"
            value={role.role_category ?? ''}
            onChange={(e) =>
              onChange({ role_category: e.target.value || null })
            }
          />
        </label>
        <IconButton
          size="1"
          variant="ghost"
          color="red"
          aria-label="Remove role"
          onClick={onRemove}
        >
          <Trash width={14} height={14} />
        </IconButton>
      </Flex>
      <Flex gap="1" wrap="wrap" mt="1">
        {TITLE_SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            size="1"
            variant="soft"
            color="gray"
            onClick={() => onChange({ title: suggestion })}
          >
            {suggestion}
          </Button>
        ))}
      </Flex>
    </Box>
  )
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  recurringJobId: UUID
  mode?: 'create' | 'edit'
  initialData?: RecurringJobTemplate
}

export default function RecurringJobTemplateDialog({
  open,
  onOpenChange,
  companyId,
  recurringJobId,
  mode = 'create',
  initialData,
}: Props) {
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const isSmallScreen = useMediaQuery('(max-width: 768px)')

  const [name, setName] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [status, setStatus] = React.useState<JobStatus>('planned')
  const [durationHours, setDurationHours] = React.useState('3')
  const [startTime, setStartTime] = React.useState('')
  const [crewRoles, setCrewRoles] = React.useState<
    Array<RecurringJobTemplateCrewRole>
  >([])

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    setName(initialData.name)
    setTitle(initialData.title)
    setDescription(initialData.description ?? '')
    setStatus(initialData.status)
    setDurationHours(String(initialData.duration_hours))
    setStartTime(formatTemplateStartTimeForInput(initialData.start_time))
    setCrewRoles(
      initialData.crew_roles.length > 0
        ? initialData.crew_roles.map((role) => ({ ...role }))
        : [],
    )
  }, [open, mode, initialData])

  React.useEffect(() => {
    if (!open || mode !== 'create') return
    setName('')
    setTitle('')
    setDescription('')
    setStatus('planned')
    setDurationHours('3')
    setStartTime('')
    setCrewRoles([])
  }, [open, mode])

  const updateCrewRole = (
    index: number,
    patch: Partial<RecurringJobTemplateCrewRole>,
  ) => {
    setCrewRoles((roles) =>
      roles.map((role, i) => (i === index ? { ...role, ...patch } : role)),
    )
  }

  const save = useMutation({
    mutationFn: async () => {
      const hours = Number(durationHours)
      const normalizedRoles = crewRoles
        .map((role) => ({
          title: role.title.trim(),
          needed_count: Math.max(1, Math.floor(role.needed_count)),
          role_category: role.role_category?.trim().toLowerCase() || null,
        }))
        .filter((role) => role.title.length > 0)

      const payload = {
        name,
        title,
        description: description || null,
        status,
        durationHours: Number.isFinite(hours) ? hours : 3,
        startTime: startTime.trim()
          ? normalizeTemplateStartTimeForDb(startTime.trim())
          : null,
        crewRoles: normalizedRoles,
      }

      if (mode === 'create') {
        return createRecurringJobTemplate({
          recurringJobId,
          companyId,
          ...payload,
        })
      }
      if (!initialData) throw new Error('Missing template')
      await updateRecurringJobTemplate({
        id: initialData.id,
        ...payload,
      })
      return initialData.id
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['recurring-jobs-templates', recurringJobId],
      })
      success(mode === 'create' ? 'Template created' : 'Template updated')
      onOpenChange(false)
    },
    onError: (err: Error) => showError('Failed to save template', err.message),
  })

  const hoursNum = Number(durationHours)
  const startTimeValid =
    !startTime.trim() || normalizeTemplateStartTimeForDb(startTime.trim())
  const disabled =
    save.isPending ||
    !name.trim() ||
    !title.trim() ||
    !Number.isFinite(hoursNum) ||
    hoursNum <= 0 ||
    !startTimeValid

  const leftColumnRef = React.useRef<HTMLDivElement>(null)
  const crewHeaderRef = React.useRef<HTMLDivElement>(null)
  const [leftColumnHeight, setLeftColumnHeight] = React.useState(0)
  const [crewHeaderHeight, setCrewHeaderHeight] = React.useState(0)

  React.useLayoutEffect(() => {
    if (!open) return

    const measure = () => {
      setLeftColumnHeight(leftColumnRef.current?.offsetHeight ?? 0)
      setCrewHeaderHeight(crewHeaderRef.current?.offsetHeight ?? 0)
    }

    measure()

    const observed = [leftColumnRef.current, crewHeaderRef.current].filter(
      Boolean,
    ) as Array<Element>
    if (observed.length === 0) return

    const observer = new ResizeObserver(measure)
    for (const element of observed) observer.observe(element)

    return () => observer.disconnect()
  }, [
    open,
    isSmallScreen,
    name,
    title,
    description,
    status,
    durationHours,
    startTime,
  ])

  const crewListMaxHeight =
    leftColumnHeight > 0 && crewHeaderHeight > 0
      ? Math.max(leftColumnHeight - crewHeaderHeight, 80)
      : undefined

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="960px"
        style={{ maxWidth: 'min(960px, calc(100vw - 32px))' }}
      >
        <Dialog.Title>
          {mode === 'create' ? 'New job template' : 'Edit job template'}
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Templates pre-fill fields when creating a new job in this recurring
          job. Set a standard start time and crew roles so you only need to pick
          the date.
        </Dialog.Description>

        <Flex
          direction={isSmallScreen ? 'column' : 'row'}
          gap="4"
          align={isSmallScreen ? 'stretch' : 'flex-start'}
        >
          <Box ref={leftColumnRef} style={{ flex: '1 1 280px', minWidth: 0 }}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Template name
                </Text>
                <TextField.Root
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard evening show"
                />
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Default job title
                </Text>
                <TextField.Root
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title for new jobs"
                />
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Default job notes
                </Text>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes pre-filled on the job"
                  rows={3}
                />
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Default status
                </Text>
                <Select.Root
                  value={status}
                  onValueChange={(v) => setStatus(v as JobStatus)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {STATUS_OPTIONS.map((s) => (
                      <Select.Item key={s} value={s}>
                        {makeWordPresentable(s)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>

              <Flex gap="3" wrap="wrap">
                <label style={{ flex: '1 1 120px' }}>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Duration (hours)
                  </Text>
                  <TextField.Root
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                </label>

                <label style={{ flex: '1 1 120px' }}>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Start time
                  </Text>
                  <TextField.Root
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </label>
              </Flex>
            </Flex>
          </Box>

          {isSmallScreen ? (
            <Separator size="4" />
          ) : (
            <Separator orientation="vertical" size="4" />
          )}

          <Flex
            direction="column"
            style={{
              flex: '1 1 280px',
              minWidth: 0,
              minHeight: 0,
              maxHeight:
                !isSmallScreen && leftColumnHeight > 0
                  ? leftColumnHeight
                  : undefined,
            }}
          >
            <Box ref={crewHeaderRef}>
              <Flex justify="between" align="center" gap="2" mb="2" wrap="wrap">
                <Text size="2" weight="medium">
                  Crew roles
                </Text>
                <Button
                  size="1"
                  variant="soft"
                  onClick={() =>
                    setCrewRoles((roles) => [...roles, emptyCrewRole()])
                  }
                >
                  <Plus width={14} height={14} />
                  Add role
                </Button>
              </Flex>
              <Text size="1" color="gray" mb="2">
                Roles use the job start and end when you use this template.
              </Text>
            </Box>

            <Box
              style={{
                overflowY: 'auto',
                minHeight: 0,
                flex: !isSmallScreen && leftColumnHeight > 0 ? 1 : undefined,
                maxHeight: crewListMaxHeight,
                paddingRight: 4,
              }}
            >
              {crewRoles.length === 0 ? (
                <Text size="2" color="gray">
                  No crew roles defined.
                </Text>
              ) : (
                <Flex direction="column" gap="2">
                  {crewRoles.map((role, index) => (
                    <TemplateCrewRoleFields
                      key={index}
                      role={role}
                      onChange={(patch) => updateCrewRole(index, patch)}
                      onRemove={() =>
                        setCrewRoles((roles) =>
                          roles.filter((_, i) => i !== index),
                        )
                      }
                    />
                  ))}
                  <Flex gap="1" wrap="wrap" pt="1">
                    {CATEGORY_SUGGESTIONS.map((suggestion) => (
                      <Button
                        key={suggestion}
                        size="1"
                        variant="soft"
                        color="gray"
                        onClick={() => {
                          const emptyIndex = crewRoles.findIndex(
                            (r) => !r.role_category,
                          )
                          if (emptyIndex >= 0) {
                            updateCrewRole(emptyIndex, {
                              role_category: suggestion.toLowerCase(),
                            })
                          }
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </Flex>
                </Flex>
              )}
            </Box>
          </Flex>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Button disabled={disabled} onClick={() => save.mutate()}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
