import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes'
import {
  Download,
  Edit,
  List,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Trash,
} from 'iconoir-react'
import { SearchableSelect } from '@shared/ui/components/SearchableSelect'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  deleteJobSubcontractorQuote,
  getJobSubcontractorQuotePdfUrl,
  jobSubcontractorQuotesKey,
  jobSubcontractorsKey,
  partnerContactsQuery,
  updateJobSubcontractorContact,
  updateJobSubcontractorNotes,
} from '../../../api/subcontractorQueries'
import { formatMoney } from './formatMoney'
import { QUOTE_NOTE_PREVIEW_MAX } from './noteTextUtils'
import SubcontractorNotePreview from './SubcontractorNotePreview'
import SubcontractorNoteDialog from './SubcontractorNoteDialog'
import SubcontractorProvidedItemsDialog from './SubcontractorProvidedItemsDialog'
import type {
  JobSubcontractorQuoteRow,
  JobSubcontractorRow,
  SubrentalBookingRow,
} from '../../../api/subcontractorQueries'

type NoteDialogState = {
  title: string
  note: string | null
  mode: 'add' | 'view' | 'edit'
  readOnly?: boolean
  onSave?: (note: string | null) => void
} | null

type DeleteQuoteState = JobSubcontractorQuoteRow | null

function CardSummaryHeader({
  name,
  summary,
  showArrow,
  expanded,
  trailing,
  onClick,
}: {
  name: string
  summary: string
  showArrow: boolean
  expanded?: boolean
  trailing?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Box
      p="3"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={onClick}
    >
      <Flex align="center" justify="between" gap="3" wrap="nowrap">
        <Flex align="start" gap="2" style={{ flex: 1, minWidth: 0 }}>
          {showArrow &&
            (expanded ? (
              <NavArrowDown width={18} height={18} style={{ flexShrink: 0 }} />
            ) : (
              <NavArrowRight width={18} height={18} style={{ flexShrink: 0 }} />
            ))}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Heading size="3" mb="1">
              {name}
            </Heading>
            <Text
              size="2"
              color="gray"
              as="div"
              style={{ minHeight: 'var(--line-height-2)' }}
            >
              {summary || '\u00A0'}
            </Text>
          </Box>
        </Flex>
        {trailing && <Box style={{ flexShrink: 0 }}>{trailing}</Box>}
      </Flex>
    </Box>
  )
}

export default function SubcontractorCard({
  jobId,
  companyId,
  subcontractor,
  quotes,
  assignedItems,
  expanded,
  onExpandedChange,
  assignmentMode,
  selectedItemCount,
  onAssignSelected,
  isReadOnly,
  isAssigning,
  onRemove,
  onAddQuote,
  onEditQuote,
}: {
  jobId: string
  companyId: string
  subcontractor: JobSubcontractorRow
  quotes: Array<JobSubcontractorQuoteRow>
  assignedItems: Array<SubrentalBookingRow>
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  assignmentMode: boolean
  selectedItemCount: number
  onAssignSelected: () => void
  isReadOnly: boolean
  isAssigning: boolean
  onRemove: () => void
  onAddQuote: () => void
  onEditQuote: (quote: JobSubcontractorQuoteRow) => void
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [noteDialog, setNoteDialog] = React.useState<NoteDialogState>(null)
  const [deleteQuote, setDeleteQuote] = React.useState<DeleteQuoteState>(null)
  const [providedItemsOpen, setProvidedItemsOpen] = React.useState(false)

  const latestQuote = quotes[0] ?? null

  const { data: contacts = [] } = useQuery({
    ...partnerContactsQuery({
      companyId,
      customerId: subcontractor.customer_id,
    }),
    enabled: expanded && !isReadOnly,
  })

  const contactMutation = useMutation({
    mutationFn: updateJobSubcontractorContact,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorsKey(jobId) })
    },
    onError: (e: Error) => {
      toastError('Could not update contact', e.message)
    },
  })

  const notesMutation = useMutation({
    mutationFn: updateJobSubcontractorNotes,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorsKey(jobId) })
      setNoteDialog(null)
    },
    onError: (e: Error) => {
      toastError('Could not save notes', e.message)
    },
  })

  const deleteQuoteMutation = useMutation({
    mutationFn: deleteJobSubcontractorQuote,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorQuotesKey(jobId) })
      success('Quote deleted', 'Subcontractor quote version was removed.')
      setDeleteQuote(null)
    },
    onError: (e: Error) => {
      toastError('Could not delete quote', e.message)
    },
  })

  const openSubcontractorNoteDialog = (mode: 'add' | 'view' | 'edit') => {
    setNoteDialog({
      title: subcontractor.customer.name,
      note: subcontractor.notes,
      mode,
      readOnly: isReadOnly,
      onSave: (note) =>
        notesMutation.mutate({ id: subcontractor.id, notes: note }),
    })
  }

  const openQuoteNoteDialog = (quote: JobSubcontractorQuoteRow) => {
    setNoteDialog({
      title: `${subcontractor.customer.name} · v${quote.version_number}`,
      note: quote.note,
      mode: 'view',
      readOnly: true,
    })
  }

  const contactOptions = React.useMemo(
    () => [
      { value: '__none__', label: 'No contact' },
      ...contacts.map((c) => ({
        value: c.id,
        label: c.name,
        description:
          [c.title, c.email].filter(Boolean).join(' · ') || undefined,
      })),
    ],
    [contacts],
  )

  const contactLabel =
    subcontractor.contact?.name ??
    (subcontractor.contact_id ? 'Unknown contact' : 'No contact')

  const summaryMetaParts = [contactLabel]
  if (subcontractor.notes) {
    summaryMetaParts.push('Has note')
  }
  if (assignedItems.length > 0) {
    summaryMetaParts.push(
      `${assignedItems.length} item${assignedItems.length !== 1 ? 's' : ''}`,
    )
  }

  const collapsedSummaryText = [
    ...(latestQuote ? [] : ['No quote']),
    ...summaryMetaParts,
  ].join(' · ')

  const assignmentSummaryText = [
    latestQuote ? formatMoney(latestQuote.total_amount) : 'No quote',
    ...summaryMetaParts,
  ].join(' · ')

  const quoteBadge =
    latestQuote != null ? (
      <Badge size="2" variant="soft">
        {formatMoney(latestQuote.total_amount)}
      </Badge>
    ) : null

  if (assignmentMode) {
    return (
      <Card size="2">
        <CardSummaryHeader
          name={subcontractor.customer.name}
          summary={assignmentSummaryText}
          showArrow={false}
          trailing={
            !isReadOnly ? (
              <Button
                size="2"
                onClick={(e) => {
                  e.stopPropagation()
                  onAssignSelected()
                }}
                disabled={isAssigning || selectedItemCount === 0}
              >
                Assign selected ({selectedItemCount})
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <>
      <Card size="2">
        <CardSummaryHeader
          name={subcontractor.customer.name}
          summary={expanded ? '' : collapsedSummaryText}
          showArrow
          expanded={expanded}
          trailing={!expanded ? quoteBadge : undefined}
          onClick={() => onExpandedChange(!expanded)}
        />

        {expanded && (
          <Box
            p="3"
            pt="0"
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'default' }}
          >
            <Flex direction="column" gap="3">
              <Flex direction="column" gap="1" align="start">
                <Text size="2" weight="medium">
                  Contact
                </Text>
                {isReadOnly ? (
                  <Text size="2" color="gray">
                    {contactLabel}
                    {subcontractor.contact?.email
                      ? ` · ${subcontractor.contact.email}`
                      : ''}
                  </Text>
                ) : (
                  <SearchableSelect
                    options={contactOptions}
                    value={subcontractor.contact_id ?? '__none__'}
                    onValueChange={(v) => {
                      const contactId = !v || v === '__none__' ? null : v
                      if (contactId === subcontractor.contact_id) return
                      contactMutation.mutate({
                        id: subcontractor.id,
                        contactId,
                      })
                    }}
                    disabled={contactMutation.isPending}
                    placeholder="Search contact…"
                    emptyMessage="No contacts found"
                    dropdownMaxWidth={320}
                    style={{ width: '100%', maxWidth: 320 }}
                  />
                )}
              </Flex>

              <Flex direction="column" gap="1">
                <Flex align="center" justify="between" wrap="wrap" gap="2">
                  <Text size="2" weight="medium">
                    Subrental equipment
                  </Text>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => setProvidedItemsOpen(true)}
                  >
                    <List width={14} height={14} />
                    Show items provided
                    {assignedItems.length > 0
                      ? ` (${assignedItems.length})`
                      : ''}
                  </Button>
                </Flex>
                <Text size="2" color="gray">
                  {assignedItems.length === 0
                    ? 'No subrental items assigned to this subcontractor yet.'
                    : `${assignedItems.length} subrental item${assignedItems.length !== 1 ? 's are' : ' is'} assigned.`}
                </Text>
              </Flex>

              <Flex direction="column" gap="1">
                <Flex align="center" justify="between" wrap="wrap" gap="2">
                  <Text size="2" weight="medium">
                    Notes
                  </Text>
                  {!isReadOnly && subcontractor.notes && (
                    <Button
                      size="1"
                      variant="soft"
                      aria-label="Edit subcontractor note"
                      onClick={() => openSubcontractorNoteDialog('edit')}
                    >
                      <Edit width={14} height={14} />
                      Edit
                    </Button>
                  )}
                </Flex>
                {subcontractor.notes ? (
                  <SubcontractorNotePreview
                    note={subcontractor.notes}
                    onShowMore={() => openSubcontractorNoteDialog('view')}
                  />
                ) : !isReadOnly ? (
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => openSubcontractorNoteDialog('add')}
                  >
                    Add note
                  </Button>
                ) : (
                  <Text size="2" color="gray">
                    —
                  </Text>
                )}
              </Flex>

              <Flex direction="column" gap="2">
                <Flex align="center" justify="between" wrap="wrap" gap="2">
                  <Text size="2" weight="medium">
                    Quotes
                  </Text>
                  {!isReadOnly && (
                    <Button size="1" variant="soft" onClick={onAddQuote}>
                      <Plus width={14} height={14} />
                      Add quote
                    </Button>
                  )}
                </Flex>
                {quotes.length === 0 ? (
                  <Text size="2" color="gray">
                    No quote versions yet.
                  </Text>
                ) : (
                  <Table.Root variant="ghost" size="1">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Version</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>PDF</Table.ColumnHeaderCell>
                        {!isReadOnly && <Table.ColumnHeaderCell width="80px" />}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {quotes.map((quote) => (
                        <Table.Row key={quote.id}>
                          <Table.Cell>
                            <Badge size="1">v{quote.version_number}</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            {formatMoney(quote.total_amount)}
                          </Table.Cell>
                          <Table.Cell>
                            {quote.note ? (
                              <SubcontractorNotePreview
                                note={quote.note}
                                size="1"
                                maxLength={QUOTE_NOTE_PREVIEW_MAX}
                                onShowMore={() => openQuoteNoteDialog(quote)}
                              />
                            ) : !isReadOnly ? (
                              <Button
                                size="1"
                                variant="soft"
                                onClick={() => onEditQuote(quote)}
                              >
                                Add note
                              </Button>
                            ) : (
                              <Text size="1" color="gray">
                                —
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {quote.pdf_path ? (
                              <Button
                                size="1"
                                variant="ghost"
                                onClick={() =>
                                  void getJobSubcontractorQuotePdfUrl(
                                    quote.pdf_path!,
                                  ).then((url) => window.open(url, '_blank'))
                                }
                              >
                                <Download width={14} height={14} />
                                View
                              </Button>
                            ) : (
                              <Text size="1" color="gray">
                                —
                              </Text>
                            )}
                          </Table.Cell>
                          {!isReadOnly && (
                            <Table.Cell>
                              <Flex gap="1">
                                <Button
                                  size="1"
                                  variant="soft"
                                  aria-label={`Edit quote v${quote.version_number}`}
                                  onClick={() => onEditQuote(quote)}
                                >
                                  <Edit width={14} height={14} />
                                </Button>
                                <Button
                                  size="1"
                                  variant="soft"
                                  color="red"
                                  aria-label={`Delete quote v${quote.version_number}`}
                                  onClick={() => setDeleteQuote(quote)}
                                >
                                  <Trash width={14} height={14} />
                                </Button>
                              </Flex>
                            </Table.Cell>
                          )}
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Flex>

              {!isReadOnly && (
                <Flex justify="end">
                  <Button
                    size="1"
                    variant="soft"
                    color="red"
                    onClick={onRemove}
                  >
                    <Trash width={14} height={14} />
                    Remove subcontractor
                  </Button>
                </Flex>
              )}
            </Flex>
          </Box>
        )}
      </Card>

      {noteDialog && (
        <SubcontractorNoteDialog
          open
          onOpenChange={(open) => {
            if (!open) setNoteDialog(null)
          }}
          title={noteDialog.title}
          initialNote={noteDialog.note}
          mode={noteDialog.mode}
          readOnly={noteDialog.readOnly}
          isSaving={notesMutation.isPending}
          onSave={(note) => noteDialog.onSave?.(note)}
        />
      )}

      <SubcontractorProvidedItemsDialog
        open={providedItemsOpen}
        onOpenChange={setProvidedItemsOpen}
        subcontractorName={subcontractor.customer.name}
        items={assignedItems}
      />

      <AlertDialog.Root
        open={deleteQuote != null}
        onOpenChange={(open) => {
          if (!open) setDeleteQuote(null)
        }}
      >
        <AlertDialog.Content maxWidth="420px">
          <AlertDialog.Title>Delete quote version?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {deleteQuote
              ? `Delete quote v${deleteQuote.version_number} (${formatMoney(deleteQuote.total_amount)})? This cannot be undone.`
              : ''}
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                disabled={deleteQuoteMutation.isPending}
                onClick={() => {
                  if (deleteQuote) deleteQuoteMutation.mutate(deleteQuote.id)
                }}
              >
                {deleteQuoteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
