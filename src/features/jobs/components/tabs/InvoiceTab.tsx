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
  Separator,
  Table,
  Text,
  TextArea,
  Tooltip,
} from '@radix-ui/themes'
import {
  CheckCircle,
  Edit,
  Eye,
  GoogleDocs,
  Plus,
  XmarkCircle,
} from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import { contaClient } from '@shared/api/conta/client'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { companyDetailQuery } from '@features/company/api/queries'
import InvoicePreview from '../invoice/InvoicePreview'
import InvoiceHistory from '../invoice/InvoiceHistory'
import { jobBookingsForInvoiceQuery } from '../../api/invoiceQueries'
import { ensureContaProjectId } from '../../utils/contaProjects'
import type {
  BookingInvoiceLine,
  BookingsForInvoice,
} from '../../api/invoiceQueries'
import type { InvoiceBasis, JobDetail, JobOffer } from '../../types'

type InvoiceRecipient = { type: string; ehfRecipient?: string }
type InvoiceRecipientResult = {
  recipients: Array<InvoiceRecipient>
  requiresManualSend: boolean
  reason?: string
}
type PendingInvoiceAction =
  | { kind: 'offer'; offer: JobOffer; invoiceMessage: string }
  | {
      kind: 'bookings'
      bookings: BookingsForInvoice
      invoiceMessage: string
      orgReferenceOverride?: string
      theirRefOverride?: string
      lineDiscountOverrides?: Record<string, number>
    }
  | { kind: 'all-offers'; invoiceMessage: string }

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
  const [invoiceBasis, setInvoiceBasis] = React.useState<InvoiceBasis | null>(
    job.invoice_basis ?? null,
  )
  const [basisSelectionDirty, setBasisSelectionDirty] =
    React.useState<boolean>(false)
  const [previewOffer, setPreviewOffer] = React.useState<JobOffer | null>(null)
  const [previewBookings, setPreviewBookings] =
    React.useState<BookingsForInvoice | null>(null)
  const [manualSendDialogOpen, setManualSendDialogOpen] = React.useState(false)
  const [manualSendReason, setManualSendReason] = React.useState('')
  const [pendingInvoiceAction, setPendingInvoiceAction] =
    React.useState<PendingInvoiceAction | null>(null)
  const [pendingInvoiceRecipients, setPendingInvoiceRecipients] =
    React.useState<Array<InvoiceRecipient> | null>(null)
  const [invoiceMessageDialogOpen, setInvoiceMessageDialogOpen] =
    React.useState(false)
  const [invoiceMessageDraft, setInvoiceMessageDraft] = React.useState('')
  const [invoiceMessageAction, setInvoiceMessageAction] =
    React.useState<PendingInvoiceAction | null>(null)
  const [invoiceWithVat, setInvoiceWithVat] = React.useState(true)

  // Get current user ID for tracking
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  // Check if we're in test/sandbox mode
  const isTestMode = React.useMemo(() => {
    const apiUrl =
      import.meta.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
    return apiUrl.includes('sandbox') || apiUrl.includes('test')
  }, [])

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
  const {
    data: bookings,
    isLoading: isLoadingBookings,
    refetch: refetchBookings,
  } = useQuery({
    ...jobBookingsForInvoiceQuery({
      jobId,
      companyId: companyId ?? '',
      defaultVatPercent: invoiceWithVat ? 25 : 0,
    }),
    enabled: invoiceBasis === 'bookings' && !!companyId,
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
      return (Array.isArray(data) ? data : []) as Array<{ id: string; name: string }>
    },
  })

  React.useEffect(() => {
    setBasisSelectionDirty(false)
    setInvoiceBasis(job.invoice_basis ?? null)
  }, [jobId])

  // Sync preview bookings when VAT toggle changes (query refetches with new defaultVatPercent)
  React.useEffect(() => {
    if (previewBookings && bookings && bookings.all.length > 0) {
      setPreviewBookings(bookings)
    }
  }, [bookings])

  React.useEffect(() => {
    if (basisSelectionDirty) return
    setInvoiceBasis(job.invoice_basis ?? null)
  }, [job.invoice_basis, basisSelectionDirty])

  const saveInvoiceBasisMutation = useMutation({
    mutationFn: async (basis: InvoiceBasis) => {
      const { error } = await supabase
        .from('jobs')
        .update({ invoice_basis: basis } as any)
        .eq('id', jobId)
      if (error) throw error
      return basis
    },
    onSuccess: (basis) => {
      setInvoiceBasis(basis)
      setBasisSelectionDirty(false)
      qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
    },
    onError: (err: any) => {
      setBasisSelectionDirty(true)
      toastError(
        'Failed to Save Invoice Basis',
        err?.message ||
          'An error occurred while saving your selection. Please try again.',
      )
    },
  })

  const handleChooseInvoiceBasis = (basis: InvoiceBasis) => {
    setBasisSelectionDirty(true)
    saveInvoiceBasisMutation.mutate(basis)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

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

  const getDaysUntilDue = (): number =>
    job.customer?.conta_days_until_payment_reminder ??
    accountingConfig?.default_invoice_days_until_due ??
    14

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

  const openInvoiceMessageDialog = (action: PendingInvoiceAction) => {
    setInvoiceMessageAction(action)
    const defaultMessage =
      action.kind === 'offer'
        ? getDefaultPersonalMessage({
            type: 'offer',
            offerTitle: action.offer.title || `v${action.offer.version_number}`,
          })
        : action.kind === 'bookings'
          ? getDefaultPersonalMessage({
              type: 'bookings',
              bookingsCount: action.bookings.all.length,
            })
          : getDefaultPersonalMessage({ type: 'offer' })
    setInvoiceMessageDraft(defaultMessage)
    setInvoiceMessageDialogOpen(true)
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

  // Create invoice mutation for offer basis
  const createInvoiceFromOfferMutation = useMutation({
    mutationFn: async ({
      offer,
      organizationId,
      invoiceRecipients,
      downloadPdfAfterCreate: _downloadPdfAfterCreate,
      invoiceMessage,
    }: {
      offer: JobOffer
      organizationId: string
      invoiceRecipients: Array<InvoiceRecipient>
      downloadPdfAfterCreate?: boolean
      invoiceMessage?: string
    }) => {
      const contaCustomerId = getContaCustomerId()

      let contaProjectId: number | null = null
      try {
        contaProjectId = await ensureContaProjectId(organizationId, {
          jobTitle: job.title,
          jobnr: job.jobnr,
          jobId,
          customerId: contaCustomerId,
        })
      } catch (projectError) {
        console.warn('Failed to resolve Conta project for job', projectError)
      }

      // Create invoice with single line for the offer
      const daysUntilDue = getDaysUntilDue()
      const shouldSendEhf =
        invoiceRecipients[0] && invoiceRecipients[0].type === 'EHF'
      const invoiceData = {
        customerId: contaCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        invoiceDueDate: new Date(
          Date.now() + daysUntilDue * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .split('T')[0],
        invoiceCurrency: 'NOK',
        ...(contaProjectId ? { projectId: contaProjectId } : {}),
        ...(shouldSendEhf ? { invoiceRecipients } : {}),
        ...(shouldSendEhf ? { ehfOrderReference: getEhfOrderReference() } : {}),
        ...(getOrgReference() ? { orgReference: getOrgReference() } : {}),
        ...(getCustomerContactReference()
          ? { customerReference: getCustomerContactReference() }
          : {}),
        personalMessage:
          invoiceMessage?.trim() ||
          getDefaultPersonalMessage({
            type: 'offer',
            offerTitle: offer.title || `v${offer.version_number}`,
          }),
        invoiceLines: [
          {
            description: offer.title || `Invoice for Job ${job.jobnr || jobId}`,
            quantity: 1,
            price: offer.total_after_discount, // Price ex VAT
            discount: offer.discount_percent,
            vatCode: getVatCode(offer.vat_percent),
            lineNo: 1,
          },
        ],
      }

      // Create invoice record in database first (pending status)
      const { data: invoiceRecord, error: recordError } = await supabase
        .from('job_invoices')
        .insert({
          job_id: jobId,
          offer_id: offer.id,
          organization_id: organizationId,
          conta_customer_id: contaCustomerId,
          invoice_basis: 'offer',
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
      const invoiceId = data.response?.id || data.response?.invoiceId
      success(
        'Invoice Created',
        `Invoice has been successfully created${isTestMode ? ' (TEST MODE)' : ''}${invoiceId ? ` with ID: ${invoiceId}` : ''}.`,
      )

      // Update job status to 'invoiced' if not already
      if (job.status !== 'invoiced' && job.status !== 'paid') {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ status: 'invoiced' })
          .eq('id', jobId)

        if (!updateError) {
          // Invalidate job queries to refresh the status
          qc.invalidateQueries({ queryKey: ['jobs', jobId] })
        }
      }

      // Refresh accepted offers and invoice history
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoice', 'accepted-offers'],
      })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoices'],
      })

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

  // Create invoice mutation for bookings basis
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
    }: {
      bookingsData: BookingsForInvoice
      organizationId: string
      invoiceRecipients: Array<InvoiceRecipient>
      downloadPdfAfterCreate?: boolean
      invoiceMessage?: string
      orgReferenceOverride?: string
      theirRefOverride?: string
      lineDiscountOverrides?: Record<string, number>
    }) => {
      const contaCustomerId = getContaCustomerId()

      let contaProjectId: number | null = null
      try {
        contaProjectId = await ensureContaProjectId(organizationId, {
          jobTitle: job.title,
          jobnr: job.jobnr,
          jobId,
          customerId: contaCustomerId,
        })
      } catch (projectError) {
        console.warn('Failed to resolve Conta project for job', projectError)
      }

      if (bookingsData.all.length === 0) {
        throw new Error('No bookings available to invoice')
      }

      // Create invoice lines from bookings (one line per booking)
      const invoiceLines = bookingsData.all.map((line, index) => ({
        description: line.description,
        quantity: line.quantity,
        price: line.unitPrice, // Price ex VAT per unit
        discount: lineDiscountOverridesParam[line.id] ?? 0,
        vatCode: getVatCode(line.vatPercent),
        lineNo: index + 1,
      }))

      const daysUntilDue = getDaysUntilDue()
      const shouldSendEhf =
        invoiceRecipients[0] && invoiceRecipients[0].type === 'EHF'
      const orgRef = orgReferenceOverride?.trim()
        ? orgReferenceOverride.trim()
        : getOrgReference()
      const invoiceData = {
        customerId: contaCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        invoiceDueDate: new Date(
          Date.now() + daysUntilDue * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .split('T')[0],
        invoiceCurrency: 'NOK',
        ...(contaProjectId ? { projectId: contaProjectId } : {}),
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
          getDefaultPersonalMessage({
            type: 'bookings',
            bookingsCount: bookingsData.all.length,
          }),
        invoiceLines,
      }

      // Create invoice record in database first (pending status)
      const { data: invoiceRecord, error: recordError } = await supabase
        .from('job_invoices')
        .insert({
          job_id: jobId,
          organization_id: organizationId,
          conta_customer_id: contaCustomerId,
          invoice_basis: 'bookings',
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
      const invoiceId = data.response?.id || data.response?.invoiceId
      success(
        'Invoice Created',
        `Invoice has been successfully created${isTestMode ? ' (TEST MODE)' : ''}${invoiceId ? ` with ID: ${invoiceId}` : ''}.`,
      )

      // Update job status to 'invoiced' if not already
      if (job.status !== 'invoiced' && job.status !== 'paid') {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ status: 'invoiced' })
          .eq('id', jobId)

        if (!updateError) {
          // Invalidate job queries to refresh the status
          qc.invalidateQueries({ queryKey: ['jobs', jobId] })
        }
      }

      // Refresh bookings and invoice history
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoice', 'bookings'],
      })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoices'],
      })

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
    if (pendingInvoiceAction.kind === 'offer') {
      createInvoiceFromOfferMutation.mutate({
        offer: pendingInvoiceAction.offer,
        organizationId,
        invoiceRecipients: pendingInvoiceRecipients,
        downloadPdfAfterCreate: true,
        invoiceMessage: pendingInvoiceAction.invoiceMessage,
      })
    } else if (pendingInvoiceAction.kind === 'bookings') {
      createInvoiceFromBookingsMutation.mutate({
        bookingsData: pendingInvoiceAction.bookings,
        organizationId,
        invoiceRecipients: pendingInvoiceRecipients,
        downloadPdfAfterCreate: true,
        invoiceMessage: pendingInvoiceAction.invoiceMessage,
        orgReferenceOverride: pendingInvoiceAction.orgReferenceOverride,
        theirRefOverride:
          pendingInvoiceAction.theirRefOverride ??
          job.customer_contact?.name?.trim(),
        lineDiscountOverrides: pendingInvoiceAction.lineDiscountOverrides,
      })
    }
    setManualSendDialogOpen(false)
    setPendingInvoiceAction(null)
    setPendingInvoiceRecipients(null)
    setManualSendReason('')
  }

  const handleCreateInvoiceFromOffer = (
    offerId: string,
    showPreview = false,
  ) => {
    const offer = acceptedOffers.find((o) => o.id === offerId)
    if (!offer) {
      toastError('Error', 'Offer not found')
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

    if (showPreview) {
      setPreviewOffer(offer)
      return
    }
    openInvoiceMessageDialog({
      kind: 'offer',
      offer,
      invoiceMessage: '',
    })
  }

  const createInvoiceFromOfferWithMessage = async (
    offer: JobOffer,
    message: string,
  ) => {
    if (!accountingConfig?.accounting_organization_id) return
    const hasBankAccount = await ensureContaBankAccount(
      accountingConfig.accounting_organization_id,
    )
    if (!hasBankAccount) return

    const recipientResult = await resolveInvoiceRecipients(job.customer)
    if (recipientResult.requiresManualSend) {
      openManualSendDialog(
        { kind: 'offer', offer, invoiceMessage: message },
        recipientResult.recipients,
        recipientResult.reason,
      )
      return
    }

    createInvoiceFromOfferMutation.mutate({
      offer,
      organizationId: accountingConfig.accounting_organization_id,
      invoiceRecipients: recipientResult.recipients,
      invoiceMessage: message,
    })
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
    const datesPart =
      startFmt && endFmt ? `, ${startFmt} - ${endFmt}` : ''
    setInvoicePreviewMessage(`Job: ${jobLabel}${datesPart}`)
    setInvoicePreviewOurRef(
      job.project_lead?.display_name || job.project_lead?.email || '',
    )
    setInvoicePreviewTheirRef(
      job.customer_contact?.name?.trim() || '',
    )
    setLineDiscountOverrides({})
    setEditedInvoiceLines(bookings.all)
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
      if (updates.description !== undefined) line.description = updates.description
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
    bookingsData: BookingsForInvoice,
    message: string,
    orgReferenceOverride?: string,
    theirRefOverride?: string,
    lineDiscountOverridesParam?: Record<string, number>,
  ) => {
    if (!accountingConfig?.accounting_organization_id) return
    const hasBankAccount = await ensureContaBankAccount(
      accountingConfig.accounting_organization_id,
    )
    if (!hasBankAccount) return

    const recipientResult = await resolveInvoiceRecipients(job.customer)
    if (recipientResult.requiresManualSend) {
      openManualSendDialog(
        {
          kind: 'bookings',
          bookings: bookingsData,
          invoiceMessage: message,
          orgReferenceOverride,
          theirRefOverride,
          lineDiscountOverrides: lineDiscountOverridesParam,
        },
        recipientResult.recipients,
        recipientResult.reason,
      )
      return
    }

    createInvoiceFromBookingsMutation.mutate({
      bookingsData,
      organizationId: accountingConfig.accounting_organization_id,
      invoiceRecipients: recipientResult.recipients,
      invoiceMessage: message,
      orgReferenceOverride,
      theirRefOverride,
      lineDiscountOverrides: lineDiscountOverridesParam,
    })
  }

  const handleCreateInvoiceForAllOffers = () => {
    if (offersNeedingInvoice.length === 0) {
      info('No Offers', 'There are no offers ready to invoice.')
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

    openInvoiceMessageDialog({
      kind: 'all-offers',
      invoiceMessage: '',
    })
  }

  const createInvoicesForAllOffersWithMessage = async (message: string) => {
    if (!accountingConfig?.accounting_organization_id) return
    try {
      const hasBankAccount = await ensureContaBankAccount(
        accountingConfig.accounting_organization_id,
      )
      if (!hasBankAccount) return

      const recipientResult = await resolveInvoiceRecipients(job.customer)
      if (recipientResult.requiresManualSend) {
        openManualSendDialog(
          {
            kind: 'offer',
            offer: offersNeedingInvoice[0],
            invoiceMessage: message,
          },
          recipientResult.recipients,
          recipientResult.reason,
        )
        return
      }
      for (const offer of offersNeedingInvoice) {
        await createInvoiceFromOfferMutation.mutateAsync({
          offer,
          organizationId: accountingConfig.accounting_organization_id,
          invoiceRecipients: recipientResult.recipients,
          invoiceMessage: message,
        })
      }
      success(
        'All Invoices Created',
        `Successfully created ${offersNeedingInvoice.length} invoice(s).`,
      )
    } catch (error: any) {
      toastError(
        'Error Creating Invoices',
        error?.message ||
          'An error occurred while creating some invoices. Please check and retry if needed.',
      )
    }
  }

  // Check if job has been invoiced (status is 'invoiced' or 'paid')
  const isInvoiced = job.status === 'invoiced' || job.status === 'paid'
  const isCompleted = job.status === 'completed'

  // Offers that need invoicing (accepted but not yet invoiced)
  // For now, we'll assume all accepted offers need invoicing
  // In the future, we might track invoice status per offer
  const offersNeedingInvoice = acceptedOffers
  const hasAcceptedOffers = acceptedOffers.length > 0

  const totalToInvoice = offersNeedingInvoice.reduce(
    (sum, offer) => sum + offer.total_with_vat,
    0,
  )

  const isLoading =
    isLoadingOffers || (invoiceBasis === 'bookings' && isLoadingBookings)

  if (isLoading) {
    return (
      <Box>
        <Heading size="3" mb="3">
          Invoice
        </Heading>
        <Text>Loading invoice data...</Text>
      </Box>
    )
  }

  if (!invoiceBasis) {
    return (
      <Box>
        <Flex justify="between" align="center" mb="4">
          <Heading size="3">Invoice</Heading>
        </Flex>
        <Card>
          <Flex direction="column" gap="4">
            <Box>
              <Heading size="4" mb="1">
                How do you want to create the invoice?
              </Heading>
              <Text size="2" color="gray">
                Choose whether to invoice from the accepted offer or from
                bookings on the job.
              </Text>
            </Box>
            <Flex gap="3" wrap="wrap">
              <Button
                size="3"
                variant="soft"
                onClick={() => handleChooseInvoiceBasis('offer')}
                disabled={saveInvoiceBasisMutation.isPending}
              >
                Accepted Offer
              </Button>
              <Button
                size="3"
                variant="soft"
                onClick={() => handleChooseInvoiceBasis('bookings')}
                disabled={saveInvoiceBasisMutation.isPending}
              >
                Bookings on Job
              </Button>
            </Flex>
            {!hasAcceptedOffers && (
              <Text size="2" color="gray">
                No accepted offers for this job yet. You can still choose offers
                and create the invoice once an offer is accepted.
              </Text>
            )}
          </Flex>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="3">Invoice</Heading>
        <Button
          size="1"
          variant="ghost"
          onClick={() => {
            setBasisSelectionDirty(true)
            setInvoiceBasis(null)
          }}
        >
          <Text size="2" color="gray">
            Invoicing based on{' '}
            {invoiceBasis === 'offer' ? 'offers' : 'bookings'}
          </Text>
          <Edit width={14} height={14} />
        </Button>
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

      {/* Invoice Basis: Accepted Offer */}
      {invoiceBasis === 'offer' && (
        <>
          {/* Accepted Offers Section */}
          {acceptedOffers.length > 0 ? (
            <Card mb="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="4">Accepted Offers</Heading>
                {offersNeedingInvoice.length > 0 && !isInvoiced && (
                  <Text size="2" color="gray">
                    {offersNeedingInvoice.length} offer
                    {offersNeedingInvoice.length !== 1 ? 's' : ''} ready to
                    invoice
                  </Text>
                )}
              </Flex>

              {offersNeedingInvoice.length > 0 ? (
                <>
                  <Box style={{ overflowX: 'auto' }}>
                    <Table.Root style={{ width: '100%', minWidth: 720 }}>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Offer</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Accepted
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell
                            style={{ textAlign: 'right' }}
                          >
                            Amount
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell
                            style={{ textAlign: 'center' }}
                          >
                            Invoice Status
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell
                            style={{ textAlign: 'right' }}
                          >
                            Actions
                          </Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {acceptedOffers.map((offer) => {
                          const needsInvoice = offersNeedingInvoice.some(
                            (o) => o.id === offer.id,
                          )
                          return (
                            <Table.Row key={offer.id}>
                              <Table.Cell>
                                <Text weight="medium">{offer.title}</Text>
                                <Text
                                  size="1"
                                  color="gray"
                                  style={{ display: 'block' }}
                                >
                                  {offer.offer_type === 'technical'
                                    ? 'Technical'
                                    : 'Pretty'}{' '}
                                  • v{offer.version_number}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Text size="2">
                                  {formatDate(offer.accepted_at)}
                                </Text>
                                {offer.accepted_by_name && (
                                  <Text
                                    size="1"
                                    color="gray"
                                    style={{ display: 'block' }}
                                  >
                                    by {offer.accepted_by_name}
                                  </Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <Text
                                  size="3"
                                  weight="medium"
                                  style={{ textAlign: 'right' }}
                                >
                                  {formatCurrency(offer.total_with_vat)}
                                </Text>
                              </Table.Cell>
                              <Table.Cell style={{ textAlign: 'center' }}>
                                {needsInvoice ? (
                                  <Text size="2" color="orange">
                                    Pending
                                  </Text>
                                ) : (
                                  <Flex align="center" justify="center" gap="1">
                                    <CheckCircle
                                      width={16}
                                      height={16}
                                      color="var(--green-9)"
                                    />
                                    <Text size="2" color="green">
                                      Invoiced
                                    </Text>
                                  </Flex>
                                )}
                              </Table.Cell>
                              <Table.Cell style={{ textAlign: 'right' }}>
                                {needsInvoice && (
                                  <Flex gap="2" justify="end">
                                    <Button
                                      size="2"
                                      variant="ghost"
                                      onClick={() =>
                                        handleCreateInvoiceFromOffer(
                                          offer.id,
                                          true,
                                        )
                                      }
                                      disabled={
                                        createInvoiceFromOfferMutation.isPending
                                      }
                                    >
                                      <Eye width={14} height={14} />
                                      Preview
                                    </Button>
                                    <Button
                                      size="2"
                                      variant="soft"
                                      onClick={() =>
                                        handleCreateInvoiceFromOffer(offer.id)
                                      }
                                      disabled={
                                        createInvoiceFromOfferMutation.isPending
                                      }
                                    >
                                      <GoogleDocs width={14} height={14} />
                                      Create Invoice
                                    </Button>
                                  </Flex>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          )
                        })}
                      </Table.Body>
                    </Table.Root>
                  </Box>

                  {offersNeedingInvoice.length > 0 && !isInvoiced && (
                    <>
                      <Separator my="4" />
                      <Flex justify="between" align="center">
                        <Box>
                          <Text size="2" color="gray" mb="1">
                            Total to Invoice
                          </Text>
                          <Heading size="5">
                            {formatCurrency(totalToInvoice)}
                          </Heading>
                        </Box>
                        <Button
                          size="3"
                          onClick={handleCreateInvoiceForAllOffers}
                          disabled={createInvoiceFromOfferMutation.isPending}
                        >
                          <Plus width={16} height={16} />
                          Create Invoice for All
                        </Button>
                      </Flex>
                    </>
                  )}
                </>
              ) : (
                <Box
                  p="4"
                  style={{
                    border: '2px dashed var(--green-a6)',
                    borderRadius: 8,
                    textAlign: 'center',
                  }}
                >
                  <CheckCircle width={32} height={32} color="var(--green-9)" />
                  <Text
                    size="3"
                    weight="medium"
                    mt="2"
                    style={{ display: 'block' }}
                  >
                    All offers have been invoiced
                  </Text>
                </Box>
              )}
            </Card>
          ) : (
            <Card>
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="3"
                style={{ minHeight: '200px', padding: '40px' }}
              >
                <Text size="4" color="gray" align="center">
                  No accepted offers yet
                </Text>
                <Text size="2" color="gray" align="center">
                  Once offers are accepted, they will appear here and can be
                  invoiced.
                </Text>
              </Flex>
            </Card>
          )}
        </>
      )}

      {/* Invoice Basis: Bookings on Job */}
      {invoiceBasis === 'bookings' && (
        <>
          {bookings && bookings.all.length > 0 ? (
            <Card mb="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="4">Bookings on Job</Heading>
                <Text size="2" color="gray">
                  {bookings.all.length} booking
                  {bookings.all.length !== 1 ? 's' : ''} ready to invoice
                </Text>
              </Flex>

              <Box style={{ overflowX: 'auto' }}>
                <Table.Root mb="4" style={{ width: '100%', minWidth: 720 }}>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Brand</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>
                        Description
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                        Quantity
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                        Unit Price
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                        Total (ex VAT)
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {bookings.all.map((line) => (
                      <Table.Row key={line.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium">
                            {makeWordPresentable(line.type)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text>{line.brandName || '—'}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text>{line.model || '—'}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text>{line.description}</Text>
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'right' }}>
                          <Text>
                            {line.type === 'crew' || line.type === 'transport'
                              ? line.unit === 'hour'
                                ? `${line.quantity} hour${line.quantity !== 1 ? 's' : ''}`
                                : `${line.quantity} day${line.quantity !== 1 ? 's' : ''}`
                              : line.quantity}
                          </Text>
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'right' }}>
                          <Text>{formatCurrency(line.unitPrice)}</Text>
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'right' }}>
                          <Text weight="medium">
                            {formatCurrency(line.totalPrice)}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>

              <Separator my="4" />

              <Flex justify="between" align="center" mb="3">
                <Box>
                  <Text size="2" color="gray" mb="1">
                    Subtotal (ex VAT)
                  </Text>
                  <Heading size="5">
                    {formatCurrency(bookings.totalExVat)}
                  </Heading>
                </Box>
                <Box style={{ textAlign: 'right' }}>
                  <Text size="2" color="gray" mb="1">
                    VAT (25%)
                  </Text>
                  <Heading size="5">
                    {formatCurrency(bookings.totalVat)}
                  </Heading>
                </Box>
                <Box style={{ textAlign: 'right' }}>
                  <Text size="2" color="gray" mb="1">
                    Total (incl. VAT)
                  </Text>
                  <Heading size="5">
                    {formatCurrency(bookings.totalWithVat)}
                  </Heading>
                </Box>
              </Flex>

              {/* Warning for bookings with zero prices */}
              {(bookings.equipment.some((b) => b.unitPrice === 0) ||
                bookings.crew.some((b) => b.unitPrice === 0) ||
                bookings.transport.some((b) => b.unitPrice === 0)) && (
                <Box
                  p="3"
                  mb="3"
                  style={{
                    background: 'var(--orange-a2)',
                    borderRadius: 8,
                    border: '1px solid var(--orange-a6)',
                  }}
                >
                  <Text size="2" color="orange" weight="medium">
                    Warning: Some bookings have zero prices. Please verify
                    prices before creating the invoice.
                  </Text>
                </Box>
              )}

              <Flex justify="end" gap="3">
                <Button
                  size="3"
                  variant="soft"
                  onClick={async () => {
                    const result = await refetchBookings()
                    if (result.data && result.data.all.length > 0) {
                      setPreviewBookings(result.data)
                      success('Updated', 'Bookings refreshed.')
                    }
                  }}
                >
                  Update with current bookings
                </Button>
                <Tooltip
                  content={
                    !canSendInvoice
                      ? 'Customer must be linked to Conta before sending invoices. Link the customer in customer settings.'
                      : undefined
                  }
                >
                  <span style={{ display: 'inline-block' }}>
                    <Button
                      size="3"
                      onClick={() => handleCreateInvoiceFromBookings()}
                      disabled={
                        createInvoiceFromBookingsMutation.isPending ||
                        !canSendInvoice
                      }
                    >
                      <Eye width={16} height={16} />
                      Verify & Send Invoice
                    </Button>
                  </span>
                </Tooltip>
              </Flex>
            </Card>
          ) : (
            <Card>
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="3"
                style={{ minHeight: '200px', padding: '40px' }}
              >
                <Text size="4" color="gray" align="center">
                  No bookings available
                </Text>
                <Text size="2" color="gray" align="center">
                  Book equipment, crew, or transport on this job to create an
                  invoice based on bookings.
                </Text>
              </Flex>
            </Card>
          )}
        </>
      )}

      {/* Invoice History */}
      <InvoiceHistory jobId={jobId} />

      {/* Test Mode Indicator */}
      {isTestMode && (
        <Card
          mt="4"
          style={{
            background: 'var(--yellow-a2)',
            border: '1px solid var(--yellow-a6)',
          }}
        >
          <Flex gap="2" align="center">
            <Text size="2" weight="bold" color="yellow">
              🧪 TEST MODE
            </Text>
            <Text size="2" color="gray">
              You are connected to the Conta sandbox environment. Invoices
              created here will not appear in your production accounting system.
            </Text>
          </Flex>
        </Card>
      )}

      {/* Manual send confirmation dialog */}
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
          <Dialog.Title>EHF Not Available</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            This customer cannot receive invoices via EHF.
          </Dialog.Description>
          {manualSendReason && (
            <Text size="2" color="gray">
              {manualSendReason}
            </Text>
          )}
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button onClick={confirmManualSend}>
              Download PDF and send myself
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Invoice message dialog */}
      <Dialog.Root
        open={invoiceMessageDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInvoiceMessageDialogOpen(false)
            setInvoiceMessageAction(null)
          }
        }}
      >
        <Dialog.Content size="3" style={{ maxWidth: '520px' }}>
          <Dialog.Title>Invoice Message</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            Add the personal message that will appear on the invoice.
          </Dialog.Description>
          <TextArea
            value={invoiceMessageDraft}
            onChange={(event) => setInvoiceMessageDraft(event.target.value)}
            placeholder="Write a custom message for the invoice..."
            size="2"
          />
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              onClick={async () => {
                if (!invoiceMessageAction) return
                const message = invoiceMessageDraft.trim()
                if (invoiceMessageAction.kind === 'offer') {
                  await createInvoiceFromOfferWithMessage(
                    invoiceMessageAction.offer,
                    message,
                  )
                } else if (invoiceMessageAction.kind === 'bookings') {
                  await createInvoiceFromBookingsWithMessage(
                    invoiceMessageAction.bookings,
                    message,
                  )
                } else {
                  await createInvoicesForAllOffersWithMessage(message)
                }
                setInvoiceMessageDialogOpen(false)
                setInvoiceMessageAction(null)
              }}
            >
              Create Invoice
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Invoice Preview Dialog */}
      <Dialog.Root
        open={!!previewOffer || !!previewBookings}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewOffer(null)
            setPreviewBookings(null)
            setEhfStatus(null)
          }
        }}
      >
        <Dialog.Content size="4" style={{ maxWidth: '800px' }}>
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

          {previewBookings && (
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
                </Box>
              )}
              <InvoicePreview
                basis="bookings"
                bookings={previewBookings}
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
                refFieldPortalContainer={() => invoicePreviewPortalRef.current}
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
                  onClick={() => {
                    createInvoiceFromBookingsWithMessage(
                      {
                        ...previewBookings,
                        all:
                          editedInvoiceLines.length > 0
                            ? editedInvoiceLines
                            : previewBookings.all,
                      },
                      invoicePreviewMessage,
                      invoicePreviewOurRef || undefined,
                      invoicePreviewTheirRef || undefined,
                      lineDiscountOverrides,
                    )
                    setPreviewBookings(null)
                    setPreviewOffer(null)
                    setEhfStatus(null)
                  }}
                  disabled={
                    createInvoiceFromBookingsMutation.isPending || !canSendInvoice
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
    </Box>
  )
}
