// src/features/jobs/components/tabs/InvoiceTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { CheckCircle, Eye, GoogleDocs, XmarkCircle } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  contaClient,
  getEffectiveContaApiEnvironment,
} from '@shared/api/conta/client'
import {
  addLocalCalendarDays,
  formatLocalYmd,
  makeWordPresentable,
} from '@shared/lib/generalFunctions'
import { companyDetailQuery } from '@features/company/api/queries'
import { preventDialogCloseOnSearchableSelect } from '@shared/ui/components/SearchableSelect'
import InvoicePreview from '../invoice/InvoicePreview'
import InvoiceHistory from '../invoice/InvoiceHistory'
import { jobBookingsForInvoiceQuery } from '../../api/invoiceQueries'
import { ensureContaProjectId } from '../../utils/contaProjects'
import { acceptedOfferInvoiceLineDescription } from '../../utils/offerNumber'
import type {
  BookingInvoiceLine,
  BookingsForInvoice,
} from '../../api/invoiceQueries'
import type { JobDetail, JobOffer } from '../../types'

type InvoiceRecipient = { type: string; ehfRecipient?: string }
type InvoiceRecipientResult = {
  recipients: Array<InvoiceRecipient>
  requiresManualSend: boolean
  reason?: string
}
/** Return a copy of bookings with 0% VAT (for display when VAT is toggled off without refetching). */
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

/** Build a one-line BookingsForInvoice from an accepted offer for the unified preview. */
function offerToBookingsForInvoice(offer: JobOffer): BookingsForInvoice {
  const line: BookingInvoiceLine = {
    id: offer.id,
    type: 'equipment',
    description: acceptedOfferInvoiceLineDescription(offer),
    quantity: 1,
    unitPrice: offer.total_after_discount,
    totalPrice: offer.total_after_discount,
    vatPercent: offer.vat_percent,
    timePeriodId: '',
    timePeriodTitle: null,
    startAt: '',
    endAt: '',
  }
  const totalExVat = line.totalPrice
  const totalVat = (totalExVat * offer.vat_percent) / 100
  return {
    equipment: [line],
    crew: [],
    transport: [],
    all: [line],
    totalExVat,
    totalVat,
    totalWithVat: offer.total_with_vat,
  }
}

/** Ex-VAT amount for one line after line discount (matches InvoicePreview). */
function lineExVatAfterDiscount(
  line: BookingInvoiceLine,
  lineDiscountOverrides: Record<string, number>,
): number {
  const d = lineDiscountOverrides[line.id] ?? 0
  return line.unitPrice * line.quantity * (1 - d / 100)
}

/**
 * Snapshot of lines + totals from the invoice preview state. Conta payload is
 * built from this so sent values match the preview tab.
 */
function buildBookingsForInvoiceSendPayload(
  previewBookings: BookingsForInvoice,
  editedLines: Array<BookingInvoiceLine>,
  lineDiscountOverrides: Record<string, number>,
  vatIncluded: boolean,
): BookingsForInvoice {
  const lines = editedLines.length > 0 ? editedLines : previewBookings.all
  const equipment = lines.filter((l) => l.type === 'equipment')
  const crew = lines.filter((l) => l.type === 'crew')
  const transport = lines.filter((l) => l.type === 'transport')

  let totalExVat = 0
  for (const line of lines) {
    totalExVat += lineExVatAfterDiscount(line, lineDiscountOverrides)
  }
  let totalVat = 0
  if (vatIncluded) {
    for (const line of lines) {
      const ex = lineExVatAfterDiscount(line, lineDiscountOverrides)
      totalVat += (ex * line.vatPercent) / 100
    }
  }
  const totalWithVat = totalExVat + totalVat

  return {
    ...previewBookings,
    equipment,
    crew,
    transport,
    all: lines,
    totalExVat,
    totalVat,
    totalWithVat,
  }
}

type PendingInvoiceAction = {
  bookingsData: BookingsForInvoice
  invoiceMessage: string
  orgReferenceOverride?: string
  theirRefOverride?: string
  lineDiscountOverrides: Record<string, number>
  invoiceWithVat?: boolean
  /** When set, job_invoices row links to the accepted offer (same as legacy offer flow). */
  offerId?: string | null
}

export default function InvoiceTab({
  jobId,
  job,
}: {
  jobId: string
  job: JobDetail
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()
  const [previewOffer, setPreviewOffer] = React.useState<JobOffer | null>(null)
  const [previewBookings, setPreviewBookings] =
    React.useState<BookingsForInvoice | null>(null)
  /** When set, the preview was opened from "From accepted offer"; send uses offer mutation. */
  const [previewSourceOffer, setPreviewSourceOffer] =
    React.useState<JobOffer | null>(null)
  const [manualSendDialogOpen, setManualSendDialogOpen] = React.useState(false)
  const [manualSendReason, setManualSendReason] = React.useState('')
  const [pendingInvoiceAction, setPendingInvoiceAction] =
    React.useState<PendingInvoiceAction | null>(null)
  const [pendingInvoiceRecipients, setPendingInvoiceRecipients] =
    React.useState<Array<InvoiceRecipient> | null>(null)
  const [invoiceWithVat, setInvoiceWithVat] = React.useState(true)

  // Get current user ID for tracking
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const { data: effectiveContaEnv } = useQuery({
    queryKey: ['conta-effective-api-environment', companyId],
    queryFn: async () => {
      try {
        return await getEffectiveContaApiEnvironment()
      } catch {
        return 'production' as const
      }
    },
    enabled: !!companyId,
    staleTime: 30_000,
  })
  const isSandboxConta = effectiveContaEnv === 'sandbox'

  // Fetch accepted offers for this job
  const { data: acceptedOffers = [], isLoading: isLoadingOffers } = useQuery({
    queryKey: ['jobs', jobId, 'invoice', 'accepted-offers'],
    queryFn: async (): Promise<Array<JobOffer>> => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false })

      if (error) throw error
      return data as Array<JobOffer>
    },
  })

  // Fetch bookings for invoice (only when bookings basis is selected)
  // Use a stable query key (always 25%) so toggling VAT doesn't refetch and cause dialog to glitch
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    ...jobBookingsForInvoiceQuery({
      jobId,
      companyId: companyId ?? '',
      defaultVatPercent: 25,
    }),
    enabled: !!companyId,
  })

  // EHF status for bookings preview (checked when preview opens)
  const [ehfStatus, setEhfStatus] = React.useState<{
    canReceive: boolean
    reason?: string
  } | null>(null)

  // Invoice preview editable fields (for bookings)
  const [invoicePreviewMessage, setInvoicePreviewMessage] = React.useState('')
  const [invoicePreviewOurRef, setInvoicePreviewOurRef] = React.useState('')
  const [invoicePreviewTheirRef, setInvoicePreviewTheirRef] = React.useState('')
  const [lineDiscountOverrides, setLineDiscountOverrides] = React.useState<
    Record<string, number>
  >({})
  const [editedInvoiceLines, setEditedInvoiceLines] = React.useState<
    Array<BookingsForInvoice['all'][0]>
  >([])
  const invoicePreviewPortalRef = React.useRef<HTMLElement | null>(null)

  // Company detail for invoice preview (sender info)
  const { data: companyDetail } = useQuery({
    ...companyDetailQuery({ companyId: companyId ?? '' }),
    enabled: !!companyId && (!!previewOffer || !!previewBookings),
  })

  // Company employees for "our ref" dropdown
  const { data: companyEmployees = [] } = useQuery({
    queryKey: ['company', companyId, 'employees-for-invoice'],
    enabled: !!companyId && !!previewBookings,
    queryFn: async () => {
      if (!companyId) return []
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name')
        .eq('company_id', companyId)
        .in('role', ['employee', 'owner', 'super_user'])
        .order('display_name', { ascending: true })
      if (error) throw error
      return (Array.isArray(data) ? data : []) as Array<{
        user_id: string
        display_name: string | null
      }>
    },
  })

  // Customer contacts for "their ref" dropdown
  const { data: customerContacts = [] } = useQuery({
    queryKey: ['customer', job.customer_id, 'contacts'],
    enabled: !!job.customer_id && !!previewBookings,
    queryFn: async () => {
      if (!job.customer_id) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('customer_id', job.customer_id)
        .order('name', { ascending: true })
      if (error) throw error
      return (Array.isArray(data) ? data : []) as Array<{
        id: string
        name: string
      }>
    },
  })

  // Sync preview from query only when in bookings mode (not from offer)
  React.useEffect(() => {
    if (
      !previewSourceOffer &&
      previewBookings &&
      bookings &&
      bookings.all.length > 0
    ) {
      setPreviewBookings(bookings)
    }
  }, [bookings, previewSourceOffer])

  // Get accounting config and invoice defaults from company_expansions
  const { data: accountingConfig } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select(
          'accounting_organization_id, accounting_software, default_invoice_days_until_due',
        )
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      return data as {
        accounting_organization_id: string | null
        accounting_software: string | null
        default_invoice_days_until_due: number | null
      } | null
    },
    enabled: !!companyId,
  })

  const getDaysUntilDue = (): number => {
    const positiveDays = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null
    return (
      positiveDays(job.customer?.conta_days_until_payment_reminder) ??
      positiveDays(accountingConfig?.default_invoice_days_until_due) ??
      14
    )
  }

  const canSendInvoice =
    job.customer != null && job.customer.conta_customer_id != null

  const resolveInvoiceRecipients = async (
    customer: JobDetail['customer'],
  ): Promise<InvoiceRecipientResult> => {
    const rawVatNumber = customer?.vat_number?.trim() || ''
    const vatNumber = rawVatNumber.replace(/\D/g, '')
    if (!vatNumber) {
      return {
        recipients: [{ type: 'DO_NOT_DELIVER' }],
        requiresManualSend: true,
        reason:
          'Customer organization number is missing, so EHF cannot be used.',
      }
    }
    if (!isValidNorwegianOrgNumber(vatNumber)) {
      return {
        recipients: [{ type: 'DO_NOT_DELIVER' }],
        requiresManualSend: true,
        reason:
          'Customer organization number is invalid, so EHF cannot be used.',
      }
    }
    try {
      const recipientInfo = (await contaClient.get(
        `/invoice/conta-ehf/recipients/${vatNumber}`,
      )) as { canReceiveInvoices?: boolean; inputValid?: boolean }
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
    } catch (error) {
      return {
        recipients: [{ type: 'DO_NOT_DELIVER' }],
        requiresManualSend: true,
        reason: 'Could not verify if the customer can receive EHF.',
      }
    }
  }

  const isValidNorwegianOrgNumber = (orgNo: string) => {
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

  const getEhfOrderReference = () => {
    if (job.jobnr) return String(job.jobnr)
    return String(jobId)
  }

  const getDefaultPersonalMessage = (details: {
    type: 'offer' | 'bookings'
    offerTitle?: string
    bookingsCount?: number
  }) => {
    const jobLabel = `${job.title}${job.jobnr ? ` (#${job.jobnr})` : ''}`
    if (details.type === 'offer') {
      return `Job: ${jobLabel}\n`
    }
    const lineCount = details.bookingsCount ?? 0
    return `Job: ${jobLabel}\nInvoice based on bookings (${lineCount} line${lineCount !== 1 ? 's' : ''})`
  }

  const getProjectLeadReference = () =>
    job.project_lead?.display_name || job.project_lead?.email || undefined

  const getCustomerContactReference = () =>
    job.customer_contact?.name || undefined

  const getJobReferenceLabel = () => {
    if (job.jobnr) return `Job #${String(job.jobnr).padStart(6, '0')}`
    return `Job #${jobId}`
  }

  const getOrgReference = () => {
    const parts = [getJobReferenceLabel()]
    const projectLead = getProjectLeadReference()
    if (projectLead) parts.push(projectLead)
    return parts.join(' · ')
  }

  const downloadContaInvoicePdf = async (
    organizationId: string,
    invoiceResponse: any,
  ) => {
    const invoiceFileId =
      invoiceResponse?.invoiceFileId || invoiceResponse?.attachmentFileId
    if (!invoiceFileId) {
      toastError(
        'PDF Not Available',
        'Conta did not return a file reference for this invoice.',
      )
      return
    }
    try {
      const fileInfo = (await contaClient.get(
        `/invoice/organizations/${organizationId}/files/${invoiceFileId}`,
      )) as { fileUrl?: string }
      if (!fileInfo.fileUrl) {
        toastError(
          'PDF Not Available',
          'Conta did not return a download link for this invoice.',
        )
        return
      }
      window.open(fileInfo.fileUrl, '_blank', 'noopener')
    } catch (error: any) {
      toastError(
        'PDF Download Failed',
        error?.message || 'Failed to download invoice PDF from Conta.',
      )
    }
  }

  const ensureContaBankAccount = async (organizationId: string) => {
    try {
      const accounts = (await contaClient.get(
        `/invoice/organizations/${organizationId}/bank-accounts`,
      )) as Array<{ id?: number }>
      if (!Array.isArray(accounts) || accounts.length === 0) {
        info(
          'Missing Bank Account',
          'Conta requires a bank account on the organization before invoices can be created.',
        )
        return false
      }
      return true
    } catch (error: any) {
      toastError(
        'Bank Account Check Failed',
        error?.message || 'Could not verify Conta bank account.',
      )
      return false
    }
  }

  const getContaCustomerId = (): number => {
    const id = job.customer?.conta_customer_id
    if (id == null) {
      throw new Error(
        'Customer must be linked to Conta before sending invoices. Sync the customer with Conta in the customer settings, or use the Conta check dialog to link or create the customer in Conta.',
      )
    }
    return id
  }

  // Helper to map VAT percent to Conta VAT code
  const getVatCode = (vatPercent: number): string => {
    // Map VAT percentages to Conta VAT codes
    if (vatPercent === 0) return 'no.vat'
    if (vatPercent >= 20) return 'high' // 25% in Norway
    if (vatPercent >= 10) return 'medium' // 15% in Norway
    if (vatPercent > 0) return 'low' // 10% in Norway
    return 'high' // Default to high
  }

  // Create invoice mutation for bookings basis (also used for "from accepted offer" preview lines)
  const createInvoiceFromBookingsMutation = useMutation({
    mutationFn: async ({
      bookingsData,
      organizationId,
      invoiceRecipients,
      downloadPdfAfterCreate: _downloadPdfAfterCreate,
      invoiceMessage,
      orgReferenceOverride,
      theirRefOverride,
      lineDiscountOverrides: lineDiscountOverridesParam = {},
      invoiceWithVat: includeVat = true,
      offerId = null,
    }: {
      bookingsData: BookingsForInvoice
      organizationId: string
      invoiceRecipients: Array<InvoiceRecipient>
      downloadPdfAfterCreate?: boolean
      invoiceMessage?: string
      orgReferenceOverride?: string
      theirRefOverride?: string
      lineDiscountOverrides?: Record<string, number>
      invoiceWithVat?: boolean
      offerId?: string | null
    }) => {
      const contaCustomerId = getContaCustomerId()

      const contaProjectId = await ensureContaProjectId(organizationId, {
        jobTitle: job.title,
        jobnr: job.jobnr,
        jobId,
        customerId: contaCustomerId,
      })
      if (contaProjectId == null) {
        throw new Error(
          'Could not resolve a Conta project for this job (no id returned). Check Conta and try again.',
        )
      }

      if (bookingsData.all.length === 0) {
        throw new Error('No bookings available to invoice')
      }

      // Per-line VAT matches the preview table; "Invoice with VAT: No" forces no-vat codes.
      const invoiceLines = bookingsData.all.map((line, index) => ({
        description: line.description,
        quantity: line.quantity,
        price: line.unitPrice, // Price ex VAT per unit
        discount: lineDiscountOverridesParam[line.id] ?? 0,
        vatCode: getVatCode(includeVat ? line.vatPercent : 0),
        lineNo: index + 1,
      }))

      const daysUntilDue = getDaysUntilDue()
      const invoiceDateLocal = new Date()
      const invoiceDueDateLocal = addLocalCalendarDays(
        invoiceDateLocal,
        daysUntilDue,
      )
      const shouldSendEhf =
        invoiceRecipients[0] && invoiceRecipients[0].type === 'EHF'
      const orgRef = orgReferenceOverride?.trim()
        ? orgReferenceOverride.trim()
        : getOrgReference()
      const invoiceData = {
        customerId: contaCustomerId,
        invoiceDate: formatLocalYmd(invoiceDateLocal),
        invoiceDueDate: formatLocalYmd(invoiceDueDateLocal),
        invoiceCurrency: 'NOK',
        projectId: contaProjectId,
        ...(shouldSendEhf ? { invoiceRecipients } : {}),
        ...(shouldSendEhf ? { ehfOrderReference: getEhfOrderReference() } : {}),
        ...(orgRef ? { orgReference: orgRef } : {}),
        ...((theirRefOverride?.trim() ?? getCustomerContactReference())
          ? {
              customerReference:
                theirRefOverride?.trim() || getCustomerContactReference() || '',
            }
          : {}),
        personalMessage:
          invoiceMessage?.trim() ||
          (offerId
            ? getDefaultPersonalMessage({ type: 'offer' })
            : getDefaultPersonalMessage({
                type: 'bookings',
                bookingsCount: bookingsData.all.length,
              })),
        invoiceLines,
      }

      // Create invoice record in database first (pending status)
      const { data: invoiceRecord, error: recordError } = await supabase
        .from('job_invoices')
        .insert({
          job_id: jobId,
          offer_id: offerId ?? null,
          organization_id: organizationId,
          conta_customer_id: contaCustomerId,
          invoice_basis: offerId ? 'offer' : 'bookings',
          invoice_data: invoiceData as any,
          status: 'pending',
          created_by_user_id: authUser?.id ?? null,
        })
        .select()
        .single()

      if (recordError) {
        console.error('Failed to create invoice record:', recordError)
      }

      let response: any
      let errorMessage: string | null = null

      try {
        const logPayload =
          import.meta.env.DEV ||
          import.meta.env.VITE_LOG_CONTA_INVOICE_PAYLOAD === 'true'
        if (logPayload) {
          console.info(
            '[Conta invoice create] POST',
            `/invoice/organizations/${organizationId}/invoices`,
            '\nBody (JSON):\n',
            JSON.stringify(invoiceData, null, 2),
          )
        }
        response = await contaClient.post(
          `/invoice/organizations/${organizationId}/invoices`,
          invoiceData,
        )

        // Update invoice record with success
        if (invoiceRecord) {
          await supabase
            .from('job_invoices')
            .update({
              status: 'created',
              conta_invoice_id:
                response?.invoiceNo?.toString() ||
                response?.id?.toString() ||
                response?.invoiceId?.toString() ||
                null,
              conta_response: response,
            })
            .eq('id', invoiceRecord.id)
        }
      } catch (error: any) {
        errorMessage = error?.message || 'Unknown error'

        // Update invoice record with failure
        if (invoiceRecord) {
          await supabase
            .from('job_invoices')
            .update({
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', invoiceRecord.id)
        }

        throw error
      }

      return { response, invoiceRecord }
    },
    onSuccess: async (data, variables) => {
      success(
        'Invoice created and sent through Conta.',
        isSandboxConta ? 'Sandbox Conta' : undefined,
      )

      // Update job status to 'invoiced' if not already
      if (job.status !== 'invoiced' && job.status !== 'paid') {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ status: 'invoiced' })
          .eq('id', jobId)

        if (!updateError) {
          // Update the detail cache immediately (JobInspector renders from this)
          qc.setQueryData<JobDetail | null>(['jobs-detail', jobId], (old) =>
            old ? { ...old, status: 'invoiced' } : old,
          )
          // Ensure we refetch from server too
          qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
          // Refresh list views that may show "ready to invoice" or status badges
          if (companyId) {
            qc.invalidateQueries({
              queryKey: ['company', companyId, 'jobs-index'],
            })
            qc.invalidateQueries({
              queryKey: ['company', companyId, 'jobs-index-page'],
            })
          }
        }
      }

      // Refresh bookings and invoice history
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoice', 'bookings'],
      })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoices'],
      })
      if (variables.offerId) {
        qc.invalidateQueries({
          queryKey: ['jobs', jobId, 'invoice', 'accepted-offers'],
        })
      }

      if (variables.downloadPdfAfterCreate) {
        await downloadContaInvoicePdf(variables.organizationId, data.response)
      }
    },
    onError: (err: any) => {
      toastError(
        'Failed to Create Invoice',
        err?.message ||
          'An error occurred while creating the invoice. Please try again.',
      )
    },
  })

  const openManualSendDialog = (
    action: PendingInvoiceAction,
    recipients: Array<InvoiceRecipient>,
    reason?: string,
  ) => {
    setPendingInvoiceAction(action)
    setPendingInvoiceRecipients(recipients)
    setManualSendReason(reason || 'Customer cannot receive EHF.')
    setManualSendDialogOpen(true)
  }

  const confirmManualSend = () => {
    if (!pendingInvoiceAction || !pendingInvoiceRecipients) {
      setManualSendDialogOpen(false)
      return
    }
    if (!accountingConfig?.accounting_organization_id) {
      setManualSendDialogOpen(false)
      return
    }
    const organizationId = accountingConfig.accounting_organization_id
    const a = pendingInvoiceAction
    createInvoiceFromBookingsMutation.mutate({
      bookingsData: a.bookingsData,
      organizationId,
      invoiceRecipients: pendingInvoiceRecipients,
      downloadPdfAfterCreate: true,
      invoiceMessage: a.invoiceMessage,
      orgReferenceOverride: a.orgReferenceOverride,
      theirRefOverride:
        a.theirRefOverride ?? job.customer_contact?.name?.trim(),
      lineDiscountOverrides: a.lineDiscountOverrides,
      invoiceWithVat: a.invoiceWithVat ?? true,
      offerId: a.offerId ?? null,
    })
    setPreviewBookings(null)
    setPreviewOffer(null)
    setPreviewSourceOffer(null)
    setEhfStatus(null)
    setManualSendDialogOpen(false)
    setPendingInvoiceAction(null)
    setPendingInvoiceRecipients(null)
    setManualSendReason('')
  }

  /** Open the unified invoice preview from the accepted offer (one line = offer total). */
  const handleCreateInvoiceFromOffer = async () => {
    const offer = acceptedOffers[0]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guard for type safety when button is enabled
    if (!offer) return
    if (!accountingConfig?.accounting_organization_id) {
      info(
        'Accounting Integration Required',
        'Please configure your accounting software organization ID in Company settings before creating invoices.',
      )
      return
    }

    if (accountingConfig.accounting_software !== 'conta') {
      info(
        'Accounting Software Not Supported',
        'Currently only Conta accounting software is supported for invoice creation.',
      )
      return
    }

    if (!canSendInvoice) {
      info(
        'Customer Not Linked to Conta',
        'The customer must be linked to Conta with Conta customer data before sending invoices. Sync or link the customer in customer settings, or use the Conta check dialog.',
      )
      return
    }

    const recipientResult = await resolveInvoiceRecipients(job.customer)
    setEhfStatus({
      canReceive: !recipientResult.requiresManualSend,
      reason: recipientResult.reason,
    })
    const oneLineBookings = offerToBookingsForInvoice(offer)
    setPreviewSourceOffer(offer)
    setPreviewOffer(null)
    setPreviewBookings(oneLineBookings)
    const jobLabel = `${job.title}${job.jobnr ? ` (#${String(job.jobnr).padStart(6, '0')})` : ''}`
    setInvoicePreviewMessage(`Job: ${jobLabel}`)
    setInvoicePreviewOurRef(
      job.project_lead?.display_name || job.project_lead?.email || '',
    )
    setInvoicePreviewTheirRef(job.customer_contact?.name?.trim() || '')
    setLineDiscountOverrides({})
    setEditedInvoiceLines(oneLineBookings.all)
    setInvoiceWithVat(true)
  }

  const handleCreateInvoiceFromBookings = async () => {
    if (!bookings || bookings.all.length === 0) {
      info('No Bookings', 'There are no bookings available to invoice.')
      return
    }

    if (!accountingConfig?.accounting_organization_id) {
      info(
        'Accounting Integration Required',
        'Please configure your accounting software organization ID in Company settings before creating invoices.',
      )
      return
    }

    if (accountingConfig.accounting_software !== 'conta') {
      info(
        'Accounting Software Not Supported',
        'Currently only Conta accounting software is supported for invoice creation.',
      )
      return
    }

    if (!canSendInvoice) {
      info(
        'Customer Not Linked to Conta',
        'The customer must be linked to Conta with Conta customer data before sending invoices. Sync or link the customer in customer settings, or use the Conta check dialog.',
      )
      return
    }

    // Check EHF status before opening preview
    const recipientResult = await resolveInvoiceRecipients(job.customer)
    setEhfStatus({
      canReceive: !recipientResult.requiresManualSend,
      reason: recipientResult.reason,
    })
    setPreviewSourceOffer(null)
    setPreviewBookings(bookings)
    // Default message: job name, start/end date, job number
    const jobLabel = `${job.title}${job.jobnr ? ` (#${job.jobnr})` : ''}`
    const startFmt = job.start_at
      ? new Date(job.start_at).toLocaleDateString('nb-NO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : ''
    const endFmt = job.end_at
      ? new Date(job.end_at).toLocaleDateString('nb-NO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : ''
    const datesPart = startFmt && endFmt ? `, ${startFmt} - ${endFmt}` : ''
    setInvoicePreviewMessage(`Job: ${jobLabel}${datesPart}`)
    setInvoicePreviewOurRef(
      job.project_lead?.display_name || job.project_lead?.email || '',
    )
    setInvoicePreviewTheirRef(job.customer_contact?.name?.trim() || '')
    setLineDiscountOverrides({})
    setEditedInvoiceLines(bookings.all)
    setInvoiceWithVat(true)
  }

  const handleAddInvoiceLine = () => {
    const newLine: BookingInvoiceLine = {
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
    }
    setEditedInvoiceLines((prev) => [...prev, newLine])
  }

  const handleRemoveInvoiceLine = (lineId: string) => {
    setEditedInvoiceLines((prev) => prev.filter((l) => l.id !== lineId))
  }

  const handleLineChange = (
    lineId: string,
    updates: {
      description?: string
      unitPrice?: number
      quantity?: number
    },
  ) => {
    setEditedInvoiceLines((prev) => {
      const base = prev.length > 0 ? prev : (previewBookings?.all ?? [])
      const idx = base.findIndex((l) => l.id === lineId)
      if (idx < 0) return prev
      const line = { ...base[idx] }
      if (updates.description !== undefined)
        line.description = updates.description
      if (updates.unitPrice !== undefined) line.unitPrice = updates.unitPrice
      if (updates.quantity !== undefined) line.quantity = updates.quantity
      if (updates.unitPrice !== undefined || updates.quantity !== undefined) {
        line.totalPrice = line.unitPrice * line.quantity
      }
      const next = [...base]
      next[idx] = line
      return next
    })
  }

  const createInvoiceFromBookingsWithMessage = async (
    sourceBookings: BookingsForInvoice,
    editedLines: Array<BookingInvoiceLine>,
    lineDiscountOverridesParam: Record<string, number>,
    message: string,
    orgReferenceOverride?: string,
    theirRefOverride?: string,
    invoiceWithVatParam: boolean = true,
    offerId: string | null = null,
  ): Promise<{ sent: true } | { sent: false } | undefined> => {
    if (!accountingConfig?.accounting_organization_id) return undefined
    const hasBankAccount = await ensureContaBankAccount(
      accountingConfig.accounting_organization_id,
    )
    if (!hasBankAccount) return undefined

    const bookingsData = buildBookingsForInvoiceSendPayload(
      sourceBookings,
      editedLines,
      lineDiscountOverridesParam,
      invoiceWithVatParam,
    )

    const recipientResult = await resolveInvoiceRecipients(job.customer)
    if (recipientResult.requiresManualSend) {
      openManualSendDialog(
        {
          bookingsData,
          invoiceMessage: message,
          orgReferenceOverride,
          theirRefOverride,
          lineDiscountOverrides: lineDiscountOverridesParam,
          invoiceWithVat: invoiceWithVatParam,
          offerId,
        },
        recipientResult.recipients,
        recipientResult.reason,
      )
      return { sent: false as const }
    }

    createInvoiceFromBookingsMutation.mutate({
      bookingsData,
      organizationId: accountingConfig.accounting_organization_id,
      invoiceRecipients: recipientResult.recipients,
      invoiceMessage: message,
      orgReferenceOverride,
      theirRefOverride,
      lineDiscountOverrides: lineDiscountOverridesParam,
      invoiceWithVat: invoiceWithVatParam,
      offerId,
    })
    return { sent: true as const }
  }

  // Display version of preview bookings: when VAT is off, show zero-VAT totals without refetching
  const displayBookings = React.useMemo(() => {
    if (!previewBookings) return null
    if (invoiceWithVat) return previewBookings
    return withZeroVat(previewBookings)
  }, [previewBookings, invoiceWithVat])

  // Check if job has been invoiced (status is 'invoiced' or 'paid')
  const isInvoiced = job.status === 'invoiced' || job.status === 'paid'
  const isCompleted = job.status === 'completed'

  const hasAcceptedOffers = acceptedOffers.length > 0

  const isLoading = isLoadingOffers || isLoadingBookings

  if (isLoading) {
    return (
      <Box style={{ overflowX: 'hidden', maxWidth: '100%' }}>
        <Heading size="3" mb="3">
          Invoice
        </Heading>
        <Text>Loading invoice data...</Text>
      </Box>
    )
  }

  return (
    <Box style={{ overflowX: 'hidden', maxWidth: '100%' }}>
      <Flex justify="between" align="center" mb="4">
        <Heading size="3">Invoice</Heading>
      </Flex>

      {/* Job Invoice Status */}
      <Card mb="4">
        <Flex justify="between" align="center" mb="3">
          <Box>
            <Heading size="4" mb="1">
              Job Invoice Status
            </Heading>
            <Text size="2" color="gray">
              Current status: {makeWordPresentable(job.status)}
            </Text>
          </Box>
          <Box>
            {isInvoiced ? (
              <Flex align="center" gap="2">
                <CheckCircle width={24} height={24} color="var(--green-9)" />
                <Text size="3" weight="medium" color="green">
                  {job.status === 'paid' ? 'Paid' : 'Invoiced'}
                </Text>
              </Flex>
            ) : (
              <Flex align="center" gap="2">
                <XmarkCircle width={24} height={24} color="var(--orange-9)" />
                <Text size="3" weight="medium" color="orange">
                  Not Invoiced
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
        {!isInvoiced && isCompleted && (
          <Box
            p="3"
            style={{
              background: 'var(--orange-a2)',
              borderRadius: 8,
              border: '1px solid var(--orange-a6)',
            }}
          >
            <Text size="2" color="gray">
              This job is completed and ready to be invoiced.
            </Text>
          </Box>
        )}
      </Card>

      {/* Create invoice: unified flow (offer or bookings) */}
      {!isInvoiced && (
        <Card mb="4">
          <Heading size="4" mb="2">
            Create invoice
          </Heading>
          <Text size="2" color="gray" mb="3">
            Choose to invoice from the accepted offer (one line with the offer
            total) or from bookings on the job (one line per booking).
          </Text>
          <Flex gap="3" wrap="wrap">
            <Tooltip
              content={
                !hasAcceptedOffers
                  ? 'No accepted offers. Accept an offer first.'
                  : !canSendInvoice
                    ? 'Customer must be linked to Conta before sending invoices.'
                    : undefined
              }
            >
              <span style={{ display: 'inline-block' }}>
                <Button
                  size="3"
                  variant="soft"
                  onClick={handleCreateInvoiceFromOffer}
                  disabled={
                    !hasAcceptedOffers ||
                    !canSendInvoice ||
                    createInvoiceFromBookingsMutation.isPending
                  }
                >
                  <Eye width={16} height={16} />
                  From accepted offer
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              content={
                !bookings?.all.length
                  ? 'No bookings on this job. Add equipment, crew or transport first.'
                  : !canSendInvoice
                    ? 'Customer must be linked to Conta before sending invoices.'
                    : undefined
              }
            >
              <span style={{ display: 'inline-block' }}>
                <Button
                  size="3"
                  variant="soft"
                  onClick={() => handleCreateInvoiceFromBookings()}
                  disabled={
                    !bookings?.all.length ||
                    !canSendInvoice ||
                    createInvoiceFromBookingsMutation.isPending
                  }
                >
                  <Eye width={16} height={16} />
                  From bookings
                </Button>
              </span>
            </Tooltip>
          </Flex>
        </Card>
      )}

      {/* Invoice History */}
      <InvoiceHistory jobId={jobId} />

      {/* Test Mode Indicator */}
      {isSandboxConta && (
        <Card
          mt="4"
          style={{
            background: 'var(--yellow-a2)',
            border: '1px solid var(--yellow-a6)',
          }}
        >
          <Flex gap="2" align="center">
            <Text size="2" weight="bold" color="yellow">
              Sandbox Conta
            </Text>
            <Text size="2" color="gray">
              Invoices are sent to the Conta sandbox (same environment as the
              Conta API client). They do not appear in your production
              accounting system.
            </Text>
          </Flex>
        </Card>
      )}

      {/* Invoice Preview Dialog */}
      <Dialog.Root
        open={!!previewOffer || !!previewBookings}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewOffer(null)
            setPreviewBookings(null)
            setPreviewSourceOffer(null)
            setEhfStatus(null)
          }
        }}
      >
        <Dialog.Content
          size="4"
          style={{ maxWidth: '800px' }}
          onPointerDownOutside={preventDialogCloseOnSearchableSelect}
          onInteractOutside={preventDialogCloseOnSearchableSelect}
        >
          <Box
            ref={(el) => {
              invoicePreviewPortalRef.current = el
            }}
            style={{ position: 'relative' }}
          >
            <Dialog.Title>Invoice Preview</Dialog.Title>
            <Dialog.Description size="2" color="gray" mb="4">
              Review the invoice details before creating it in your accounting
              software.
            </Dialog.Description>

            {previewOffer && (
              <InvoicePreview
                basis="offer"
                offer={previewOffer}
                customerName={job.customer?.name || 'Unknown Customer'}
                daysUntilDue={getDaysUntilDue()}
              />
            )}

            {previewBookings && displayBookings && (
              <>
                {ehfStatus !== null && (
                  <Box
                    mb="4"
                    p="3"
                    style={{
                      borderRadius: 8,
                      background: ehfStatus.canReceive
                        ? 'var(--green-a2)'
                        : 'var(--orange-a2)',
                      border: `1px solid ${ehfStatus.canReceive ? 'var(--green-a6)' : 'var(--orange-a6)'}`,
                    }}
                  >
                    <Text
                      size="2"
                      weight="medium"
                      color={ehfStatus.canReceive ? 'green' : 'orange'}
                    >
                      {ehfStatus.canReceive
                        ? '✓ Customer can receive EHF invoices'
                        : 'EHF not available'}
                    </Text>
                    {ehfStatus.reason && (
                      <Text size="2" color="gray" as="p" mt="1">
                        {ehfStatus.reason}
                      </Text>
                    )}
                    {!ehfStatus.canReceive ? (
                      <Text size="2" color="gray" as="p" mt="2">
                        When you click Send invoice, you will be asked to
                        confirm creating the invoice in Conta and downloading
                        the PDF so you can send it to the customer yourself.
                      </Text>
                    ) : null}
                  </Box>
                )}
                <InvoicePreview
                  basis="bookings"
                  bookings={displayBookings}
                  customerName={job.customer?.name || 'Unknown Customer'}
                  customerAddress={job.customer?.address ?? null}
                  companyName={companyDetail?.name ?? '—'}
                  companyAddress={companyDetail?.address ?? null}
                  job={job}
                  employees={companyEmployees}
                  contacts={customerContacts}
                  vatIncluded={invoiceWithVat}
                  onVatIncludedChange={setInvoiceWithVat}
                  message={invoicePreviewMessage}
                  onMessageChange={setInvoicePreviewMessage}
                  ourRef={invoicePreviewOurRef}
                  onOurRefChange={setInvoicePreviewOurRef}
                  theirRef={invoicePreviewTheirRef}
                  onTheirRefChange={setInvoicePreviewTheirRef}
                  daysUntilDue={getDaysUntilDue()}
                  lineDiscountOverrides={lineDiscountOverrides}
                  onLineDiscountChange={(lineId, pct) =>
                    setLineDiscountOverrides((prev) => ({
                      ...prev,
                      [lineId]: pct,
                    }))
                  }
                  editedLines={editedInvoiceLines}
                  onLineChange={handleLineChange}
                  onAddLine={handleAddInvoiceLine}
                  onRemoveLine={handleRemoveInvoiceLine}
                  refFieldPortalContainer={() =>
                    invoicePreviewPortalRef.current
                  }
                />
              </>
            )}

            <Flex gap="3" mt="4" justify="end">
              {previewBookings && (
                <Tooltip
                  content={
                    !canSendInvoice
                      ? 'Customer must be linked to Conta before sending invoices.'
                      : undefined
                  }
                >
                  <span style={{ display: 'inline-block' }}>
                    <Button
                      onClick={async () => {
                        const result =
                          await createInvoiceFromBookingsWithMessage(
                            previewBookings,
                            editedInvoiceLines,
                            lineDiscountOverrides,
                            invoicePreviewMessage,
                            invoicePreviewOurRef || undefined,
                            invoicePreviewTheirRef || undefined,
                            invoiceWithVat,
                            previewSourceOffer?.id ?? null,
                          )
                        if (result?.sent === true) {
                          setPreviewBookings(null)
                          setPreviewOffer(null)
                          setPreviewSourceOffer(null)
                          setEhfStatus(null)
                        }
                      }}
                      disabled={
                        createInvoiceFromBookingsMutation.isPending ||
                        !canSendInvoice
                      }
                    >
                      <GoogleDocs width={16} height={16} />
                      Send Invoice
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
            </Flex>
          </Box>
        </Dialog.Content>
      </Dialog.Root>

      {/* After preview in DOM so this layers above the preview when both are open */}
      <Dialog.Root
        open={manualSendDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setManualSendDialogOpen(false)
            setPendingInvoiceAction(null)
            setPendingInvoiceRecipients(null)
            setManualSendReason('')
          }
        }}
      >
        <Dialog.Content size="3" style={{ maxWidth: '520px' }}>
          <Dialog.Title>Customer cannot receive EHF</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="2">
            This customer is not set up to receive invoices through the
            Norwegian electronic invoicing network (EHF). Conta cannot deliver
            the invoice to them automatically.
          </Dialog.Description>
          {manualSendReason ? (
            <Box
              mb="3"
              p="2"
              style={{
                borderRadius: 6,
                background: 'var(--gray-a3)',
              }}
            >
              <Text size="2" color="gray">
                {manualSendReason}
              </Text>
            </Box>
          ) : null}
          <Text size="2" weight="medium" mb="4" as="p">
            Do you want to create the invoice in Conta anyway and download the
            PDF so you can send it to the customer yourself (email, post, etc.)?
          </Text>
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button onClick={confirmManualSend}>
              Download PDF and send myself
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
