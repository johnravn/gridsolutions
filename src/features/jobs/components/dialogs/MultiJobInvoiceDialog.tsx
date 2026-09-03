// src/features/jobs/components/dialogs/MultiJobInvoiceDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Spinner,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { CheckCircle, GoogleDocs } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { contaClient } from '@shared/api/conta/client'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { DialogCloseIconButton } from '@shared/ui/components/DialogCloseIconButton'
import { companyDetailQuery } from '@features/company/api/queries'
import { preventDialogCloseOnSearchableSelect } from '@shared/ui/components/SearchableSelect'
import {
  createContaInvoiceFromBookings,
  invoiceLinesHaveValidQuantities,
  markJobsInvoiced,
} from '../../api/createContaInvoice'
import { jobDetailQuery } from '../../api/queries'
import { jobsBookingsForInvoiceQuery } from '../../api/invoiceQueries'
import InvoicePreview from '../invoice/InvoicePreview'
import InvoiceDescriptionTemplateEditor, {
  trackManualDescriptionEdit,
} from '../invoice/InvoiceDescriptionTemplateEditor'
import { invoiceLineNet, roundMoney } from '../../utils/invoiceMoney'
import type { InvoiceRecipient } from '../../api/createContaInvoice'
import type {
  BookingInvoiceLine,
  BookingsForInvoice,
} from '../../api/invoiceQueries'
import type { JobListRow } from '../../types'

function withZeroVat(b: BookingsForInvoice): BookingsForInvoice {
  return {
    ...b,
    equipment: b.equipment.map((l) => ({ ...l, vatPercent: 0 })),
    crew: b.crew.map((l) => ({ ...l, vatPercent: 0 })),
    transport: b.transport.map((l) => ({ ...l, vatPercent: 0 })),
    all: b.all.map((l) => ({ ...l, vatPercent: 0 })),
    totalVat: 0,
    totalWithVat: b.totalExVat,
  }
}

function lineExVatAfterDiscount(
  line: BookingInvoiceLine,
  lineDiscountOverrides: Record<string, number>,
): number {
  const d = lineDiscountOverrides[line.id] ?? 0
  return invoiceLineNet(line, d)
}

function buildSendPayload(
  previewBookings: BookingsForInvoice,
  editedLines: Array<BookingInvoiceLine>,
  lineDiscountOverrides: Record<string, number>,
  vatIncluded: boolean,
): BookingsForInvoice {
  const lines = editedLines.length > 0 ? editedLines : previewBookings.all
  let totalExVat = 0
  let totalVat = 0
  for (const line of lines) {
    const ex = lineExVatAfterDiscount(line, lineDiscountOverrides)
    totalExVat += ex
    if (vatIncluded) totalVat += (ex * line.vatPercent) / 100
  }
  return {
    ...previewBookings,
    equipment: lines.filter((l) => l.type === 'equipment'),
    crew: lines.filter((l) => l.type === 'crew'),
    transport: lines.filter((l) => l.type === 'transport'),
    all: lines,
    totalExVat,
    totalVat,
    totalWithVat: totalExVat + totalVat,
  }
}

function isValidNorwegianOrgNumber(orgNo: string) {
  if (!/^\d{9}$/.test(orgNo)) return false
  const weights = [3, 2, 7, 6, 5, 4, 3, 2]
  const digits = orgNo.split('').map((d) => Number(d))
  const sum = weights.reduce(
    (acc, weight, idx) => acc + weight * digits[idx],
    0,
  )
  const remainder = sum % 11
  const checkDigit = remainder === 0 ? 0 : 11 - remainder
  if (checkDigit === 11) return false
  return checkDigit === digits[8]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedJobIds: Array<string>
  memberJobs: Array<JobListRow>
}

export default function MultiJobInvoiceDialog({
  open,
  onOpenChange,
  selectedJobIds,
  memberJobs,
}: Props) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()
  const [invoiceWithVat, setInvoiceWithVat] = React.useState(true)
  const [message, setMessage] = React.useState('')
  const [ourRef, setOurRef] = React.useState('')
  const [theirRef, setTheirRef] = React.useState('')
  const [lineDiscountOverrides, setLineDiscountOverrides] = React.useState<
    Record<string, number>
  >({})
  const [editedLines, setEditedLines] = React.useState<
    Array<BookingInvoiceLine>
  >([])
  const [manualDescriptionOverrides, setManualDescriptionOverrides] =
    React.useState<Set<string>>(new Set())
  const [highlightedLineIds, setHighlightedLineIds] = React.useState<
    ReadonlySet<string>
  >(new Set())
  const [sendPhase, setSendPhase] = React.useState<
    'idle' | 'sending' | 'success'
  >('idle')
  const sendInFlightRef = React.useRef(false)

  const sortedSelected = React.useMemo(() => {
    const meta = new Map(memberJobs.map((j) => [j.id, j]))
    return [...selectedJobIds].sort((a, b) => {
      const sa = meta.get(a)?.start_at ?? ''
      const sb = meta.get(b)?.start_at ?? ''
      return sa.localeCompare(sb)
    })
  }, [selectedJobIds, memberJobs])

  const primaryJobId = sortedSelected[0] ?? ''
  const selectedMembers = React.useMemo(
    () => memberJobs.filter((j) => selectedJobIds.includes(j.id)),
    [memberJobs, selectedJobIds],
  )
  const bookingsInitKey = sortedSelected.join(',')
  const bookingsInitRef = React.useRef<string | null>(null)

  const { data: primaryJob } = useQuery({
    ...jobDetailQuery({ jobId: primaryJobId }),
    enabled: open && !!primaryJobId,
  })

  const { data: bookings, isLoading: loadingBookings } = useQuery({
    ...jobsBookingsForInvoiceQuery({
      jobIds: sortedSelected,
      companyId: companyId ?? '',
    }),
    enabled: open && !!companyId && sortedSelected.length > 0,
  })

  const { data: companyDetail } = useQuery({
    ...companyDetailQuery({ companyId: companyId ?? '' }),
    enabled: open && !!companyId,
  })

  const { data: accountingConfig } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_expansions')
        .select(
          'accounting_organization_id, accounting_software, default_invoice_days_until_due',
        )
        .eq('company_id', companyId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const { data: companyEmployees = [] } = useQuery({
    queryKey: ['company', companyId, 'employees-for-invoice'],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name')
        .eq('company_id', companyId!)
        .in('role', ['employee', 'owner', 'super_user'])
      if (error) throw error
      return data as Array<{ user_id: string; display_name: string | null }>
    },
  })

  const { data: customerContacts = [] } = useQuery({
    queryKey: ['customer', primaryJob?.customer_id, 'contacts'],
    enabled: open && !!primaryJob?.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('customer_id', primaryJob!.customer_id!)
      if (error) throw error
      return data as Array<{ id: string; name: string }>
    },
  })

  React.useEffect(() => {
    if (!open) {
      bookingsInitRef.current = null
      return
    }
    if (!bookings?.all.length) return
    const key = `${bookingsInitKey}:${bookings.all.length}`
    if (bookingsInitRef.current === key) return
    bookingsInitRef.current = key

    setEditedLines(bookings.all)
    const labels = selectedMembers
      .map((j) => `${j.title}${j.jobnr != null ? ` (#${j.jobnr})` : ''}`)
      .join(', ')
    setMessage(`Jobs: ${labels}`)
    setOurRef('')
    setTheirRef('')
    setLineDiscountOverrides(bookings.equipmentDiscountOverrides ?? {})
    setManualDescriptionOverrides(new Set())
  }, [open, bookings, bookingsInitKey, selectedMembers])

  const job = primaryJob
  const canSendInvoice =
    job?.customer != null && job.customer.conta_customer_id != null

  const getDaysUntilDue = (): number => {
    const positive = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
    return (
      positive(job?.customer?.conta_days_until_payment_reminder) ??
      positive(accountingConfig?.default_invoice_days_until_due) ??
      14
    )
  }

  const resolveInvoiceRecipients = async (): Promise<{
    recipients: Array<InvoiceRecipient>
    requiresManualSend: boolean
    reason?: string
  }> => {
    const customer = job?.customer
    const vatNumber = (customer?.vat_number?.trim() || '').replace(/\D/g, '')
    if (!vatNumber || !isValidNorwegianOrgNumber(vatNumber)) {
      return {
        recipients: [{ type: 'DO_NOT_DELIVER' }],
        requiresManualSend: true,
        reason: 'Customer cannot receive EHF.',
      }
    }
    try {
      const recipientInfo = (await contaClient.get(
        `/invoice/conta-ehf/recipients/${vatNumber}`,
      )) as { canReceiveInvoices?: boolean }
      if (!recipientInfo.canReceiveInvoices) {
        return {
          recipients: [{ type: 'DO_NOT_DELIVER' }],
          requiresManualSend: true,
          reason: 'Customer cannot receive invoices via EHF.',
        }
      }
      return {
        recipients: [{ type: 'EHF', ehfRecipient: vatNumber }],
        requiresManualSend: false,
      }
    } catch {
      return {
        recipients: [{ type: 'DO_NOT_DELIVER' }],
        requiresManualSend: true,
        reason: 'Could not verify EHF.',
      }
    }
  }

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!job || !bookings || !accountingConfig?.accounting_organization_id) {
        throw new Error('Missing configuration')
      }
      const contaCustomerId = job.customer!.conta_customer_id!
      const payload = buildSendPayload(
        bookings,
        editedLines,
        lineDiscountOverrides,
        invoiceWithVat,
      )
      const recipients = await resolveInvoiceRecipients()
      const orgRef = ourRef.trim() || undefined
      const their = theirRef.trim() || job.customer_contact?.name?.trim()

      return createContaInvoiceFromBookings({
        primaryJobId,
        linkedJobIds: sortedSelected,
        jobTitle: job.title,
        jobnr: job.jobnr,
        contaCustomerId,
        bookingsData: payload,
        organizationId: accountingConfig.accounting_organization_id,
        invoiceRecipients: recipients.recipients,
        invoiceMessage: message,
        orgReference: orgRef,
        customerReference: their,
        ehfOrderReference: job.jobnr ? String(job.jobnr) : primaryJobId,
        lineDiscountOverrides,
        invoiceWithVat,
        createdByUserId: authUser?.id ?? null,
        daysUntilDue: getDaysUntilDue(),
        linkedJobMeta: selectedMembers.map((j) => ({
          id: j.id,
          title: j.title,
          jobnr: j.jobnr,
        })),
      })
    },
    onSuccess: async () => {
      setSendPhase('success')
      success('Invoice sent', 'Multi-job invoice created in Conta.')
      await markJobsInvoiced(sortedSelected)
      for (const id of sortedSelected) {
        qc.invalidateQueries({ queryKey: ['jobs-detail', id] })
        qc.invalidateQueries({ queryKey: ['jobs', id, 'invoices'] })
      }
      if (companyId) {
        qc.invalidateQueries({ queryKey: ['company', companyId, 'jobs-index'] })
        qc.invalidateQueries({
          queryKey: ['recurring-jobs-invoices'],
        })
        qc.invalidateQueries({
          queryKey: ['recurring-jobs-invoices-overview'],
        })
      }
      window.setTimeout(() => {
        onOpenChange(false)
        setSendPhase('idle')
        sendInFlightRef.current = false
      }, 1500)
    },
    onError: (err: Error) => {
      setSendPhase('idle')
      sendInFlightRef.current = false
      toastError('Failed to create invoice', err.message)
    },
  })

  const handleSend = () => {
    if (!canSendInvoice) {
      info(
        'Customer not linked',
        'Link the customer to Conta before sending invoices.',
      )
      return
    }
    if (!bookings?.all.length) {
      info('No lines', 'There are no billable lines to invoice.')
      return
    }
    const linesToSend = editedLines.length > 0 ? editedLines : bookings.all
    if (!invoiceLinesHaveValidQuantities(linesToSend)) {
      info(
        'Quantity required',
        'Enter a quantity for every line before sending.',
      )
      return
    }
    if (sendInFlightRef.current) return
    sendInFlightRef.current = true
    setSendPhase('sending')
    sendMutation.mutate()
  }

  const displayBookings =
    bookings && !invoiceWithVat ? withZeroVat(bookings) : bookings

  const handleLineChange = (
    lineId: string,
    updates: {
      description?: string
      unitPrice?: number
      quantity?: number
    },
  ) => {
    if (updates.description !== undefined) {
      setManualDescriptionOverrides((prev) =>
        trackManualDescriptionEdit(prev, lineId),
      )
    }
    setEditedLines((prev) => {
      const base = prev.length > 0 ? prev : (bookings?.all ?? [])
      const idx = base.findIndex((l) => l.id === lineId)
      if (idx < 0) return prev
      const line = { ...base[idx] }
      if (updates.description !== undefined)
        line.description = updates.description
      if (updates.unitPrice !== undefined) line.unitPrice = updates.unitPrice
      if (updates.quantity !== undefined) line.quantity = updates.quantity
      if (updates.unitPrice !== undefined || updates.quantity !== undefined) {
        line.totalPrice = roundMoney(line.unitPrice * line.quantity)
      }
      const next = [...base]
      next[idx] = line
      return next
    })
  }

  const isSending = sendPhase !== 'idle' || sendMutation.isPending

  if (!open) return null

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && isSending) return
        onOpenChange(next)
      }}
    >
      <Dialog.Content
        size="4"
        style={{ maxWidth: 800 }}
        onPointerDownOutside={(e) => {
          if (isSending) e.preventDefault()
          else preventDialogCloseOnSearchableSelect(e)
        }}
      >
        <Box style={{ position: 'relative' }}>
          {isSending && (
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                zIndex: 10,
                borderRadius: 8,
                background:
                  'color-mix(in srgb, var(--color-panel-solid) 92%, transparent)',
              }}
            >
              {sendPhase === 'success' ? (
                <>
                  <CheckCircle width={40} height={40} color="var(--green-9)" />
                  <Text size="3" weight="medium" color="green">
                    Invoice sent successfully
                  </Text>
                </>
              ) : (
                <>
                  <Spinner size="3" />
                  <Text size="3" weight="medium">
                    Sending invoice…
                  </Text>
                </>
              )}
            </Box>
          )}

          <Flex justify="between" align="start" gap="3">
            <Box style={{ minWidth: 0 }}>
              <Dialog.Title>
                Invoice preview ({selectedJobIds.length} jobs)
              </Dialog.Title>
              <Dialog.Description size="2" color="gray" mb="3">
                One Conta invoice covering {selectedJobIds.length} member job
                {selectedJobIds.length !== 1 ? 's' : ''}. Bookings basis only.
              </Dialog.Description>
            </Box>
            <DialogCloseIconButton disabled={isSending} />
          </Flex>

          {loadingBookings && <Text>Loading bookings…</Text>}

          {job && displayBookings && companyId && (
            <>
              <InvoiceDescriptionTemplateEditor
                companyId={companyId}
                lines={
                  editedLines.length > 0 ? editedLines : displayBookings.all
                }
                manualOverrides={manualDescriptionOverrides}
                onApply={(updated) => setEditedLines(updated)}
                onHighlightChange={setHighlightedLineIds}
              />
              <InvoicePreview
                basis="bookings"
                bookings={displayBookings}
                customerName={job.customer?.name || 'Unknown'}
                customerAddress={job.customer?.address ?? null}
                companyName={companyDetail?.name ?? '—'}
                companyAddress={companyDetail?.address ?? null}
                job={job}
                employees={companyEmployees}
                contacts={customerContacts}
                vatIncluded={invoiceWithVat}
                onVatIncludedChange={setInvoiceWithVat}
                message={message}
                onMessageChange={setMessage}
                ourRef={ourRef}
                onOurRefChange={setOurRef}
                theirRef={theirRef}
                onTheirRefChange={setTheirRef}
                daysUntilDue={getDaysUntilDue()}
                lineDiscountOverrides={lineDiscountOverrides}
                onLineDiscountChange={(lineId, pct) =>
                  setLineDiscountOverrides((prev) => ({
                    ...prev,
                    [lineId]: pct,
                  }))
                }
                editedLines={editedLines}
                onLineChange={handleLineChange}
                onAddLine={() => {
                  setEditedLines((prev) => [
                    ...prev,
                    {
                      id: `custom-${crypto.randomUUID()}`,
                      type: 'equipment',
                      description: 'New line',
                      quantity: 1,
                      unitPrice: 0,
                      totalPrice: 0,
                      vatPercent: 25,
                      timePeriodId: '',
                      timePeriodTitle: null,
                      startAt: '',
                      endAt: '',
                    },
                  ])
                }}
                onRemoveLine={(lineId) =>
                  setEditedLines((prev) => prev.filter((l) => l.id !== lineId))
                }
                onReorderLines={setEditedLines}
                highlightedLineIds={highlightedLineIds}
              />
            </>
          )}

          <Flex gap="3" mt="4" justify="end">
            <Tooltip
              content={
                !canSendInvoice
                  ? 'Customer must be linked to Conta.'
                  : !bookings?.all.length
                    ? 'No billable lines'
                    : undefined
              }
            >
              <span>
                <Button
                  onClick={() => void handleSend()}
                  disabled={
                    isSending ||
                    !canSendInvoice ||
                    !bookings?.all.length ||
                    loadingBookings
                  }
                >
                  {isSending ? (
                    <>
                      <Spinner size="1" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <GoogleDocs width={16} height={16} />
                      Send invoice
                    </>
                  )}
                </Button>
              </span>
            </Tooltip>
            <Dialog.Close>
              <Button variant="soft" disabled={isSending}>
                Close
              </Button>
            </Dialog.Close>
          </Flex>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
