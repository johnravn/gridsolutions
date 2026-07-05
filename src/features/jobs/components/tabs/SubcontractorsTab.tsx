import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Callout, Flex, Heading, Switch, Text } from '@radix-ui/themes'
import { InfoCircle, Plus } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useToast } from '@shared/ui/toast/ToastProvider'
import AddJobSubcontractorDialog from '../dialogs/AddJobSubcontractorDialog'
import {
  assignSubrentalBookingSubcontractor,
  assignSubrentalBookingsToSubcontractor,
  jobSubcontractorQuotesQuery,
  jobSubcontractorsKey,
  jobSubcontractorsQuery,
  jobSubrentalBookingsKey,
  jobSubrentalBookingsQuery,
  removeJobSubcontractor,
} from '../../api/subcontractorQueries'
import AddQuoteDialog from './subcontractors/AddQuoteDialog'
import SubcontractorCard from './subcontractors/SubcontractorCard'
import SubrentalItemsList, {
  allSubrentalItemsUnassigned,
  countUnassignedSubrentalItems,
  subrentalItemsForSubcontractor,
} from './subcontractors/SubrentalItemsList'
import type {
  JobSubcontractorQuoteRow,
  JobSubcontractorRow,
} from '../../api/subcontractorQueries'

type QuoteDialogState = {
  subcontractor: JobSubcontractorRow
  quote?: JobSubcontractorQuoteRow
} | null

export default function SubcontractorsTab({ jobId }: { jobId: string }) {
  const { companyId } = useCompany()
  const { isReadOnly } = useCompanyWriteAccess()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [addOpen, setAddOpen] = React.useState(false)
  const [quoteDialog, setQuoteDialog] = React.useState<QuoteDialogState>(null)
  const [selectedItemIds, setSelectedItemIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [selectionEnabled, setSelectionEnabled] = React.useState(false)
  const userToggledSelectionRef = React.useRef(false)
  const [expandedCardIds, setExpandedCardIds] = React.useState<Set<string>>(
    () => new Set(),
  )

  const { data: subcontractors = [], isLoading: subsLoading } = useQuery({
    ...jobSubcontractorsQuery({ jobId }),
  })

  const { data: jobQuotes = [], isLoading: quotesLoading } = useQuery({
    ...jobSubcontractorQuotesQuery({ jobId }),
  })

  const { data: subrentalBookings = [], isLoading: bookingsLoading } = useQuery(
    {
      ...jobSubrentalBookingsQuery({ jobId }),
    },
  )

  const quotesBySubcontractor = React.useMemo(() => {
    const map = new Map<string, typeof jobQuotes>()
    for (const quote of jobQuotes) {
      const list = map.get(quote.job_subcontractor_id) ?? []
      list.push(quote)
      map.set(quote.job_subcontractor_id, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.version_number - a.version_number)
    }
    return map
  }, [jobQuotes])

  const unassignedCount = countUnassignedSubrentalItems(subrentalBookings)
  const jobPartnerIds = subcontractors.map((s) => s.customer_id)

  React.useEffect(() => {
    if (bookingsLoading) return

    if (subrentalBookings.length === 0 || unassignedCount === 0) {
      setSelectionEnabled(false)
      setSelectedItemIds(new Set())
      userToggledSelectionRef.current = false
      return
    }

    if (
      !userToggledSelectionRef.current &&
      allSubrentalItemsUnassigned(subrentalBookings)
    ) {
      setSelectionEnabled(true)
    }
  }, [bookingsLoading, subrentalBookings, unassignedCount])

  React.useEffect(() => {
    setSelectedItemIds((prev) => {
      if (prev.size === 0) return prev
      const unassignedIds = new Set(
        subrentalBookings
          .filter((row) => !row.subcontractor_id)
          .map((row) => row.id),
      )
      const next = new Set([...prev].filter((id) => unassignedIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [subrentalBookings])

  const setBulkSelectionEnabled = (enabled: boolean) => {
    userToggledSelectionRef.current = true
    setSelectionEnabled(enabled)
    if (!enabled) setSelectedItemIds(new Set())
  }

  const assignmentMode = selectionEnabled && selectedItemIds.size > 0

  const removeMutation = useMutation({
    mutationFn: removeJobSubcontractor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorsKey(jobId) })
      success('Removed', 'Subcontractor removed from job')
    },
    onError: (e: Error) => {
      toastError('Could not remove subcontractor', e.message)
    },
  })

  const assignSingleMutation = useMutation({
    mutationFn: assignSubrentalBookingSubcontractor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubrentalBookingsKey(jobId) })
      success('Assigned', 'Subrental equipment assigned to subcontractor')
    },
    onError: (e: Error) => {
      toastError('Could not assign subcontractor', e.message)
    },
  })

  const assignBatchMutation = useMutation({
    mutationFn: assignSubrentalBookingsToSubcontractor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubrentalBookingsKey(jobId) })
      setSelectedItemIds(new Set())
      success('Assigned', 'Selected items assigned to subcontractor')
    },
    onError: (e: Error) => {
      toastError('Could not assign subcontractor', e.message)
    },
  })

  const toggleItemSelection = (id: string) => {
    const row = subrentalBookings.find((item) => item.id === id)
    if (!row || row.subcontractor_id) return
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCardExpanded = (id: string, expanded: boolean) => {
    if (assignmentMode) return
    setExpandedCardIds((prev) => {
      const next = new Set(prev)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const isAssigning =
    assignSingleMutation.isPending || assignBatchMutation.isPending

  return (
    <Box>
      <Heading size="3" mb="3">
        Subcontractors
      </Heading>

      {unassignedCount > 0 && (
        <Callout.Root color="orange" mb="3" size="1">
          <Callout.Icon>
            <InfoCircle />
          </Callout.Icon>
          <Callout.Text>
            {unassignedCount} subrental item
            {unassignedCount !== 1 ? 's are' : ' is'} not assigned to a
            subcontractor.
          </Callout.Text>
        </Callout.Root>
      )}

      {subsLoading || quotesLoading ? (
        <Text size="2" color="gray" mb="4">
          Loading subcontractors…
        </Text>
      ) : (
        <Flex direction="column" gap="2" mb="5">
          {subcontractors.map((sub) =>
            companyId ? (
              <SubcontractorCard
                key={sub.id}
                jobId={jobId}
                companyId={companyId}
                subcontractor={sub}
                quotes={quotesBySubcontractor.get(sub.id) ?? []}
                assignedItems={subrentalItemsForSubcontractor(
                  subrentalBookings,
                  sub.customer_id,
                )}
                expanded={!assignmentMode && expandedCardIds.has(sub.id)}
                onExpandedChange={(expanded) =>
                  toggleCardExpanded(sub.id, expanded)
                }
                assignmentMode={assignmentMode}
                selectedItemCount={selectedItemIds.size}
                onAssignSelected={() =>
                  assignBatchMutation.mutate({
                    reservedItemIds: [...selectedItemIds],
                    subcontractorId: sub.customer_id,
                  })
                }
                isReadOnly={isReadOnly}
                isAssigning={isAssigning}
                onRemove={() => removeMutation.mutate(sub.id)}
                onAddQuote={() => setQuoteDialog({ subcontractor: sub })}
                onEditQuote={(quote) =>
                  setQuoteDialog({ subcontractor: sub, quote })
                }
              />
            ) : null,
          )}

          {companyId && !isReadOnly && (
            <Box
              p={subcontractors.length === 0 ? '4' : '2'}
              style={{
                border: '2px dashed var(--gray-a6)',
                borderRadius: 8,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 100ms',
              }}
              onClick={() => setAddOpen(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-a8)'
                e.currentTarget.style.background = 'var(--gray-a2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-a6)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Flex
                direction="column"
                align="center"
                gap="2"
                justify="center"
                style={
                  subcontractors.length > 0
                    ? { flexDirection: 'row' }
                    : undefined
                }
              >
                <Plus
                  width={subcontractors.length === 0 ? 24 : 16}
                  height={subcontractors.length === 0 ? 24 : 16}
                />
                <Text size="2" color="gray">
                  Add subcontractor
                </Text>
              </Flex>
            </Box>
          )}

          {subcontractors.length === 0 && isReadOnly && (
            <Text size="2" color="gray">
              No subcontractors on this job yet.
            </Text>
          )}
        </Flex>
      )}

      <Heading size="3" mb="2">
        Subrental equipment
      </Heading>
      {!isReadOnly && unassignedCount > 0 && (
        <Flex as="label" align="center" gap="2" mb="2">
          <Switch
            checked={selectionEnabled}
            onCheckedChange={setBulkSelectionEnabled}
          />
          <Text size="2">Select items to assign in bulk</Text>
        </Flex>
      )}
      <Text size="2" color="gray" mb="3">
        {selectionEnabled
          ? 'Check unassigned items below, then assign using the buttons on subcontractor cards above. Assigned items stay non-selectable.'
          : 'Use the menu on each row to assign one at a time, or turn on bulk selection above.'}
      </Text>

      {bookingsLoading ? (
        <Text size="2" color="gray">
          Loading subrental equipment…
        </Text>
      ) : (
        <SubrentalItemsList
          items={subrentalBookings}
          subcontractors={subcontractors}
          selectedItemIds={selectedItemIds}
          selectionEnabled={selectionEnabled}
          onToggleItem={toggleItemSelection}
          onClearSelection={() => setSelectedItemIds(new Set())}
          onAssignSingle={(reservedItemId, subcontractorId) =>
            assignSingleMutation.mutate({ reservedItemId, subcontractorId })
          }
          isReadOnly={isReadOnly}
          isAssigning={isAssigning}
        />
      )}

      {companyId && (
        <AddJobSubcontractorDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          jobId={jobId}
          companyId={companyId}
          excludeCustomerIds={jobPartnerIds}
        />
      )}

      {companyId && quoteDialog && (
        <AddQuoteDialog
          open
          onOpenChange={(open) => {
            if (!open) setQuoteDialog(null)
          }}
          jobId={jobId}
          companyId={companyId}
          subcontractor={quoteDialog.subcontractor}
          quote={quoteDialog.quote}
        />
      )}
    </Box>
  )
}
