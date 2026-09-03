import * as React from 'react'
import {
  Box,
  Button,
  Callout,
  Dialog,
  Flex,
  Separator,
  Spinner,
  Text,
} from '@radix-ui/themes'
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
import { SyncPreviewChangeList } from './SyncPreviewChangeList'
import type { BasisBookingConflictPreview } from '@features/conflicts/api/equipmentConflictCheck'
import type { SyncPreviewViewModel } from '@features/jobs/utils/offerBookingDiff'

export type SyncBasisConfirmMode = 'sync' | 'skip-conflicts' | 'force'

export function SyncBasisBookingsDialog({
  open,
  onOpenChange,
  basisTitle,
  preview,
  conflicts,
  loading,
  syncing,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  basisTitle: string
  preview: SyncPreviewViewModel | null
  conflicts: BasisBookingConflictPreview | null
  loading: boolean
  syncing: boolean
  onConfirm: (mode: SyncBasisConfirmMode) => void
}) {
  const [conflictsExpanded, setConflictsExpanded] = React.useState(false)

  React.useEffect(() => {
    if (!open) setConflictsExpanded(false)
  }, [open])

  const conflictEntries = groupConflictsForDisplay(conflicts?.conflicts ?? [])
  const { groupCount, itemCount } = conflictDisplayCounts(conflictEntries)
  const hasConflicts = conflictEntries.length > 0
  const alreadyInSync =
    !loading && preview !== null && !preview.hasChanges && !hasConflicts
  const previewReady = !loading && preview !== null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Flex justify="between" align="start" gap="3">
          <Box style={{ minWidth: 0 }}>
            <Dialog.Title>Sync bookings from offer basis</Dialog.Title>
            <Dialog.Description size="2" color="gray" mt="1">
              Review changes for <strong>{basisTitle}</strong> before replacing
              existing bookings.
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
        ) : preview ? (
          <Box
            p="3"
            style={{
              background: 'var(--gray-a2)',
              border: '1px solid var(--gray-a6)',
              borderRadius: 8,
              maxHeight: 'min(60vh, 520px)',
              overflowY: 'auto',
            }}
          >
            <Flex direction="column" gap="4">
              {alreadyInSync && (
                <Callout.Root color="green">
                  <Callout.Text>
                    Bookings already match this offer basis. No changes needed.
                  </Callout.Text>
                </Callout.Root>
              )}

              <SyncPreviewChangeList
                title="Will be added"
                compact={preview.additionCompact}
                groups={preview.additionGroups}
                ungrouped={preview.additionUngrouped}
                ungroupedTitle="Other equipment"
                crew={preview.additionCrew}
                extraSummary={
                  preview.transportAdditions.length > 0
                    ? preview.transportSummary
                    : null
                }
              />

              <SyncPreviewChangeList
                title="Will be removed or reduced"
                compact={preview.removalCompact}
                groups={preview.removalGroups}
                ungrouped={preview.removalUngrouped}
                ungroupedTitle="Currently booked"
                crew={preview.removalCrew}
                extraSummary={
                  preview.transportRemovals.length > 0 &&
                  preview.transportAdditions.length === 0
                    ? preview.transportSummary
                    : null
                }
              />

              <Box
                p={hasConflicts ? '3' : '0'}
                style={
                  hasConflicts
                    ? {
                        background: 'var(--amber-a2)',
                        border: '1px solid var(--amber-a5)',
                        borderRadius: 8,
                      }
                    : undefined
                }
              >
                <Button
                  variant="ghost"
                  size="2"
                  color={hasConflicts ? 'amber' : undefined}
                  onClick={() => setConflictsExpanded((v) => !v)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  <Flex align="center" gap="2">
                    {conflictsExpanded ? (
                      <NavArrowDown width={14} height={14} />
                    ) : (
                      <NavArrowRight width={14} height={14} />
                    )}
                    {hasConflicts ? (
                      <WarningTriangle width={16} height={16} />
                    ) : null}
                    <Text
                      size="2"
                      weight="bold"
                      color={hasConflicts ? 'amber' : undefined}
                    >
                      Scheduling conflicts
                    </Text>
                    {hasConflicts ? (
                      <Text size="2" color="amber">
                        (
                        {formatConflictCountLabel({
                          groups: groupCount,
                          items: itemCount,
                        })}
                        )
                      </Text>
                    ) : null}
                  </Flex>
                </Button>

                {!conflictsExpanded ? (
                  <Text
                    size="2"
                    color={hasConflicts ? 'amber' : 'gray'}
                    mt="2"
                    as="div"
                  >
                    {hasConflicts
                      ? formatConflictEntriesSummary(conflictEntries)
                      : 'None'}
                  </Text>
                ) : !hasConflicts ? (
                  <Text size="2" color="gray" mt="2">
                    None
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
          </Box>
        ) : (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              Could not load the sync preview. Close this dialog and try again.
            </Text>
          </Flex>
        )}

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
                onClick={() => onConfirm('skip-conflicts')}
                disabled={!previewReady || syncing || alreadyInSync}
              >
                {syncing ? 'Syncing…' : 'Sync without conflicts'}
              </Button>
              <Button
                variant="solid"
                onClick={() => onConfirm('force')}
                disabled={!previewReady || syncing || alreadyInSync}
              >
                {syncing ? 'Syncing…' : 'Sync all (force)'}
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              onClick={() => onConfirm('sync')}
              disabled={!previewReady || syncing || alreadyInSync}
            >
              {syncing ? 'Syncing…' : 'Sync bookings'}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
