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
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import { ConflictCard } from '@features/conflicts/components/ConflictCard'
import type { BasisBookingConflictPreview } from '@features/conflicts/api/equipmentConflictCheck'
import type { FormattedOfferDiff } from '@features/jobs/utils/offerBookingDiff'

export type SyncBasisConfirmMode = 'sync' | 'skip-conflicts' | 'force'

function DiffSection({
  title,
  items,
  emptyText,
}: {
  title: string
  items: Array<string>
  emptyText: string
}) {
  return (
    <Box>
      <Text size="2" weight="bold" as="div">
        {title}
      </Text>
      <Flex direction="column" gap="1" mt="2">
        {items.length === 0 ? (
          <Text size="2" color="gray">
            {emptyText}
          </Text>
        ) : (
          items.map((line, idx) => (
            <Text key={`${title}-${idx}`} size="2">
              {line}
            </Text>
          ))
        )}
      </Flex>
    </Box>
  )
}

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
  preview: FormattedOfferDiff | null
  conflicts: BasisBookingConflictPreview | null
  loading: boolean
  syncing: boolean
  onConfirm: (mode: SyncBasisConfirmMode) => void
}) {
  const [conflictsExpanded, setConflictsExpanded] = React.useState(false)

  React.useEffect(() => {
    if (!open) setConflictsExpanded(false)
  }, [open])

  const conflictCount =
    (conflicts?.summaryLines.length ?? 0) + (conflicts?.conflicts.length ?? 0)
  const hasConflicts = conflictCount > 0
  const alreadyInSync =
    !loading && preview !== null && !preview.hasChanges && !hasConflicts

  const conflictingItemCount = conflicts?.conflictingItemIds.length ?? 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Sync bookings from offer basis</Dialog.Title>
        <Dialog.Description size="2" color="gray" mt="1">
          Review changes for <strong>{basisTitle}</strong> before replacing
          existing bookings.
        </Dialog.Description>
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

              <DiffSection
                title="Will be added"
                items={[
                  ...preview.equipmentAdditions.map((l) => `Equipment: ${l}`),
                  ...preview.crewAdditions.map((l) => `Crew: ${l}`),
                  ...preview.transportAdditions.map((l) => `Vehicle: ${l}`),
                ]}
                emptyText="None"
              />

              <DiffSection
                title="Will be removed or reduced"
                items={[
                  ...preview.equipmentRemovals.map((l) => `Equipment: ${l}`),
                  ...preview.crewRemovals.map((l) => `Crew: ${l}`),
                  ...preview.transportRemovals.map((l) => `Vehicle: ${l}`),
                ]}
                emptyText="None"
              />

              {(preview.transportSummary ||
                preview.transportAdditions.length > 0 ||
                preview.transportRemovals.length > 0) && (
                <Box>
                  <Text size="2" weight="bold" as="div">
                    Transport
                  </Text>
                  {preview.transportSummary ? (
                    <Text size="2" color="gray" as="div" mt="2">
                      {preview.transportSummary}
                    </Text>
                  ) : null}
                </Box>
              )}

              <Box>
                <Button
                  variant="ghost"
                  size="2"
                  onClick={() => setConflictsExpanded((v) => !v)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  <Flex align="center" gap="1">
                    {conflictsExpanded ? (
                      <NavArrowDown width={14} height={14} />
                    ) : (
                      <NavArrowRight width={14} height={14} />
                    )}
                    <Text size="2" weight="bold">
                      Scheduling conflicts
                    </Text>
                    {hasConflicts ? (
                      <Text size="2" color="gray">
                        ({conflictingItemCount}{' '}
                        {conflictingItemCount === 1 ? 'item' : 'items'})
                      </Text>
                    ) : null}
                  </Flex>
                </Button>

                {!conflictsExpanded ? (
                  <Text size="2" color="gray" mt="2" as="div">
                    {hasConflicts
                      ? 'Expand to see overlapping bookings and overlap duration.'
                      : 'None'}
                  </Text>
                ) : !hasConflicts ? (
                  <Text size="2" color="gray" mt="2">
                    None
                  </Text>
                ) : (
                  <Flex direction="column" gap="2" mt="2">
                    {(conflicts?.summaryLines ?? []).map((line, index) => (
                      <Text key={`summary-${index}`} size="2" color="gray">
                        {line}
                      </Text>
                    ))}
                    {(conflicts?.conflicts ?? []).map((conflict, index) => (
                      <ConflictCard
                        key={`${conflict.startAt}-${conflict.endAt}-${conflict.itemName ?? ''}-${index}`}
                        conflict={conflict}
                        jobPeriodStart={conflicts?.jobStartAt}
                        jobPeriodEnd={conflicts?.jobEndAt}
                      />
                    ))}
                  </Flex>
                )}
              </Box>
            </Flex>
          </Box>
        ) : (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              Could not load preview.
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
                disabled={loading || syncing || alreadyInSync}
              >
                {syncing ? 'Syncing…' : 'Sync without conflicts'}
              </Button>
              <Button
                variant="solid"
                onClick={() => onConfirm('force')}
                disabled={loading || syncing || alreadyInSync}
              >
                {syncing ? 'Syncing…' : 'Sync all (force)'}
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              onClick={() => onConfirm('sync')}
              disabled={loading || syncing || alreadyInSync}
            >
              {syncing ? 'Syncing…' : 'Sync bookings'}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
