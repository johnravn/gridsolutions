import * as React from 'react'
import {
  Box,
  Button,
  Callout,
  Dialog,
  Flex,
  Progress,
  Separator,
  Spinner,
  Text,
} from '@radix-ui/themes'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { NavArrowDown, NavArrowRight, WarningTriangle } from 'iconoir-react'
import { ConflictGroupList } from '@features/conflicts/components/ConflictGroupList'
import { DialogCloseIconButton } from '@shared/ui/components/DialogCloseIconButton'
import {
  conflictDisplayCounts,
  groupConflictsForDisplay,
} from '@features/conflicts/utils/groupConflictsForDisplay'
import {
  formatConflictCountLabel,
  formatConflictEntriesSummary,
} from '@features/conflicts/utils/conflictCopy'
import {
  collectPreviewIgnoreSets,
  emptyBookingSyncIgnoreSets,
  pruneBookingSyncIgnores,
  serializeBookingSyncIgnores,
  setIgnoreNode,
  splitSyncPreviewByIgnores,
} from '@features/jobs/utils/offerBookingDiff'
import { SyncPreviewChangeList } from './SyncPreviewChangeList'
import type {
  BookingSyncIgnoreSets,
  SyncIgnoreNode,
  SyncPreviewViewModel,
} from '@features/jobs/utils/offerBookingDiff'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { SyncBookingsProgress } from '@features/jobs/api/offerBasisQueries'
import type { BasisBookingConflictPreview } from '@features/conflicts/api/equipmentConflictCheck'

export type SyncBasisConfirmMode = 'sync' | 'skip-conflicts' | 'force'

const LEFT_DROP_ID = 'sync-ignore-left'
const RIGHT_DROP_ID = 'sync-ignore-right'

function SyncProgressTrack({
  label,
  current,
  total,
  color,
}: {
  label: string
  current: number
  total: number
  color: 'red' | 'green'
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <Box>
      <Flex justify="between" align="baseline" gap="3" mb="1">
        <Text size="2" weight="medium" color={color}>
          {label}
        </Text>
        <Text size="1" color="gray">
          {total === 0 ? 'None' : `${current} of ${total}`}
        </Text>
      </Flex>
      <Progress value={percent} size="2" color={color} />
    </Box>
  )
}

function DropColumn({
  id,
  children,
  active,
}: {
  id: string
  children: React.ReactNode
  active: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <Box
      ref={setNodeRef as React.Ref<HTMLDivElement>}
      p="3"
      style={{
        minWidth: 0,
        background: 'var(--gray-a2)',
        border: isOver
          ? '1px solid var(--accent-a8)'
          : '1px solid var(--gray-a6)',
        borderRadius: 8,
        outline: active && isOver ? '2px solid var(--accent-a7)' : undefined,
        outlineOffset: -1,
      }}
    >
      {children}
    </Box>
  )
}

function ColumnHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <Box>
      <Text size="3" weight="bold" as="div">
        {title}
      </Text>
      <Text size="1" color="gray" mt="1" as="div">
        {subtitle}
      </Text>
    </Box>
  )
}

function ignoresSignature(sets: BookingSyncIgnoreSets): string {
  return JSON.stringify(serializeBookingSyncIgnores(sets))
}

export function SyncBasisBookingsDialog({
  open,
  onOpenChange,
  basisTitle,
  preview,
  conflicts,
  loading,
  syncing,
  progress,
  initialIgnores,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  basisTitle: string
  preview: SyncPreviewViewModel | null
  conflicts: BasisBookingConflictPreview | null
  loading: boolean
  syncing: boolean
  progress: SyncBookingsProgress | null
  initialIgnores?: BookingSyncIgnoreSets
  onConfirm: (
    mode: SyncBasisConfirmMode,
    options: { ignores: BookingSyncIgnoreSets },
  ) => void
}) {
  const [conflictsExpanded, setConflictsExpanded] = React.useState(false)
  const [ignores, setIgnores] = React.useState<BookingSyncIgnoreSets>(() =>
    emptyBookingSyncIgnoreSets(),
  )
  const [activeNode, setActiveNode] = React.useState<SyncIgnoreNode | null>(
    null,
  )
  const seededPreviewRef = React.useRef<SyncPreviewViewModel | null>(null)
  const seededIgnoresRef = React.useRef<BookingSyncIgnoreSets>(
    emptyBookingSyncIgnoreSets(),
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  React.useEffect(() => {
    if (!open) {
      setConflictsExpanded(false)
      setIgnores(emptyBookingSyncIgnoreSets())
      setActiveNode(null)
      seededPreviewRef.current = null
      seededIgnoresRef.current = emptyBookingSyncIgnoreSets()
    }
  }, [open])

  React.useEffect(() => {
    if (!preview || seededPreviewRef.current === preview) return
    seededPreviewRef.current = preview
    const live = collectPreviewIgnoreSets(preview)
    const next = pruneBookingSyncIgnores(
      initialIgnores ?? emptyBookingSyncIgnoreSets(),
      live,
    )
    seededIgnoresRef.current = next
    setIgnores(next)
  }, [preview, initialIgnores])

  const conflictEntries = groupConflictsForDisplay(conflicts?.conflicts ?? [])
  const { groupCount, itemCount } = conflictDisplayCounts(conflictEntries)
  const hasConflicts = conflictEntries.length > 0
  const split = preview ? splitSyncPreviewByIgnores(preview, ignores) : null
  const remaining = split?.remaining ?? null
  const ignored = split?.ignored ?? null
  const fullyInSync =
    !loading && preview !== null && !preview.hasChanges && !hasConflicts
  const previewReady = !loading && preview !== null
  const ignoresChanged =
    ignoresSignature(ignores) !== ignoresSignature(seededIgnoresRef.current)
  const canSync =
    previewReady &&
    !syncing &&
    ((remaining?.hasChanges ?? false) || ignoresChanged)
  const ignoredHasContent = ignored?.hasChanges ?? false

  const confirm = (mode: SyncBasisConfirmMode) => {
    onConfirm(mode, { ignores })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const node = event.active.data.current as SyncIgnoreNode | undefined
    setActiveNode(node ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const node = event.active.data.current as SyncIgnoreNode | undefined
    const overId = event.over?.id != null ? String(event.over.id) : null
    setActiveNode(null)
    if (!node || !overId) return
    const overColumn =
      overId === RIGHT_DROP_ID || overId.startsWith('right:')
        ? 'right'
        : overId === LEFT_DROP_ID || overId.startsWith('left:')
          ? 'left'
          : null
    if (overColumn === 'right') {
      setIgnores((current) => setIgnoreNode(current, node, true))
      return
    }
    if (overColumn === 'left') {
      setIgnores((current) => setIgnoreNode(current, node, false))
    }
  }

  const dropHint =
    activeNode?.side === 'remove'
      ? {
          title: 'Keep these bookings',
          subtitle:
            'Dropped items stay on the job. They will not be removed or reduced.',
        }
      : activeNode?.side === 'add'
        ? {
            title: 'Skip adding',
            subtitle: 'Dropped items will not be booked from this offer basis.',
          }
        : ignoredHasContent
          ? {
              title: 'Ignored in this sync',
              subtitle:
                'These items stay out of the booking sync until you drag them back.',
            }
          : {
              title: 'Ignored in this sync',
              subtitle: 'Drag items here to skip them.',
            }

  const changeLists = (
    slice: SyncPreviewViewModel,
    column: 'left' | 'right',
  ) => (
    <Flex direction="column" gap="4">
      <SyncPreviewChangeList
        title="Will be added"
        compact={slice.additionCompact}
        groups={slice.additionGroups}
        ungrouped={slice.additionUngrouped}
        ungroupedTitle="Other equipment"
        crew={slice.additionCrew}
        vehicles={slice.additionVehicles}
        extraSummary={
          slice.transportAdditions.length > 0 ? slice.transportSummary : null
        }
        drag={{ column, side: 'add', disabled: syncing }}
        defaultExpanded={
          column === 'right' &&
          slice.additionCompact.equipmentByCategory.length +
            slice.additionCrew.length +
            slice.additionVehicles.length >
            0
        }
      />
      <SyncPreviewChangeList
        title="Will be removed or reduced"
        compact={slice.removalCompact}
        groups={slice.removalGroups}
        ungrouped={slice.removalUngrouped}
        ungroupedTitle="Currently booked"
        crew={slice.removalCrew}
        vehicles={slice.removalVehicles}
        extraSummary={
          slice.transportRemovals.length > 0 &&
          slice.transportAdditions.length === 0
            ? slice.transportSummary
            : null
        }
        drag={{ column, side: 'remove', disabled: syncing }}
        defaultExpanded={
          column === 'left'
            ? slice.removalGroups.length > 0 ||
              slice.removalUngrouped.length > 0
            : slice.removalGroups.length > 0 ||
              slice.removalUngrouped.length > 0 ||
              slice.removalCrew.length > 0 ||
              slice.removalVehicles.length > 0
        }
      />
    </Flex>
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="920px" style={{ maxHeight: '90vh' }}>
        <Flex justify="between" align="start" gap="3">
          <Box style={{ minWidth: 0 }}>
            <Dialog.Title>Sync bookings from offer basis</Dialog.Title>
            <Dialog.Description size="2" color="gray" mt="1">
              Review changes for <strong>{basisTitle}</strong> before replacing
              existing bookings. Drag items to the right to skip them.
            </Dialog.Description>
          </Box>
          <DialogCloseIconButton disabled={syncing} />
        </Flex>
        <Separator my="3" />

        {loading ? (
          <Flex align="center" justify="center" gap="2" py="6">
            <Spinner size="2" />
            <Text size="2" color="gray">
              Loading preview…
            </Text>
          </Flex>
        ) : preview && remaining && ignored ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveNode(null)}
          >
            <Flex
              direction="column"
              gap="3"
              style={{
                maxHeight: 'min(60vh, 560px)',
                overflowY: 'auto',
              }}
            >
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                <DropColumn id={LEFT_DROP_ID} active={!!activeNode}>
                  <Flex direction="column" gap="3">
                    <ColumnHeader
                      title="Included in this sync"
                      subtitle="These bookings will be added, removed, or reduced."
                    />
                    {fullyInSync && (
                      <Callout.Root color="green">
                        <Callout.Text>
                          Bookings already match this offer basis. No changes
                          needed.
                        </Callout.Text>
                      </Callout.Root>
                    )}
                    {changeLists(remaining, 'left')}
                  </Flex>
                </DropColumn>

                <DropColumn id={RIGHT_DROP_ID} active={!!activeNode}>
                  <Flex direction="column" gap="3">
                    <ColumnHeader
                      title={dropHint.title}
                      subtitle={dropHint.subtitle}
                    />
                    {changeLists(ignored, 'right')}
                  </Flex>
                </DropColumn>
              </Box>

              <Box
                p={hasConflicts ? '3' : '2'}
                style={
                  hasConflicts
                    ? {
                        background: 'var(--amber-a2)',
                        border: '1px solid var(--amber-a5)',
                        borderRadius: 8,
                      }
                    : {
                        opacity: 0.55,
                        border: '1px solid var(--gray-a5)',
                        borderRadius: 8,
                        background: 'var(--gray-a1)',
                      }
                }
              >
                {hasConflicts ? (
                  <Button
                    variant="ghost"
                    size="2"
                    color="amber"
                    onClick={() => setConflictsExpanded((v) => !v)}
                    style={{ padding: 0, height: 'auto' }}
                  >
                    <Flex align="center" gap="2">
                      {conflictsExpanded ? (
                        <NavArrowDown width={14} height={14} />
                      ) : (
                        <NavArrowRight width={14} height={14} />
                      )}
                      <WarningTriangle width={16} height={16} />
                      <Text size="2" weight="bold" color="amber">
                        Scheduling conflicts
                      </Text>
                      <Text size="2" color="amber">
                        (
                        {formatConflictCountLabel({
                          groups: groupCount,
                          items: itemCount,
                        })}
                        )
                      </Text>
                    </Flex>
                  </Button>
                ) : (
                  <Text size="2" weight="bold" color="gray">
                    Scheduling conflicts
                  </Text>
                )}

                {!hasConflicts ? (
                  <Text size="2" color="gray" mt="2" as="div">
                    None
                  </Text>
                ) : !conflictsExpanded ? (
                  <Text size="2" color="amber" mt="2" as="div">
                    {formatConflictEntriesSummary(conflictEntries)}
                  </Text>
                ) : (
                  <Box mt="2">
                    <ConflictGroupList
                      conflicts={conflicts?.conflicts ?? []}
                      jobPeriodStart={conflicts?.jobStartAt}
                      jobPeriodEnd={conflicts?.jobEndAt}
                    />
                  </Box>
                )}
              </Box>
            </Flex>
            <DragOverlay
              dropAnimation={null}
              style={{ width: 'auto', height: 'auto' }}
            >
              {activeNode ? (
                <Box
                  px="3"
                  py="2"
                  style={{
                    width: 'max-content',
                    maxWidth: 360,
                    background: 'var(--color-panel-solid)',
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 8,
                    boxShadow: 'var(--shadow-4)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    pointerEvents: 'none',
                  }}
                >
                  <Text size="2" weight="medium">
                    {activeNode.label}
                  </Text>
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              Could not load the sync preview. Close this dialog and try again.
            </Text>
          </Flex>
        )}

        {syncing ? (
          <Flex direction="column" gap="3" mt="4">
            <SyncProgressTrack
              label="Removing bookings"
              color="red"
              current={progress?.removing.current ?? 0}
              total={progress?.removing.total ?? 0}
            />
            <SyncProgressTrack
              label="Creating bookings"
              color="green"
              current={progress?.booking.current ?? 0}
              total={progress?.booking.total ?? 0}
            />
          </Flex>
        ) : null}

        <Flex gap="2" mt="4" justify="end" wrap="wrap">
          <Dialog.Close>
            <Button variant="soft" disabled={syncing}>
              Cancel
            </Button>
          </Dialog.Close>
          {hasConflicts ? (
            <>
              <Button
                variant="outline"
                onClick={() => confirm('skip-conflicts')}
                disabled={!canSync}
              >
                {syncing ? 'Syncing…' : 'Sync without conflicts'}
              </Button>
              <Button
                variant="solid"
                onClick={() => confirm('force')}
                disabled={!canSync}
              >
                {syncing ? 'Syncing…' : 'Sync all (force)'}
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              onClick={() => confirm('sync')}
              disabled={!canSync}
            >
              {syncing ? 'Syncing…' : 'Sync bookings'}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
