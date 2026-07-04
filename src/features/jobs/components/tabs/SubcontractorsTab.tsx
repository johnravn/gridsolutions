import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Select,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Download, Plus, Trash } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useToast } from '@shared/ui/toast/ToastProvider'
import AddJobSubcontractorDialog from '../dialogs/AddJobSubcontractorDialog'
import {
  assignSubrentalBookingSubcontractor,
  createJobSubcontractorQuote,
  getJobSubcontractorQuotePdfUrl,
  jobSubcontractorQuotesKey,
  jobSubcontractorQuotesQuery,
  jobSubcontractorsKey,
  jobSubcontractorsQuery,
  jobSubrentalBookingsKey,
  jobSubrentalBookingsQuery,
  removeJobSubcontractor,
  updateJobSubcontractorNotes,
  uploadJobSubcontractorQuotePdf,
} from '../../api/subcontractorQueries'
import type { JobSubcontractorRow } from '../../api/subcontractorQueries'

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

function AddQuoteDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  subcontractor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  companyId: string
  subcontractor: JobSubcontractorRow
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [totalAmount, setTotalAmount] = React.useState(0)
  const [note, setNote] = React.useState('')
  const [pdfMeta, setPdfMeta] = React.useState<{
    path: string
    filename: string
    mimeType: string
    sizeBytes: number
  } | null>(null)
  const [uploading, setUploading] = React.useState(false)

  const reset = () => {
    setTotalAmount(0)
    setNote('')
    setPdfMeta(null)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await createJobSubcontractorQuote({
        jobId,
        jobSubcontractorId: subcontractor.id,
        totalAmount,
        note: note.trim() || null,
        pdfPath: pdfMeta?.path ?? null,
        pdfFilename: pdfMeta?.filename ?? null,
        mimeType: pdfMeta?.mimeType ?? null,
        sizeBytes: pdfMeta?.sizeBytes ?? null,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: jobSubcontractorQuotesKey(jobId),
      })
      success('Quote added', 'Subcontractor quote version saved.')
      reset()
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toastError('Could not save quote', e.message)
    },
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const uploaded = await uploadJobSubcontractorQuotePdf({
        companyId,
        jobId,
        jobSubcontractorId: subcontractor.id,
        file,
      })
      setPdfMeta(uploaded)
    } catch (e) {
      toastError(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload PDF',
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Add quote — {subcontractor.customer.name}</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Box>
            <Text size="2" weight="medium" mb="1" as="div">
              Total amount
            </Text>
            <TextField.Root
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
            />
          </Box>
          <Box>
            <Text size="2" weight="medium" mb="1" as="div">
              Note
            </Text>
            <TextArea
              value={note}
              rows={2}
              placeholder="Optional note"
              onChange={(e) => setNote(e.target.value)}
            />
          </Box>
          <Flex gap="2" align="center" wrap="wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
              }}
            />
            <Button
              size="1"
              variant="soft"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {pdfMeta ? 'Replace PDF' : 'Upload PDF'}
            </Button>
            {pdfMeta && <Text size="2">{pdfMeta.filename}</Text>}
          </Flex>
          <Flex justify="end" gap="2" mt="2">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || totalAmount <= 0}
            >
              Save quote version
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export default function SubcontractorsTab({ jobId }: { jobId: string }) {
  const { companyId } = useCompany()
  const { isReadOnly } = useCompanyWriteAccess()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [addOpen, setAddOpen] = React.useState(false)
  const [quoteDialogSub, setQuoteDialogSub] =
    React.useState<JobSubcontractorRow | null>(null)

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

  const assignMutation = useMutation({
    mutationFn: assignSubrentalBookingSubcontractor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubrentalBookingsKey(jobId) })
      success('Assigned', 'Subrental equipment assigned to subcontractor')
    },
    onError: (e: Error) => {
      toastError('Could not assign subcontractor', e.message)
    },
  })

  const notesMutation = useMutation({
    mutationFn: updateJobSubcontractorNotes,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorsKey(jobId) })
    },
    onError: (e: Error) => {
      toastError('Could not save notes', e.message)
    },
  })

  const jobPartnerIds = subcontractors.map((s) => s.customer_id)

  const quotesBySubcontractor = React.useMemo(() => {
    const map = new Map<string, typeof jobQuotes>()
    for (const quote of jobQuotes) {
      const list = map.get(quote.job_subcontractor_id) ?? []
      list.push(quote)
      map.set(quote.job_subcontractor_id, list)
    }
    return map
  }, [jobQuotes])

  return (
    <Box>
      <Flex align="center" justify="between" mb="3">
        <Heading size="3">Subcontractors</Heading>
        {companyId && !isReadOnly && (
          <Button size="2" onClick={() => setAddOpen(true)}>
            <Plus /> Add subcontractor
          </Button>
        )}
      </Flex>

      {subsLoading ? (
        <Text size="2" color="gray">
          Loading subcontractors…
        </Text>
      ) : subcontractors.length === 0 ? (
        <Text size="2" color="gray" mb="4">
          No subcontractors on this job yet. Add partner customers who will
          supply subrental equipment.
        </Text>
      ) : (
        <Table.Root variant="surface" mb="5">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Partner</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Contact</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Notes</Table.ColumnHeaderCell>
              {!isReadOnly && <Table.ColumnHeaderCell width="60px" />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {subcontractors.map((sub) => (
              <Table.Row key={sub.id}>
                <Table.Cell>
                  <Text weight="medium">{sub.customer.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {[sub.customer.email, sub.customer.phone]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {isReadOnly ? (
                    <Text size="2">{sub.notes || '—'}</Text>
                  ) : (
                    <TextArea
                      defaultValue={sub.notes ?? ''}
                      placeholder="Notes"
                      rows={2}
                      onBlur={(e) => {
                        const next = e.target.value.trim() || null
                        if (next !== (sub.notes ?? null)) {
                          notesMutation.mutate({ id: sub.id, notes: next })
                        }
                      }}
                    />
                  )}
                </Table.Cell>
                {!isReadOnly && (
                  <Table.Cell>
                    <Button
                      size="1"
                      variant="soft"
                      color="red"
                      onClick={() => removeMutation.mutate(sub.id)}
                    >
                      <Trash />
                    </Button>
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Flex align="center" justify="between" mb="2">
        <Heading size="3">Quote versions</Heading>
      </Flex>
      <Text size="2" color="gray" mb="3">
        Upload subcontractor offer PDFs and totals here. Pretty offers reference
        a specific quote version when building pricing basises.
      </Text>

      {quotesLoading ? (
        <Text size="2" color="gray" mb="5">
          Loading quote versions…
        </Text>
      ) : subcontractors.length === 0 ? null : (
        <Flex direction="column" gap="3" mb="5">
          {subcontractors.map((sub) => {
            const quotes = quotesBySubcontractor.get(sub.id) ?? []
            return (
              <Box
                key={sub.id}
                p="3"
                style={{ border: '1px solid var(--gray-a5)', borderRadius: 8 }}
              >
                <Flex
                  justify="between"
                  align="center"
                  mb="2"
                  wrap="wrap"
                  gap="2"
                >
                  <Text size="2" weight="medium">
                    {sub.customer.name}
                  </Text>
                  {!isReadOnly && companyId && (
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => setQuoteDialogSub(sub)}
                    >
                      <Plus width={14} height={14} />
                      Add quote version
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
                            <Text size="1" color="gray">
                              {quote.note || '—'}
                            </Text>
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
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Box>
            )
          })}
        </Flex>
      )}

      <Heading size="3" mb="2">
        Subrental equipment
      </Heading>
      <Text size="2" color="gray" mb="3">
        Assign subrental catalog lines from equipment bookings to a
        subcontractor on this job.
      </Text>

      {bookingsLoading ? (
        <Text size="2" color="gray">
          Loading subrental equipment…
        </Text>
      ) : subrentalBookings.length === 0 ? (
        <Text size="2" color="gray">
          No subrental equipment booked on this job yet.
        </Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Period</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Subcontractor</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {subrentalBookings.map((row) => (
              <Table.Row key={row.id}>
                <Table.Cell>
                  <Text weight="medium">{row.item_name}</Text>
                </Table.Cell>
                <Table.Cell>{row.quantity}</Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {row.period_title ?? 'Equipment period'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="soft" size="1">
                    {row.external_status ?? 'planned'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {isReadOnly ? (
                    <Text size="2">
                      {row.subcontractor_name ?? 'Unassigned'}
                    </Text>
                  ) : (
                    <Select.Root
                      value={row.subcontractor_id ?? '__none__'}
                      onValueChange={(v) =>
                        assignMutation.mutate({
                          reservedItemId: row.id,
                          subcontractorId: v === '__none__' ? null : v,
                        })
                      }
                      disabled={
                        jobPartnerIds.length === 0 || assignMutation.isPending
                      }
                    >
                      <Select.Trigger
                        placeholder={
                          jobPartnerIds.length === 0
                            ? 'Add subcontractor first'
                            : 'Assign…'
                        }
                      />
                      <Select.Content style={{ zIndex: 10000 }}>
                        <Select.Item value="__none__">Unassigned</Select.Item>
                        {subcontractors.map((sub) => (
                          <Select.Item
                            key={sub.customer_id}
                            value={sub.customer_id}
                          >
                            {sub.customer.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
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

      {companyId && quoteDialogSub && (
        <AddQuoteDialog
          open={!!quoteDialogSub}
          onOpenChange={(open) => {
            if (!open) setQuoteDialogSub(null)
          }}
          jobId={jobId}
          companyId={companyId}
          subcontractor={quoteDialogSub}
        />
      )}
    </Box>
  )
}
