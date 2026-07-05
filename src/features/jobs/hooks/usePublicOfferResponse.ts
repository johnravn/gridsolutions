import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  acceptOffer,
  rejectOffer,
  requestOfferRevision,
} from '../api/offerQueries'
import { exportOfferAsPDF } from '../utils/offerPdfExport'
import type {
  OfferAcceptance,
  OfferDetail,
  OfferRejection,
  OfferRevisionRequest,
} from '../types'

export function usePublicOfferResponse(
  accessToken: string,
  offer: OfferDetail | undefined,
) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()

  const [acceptanceForm, setAcceptanceForm] = React.useState<OfferAcceptance>({
    first_name: '',
    last_name: '',
    phone: '',
    terms_accepted: false,
  })
  const [rejectionForm, setRejectionForm] = React.useState<OfferRejection>({
    first_name: '',
    last_name: '',
    phone: '',
    comment: '',
  })
  const [revisionForm, setRevisionForm] = React.useState<OfferRevisionRequest>({
    first_name: '',
    last_name: '',
    phone: '',
    comment: '',
  })
  const [showAcceptForm, setShowAcceptForm] = React.useState(false)
  const [showRejectForm, setShowRejectForm] = React.useState(false)
  const [showRevisionForm, setShowRevisionForm] = React.useState(false)
  const [showTermsDialog, setShowTermsDialog] = React.useState(false)
  const [downloadingPDF, setDownloadingPDF] = React.useState(false)
  const responseSectionRef = React.useRef<HTMLDivElement>(null)

  const termsPdfUrl = React.useMemo(() => {
    if (!offer?.company_terms?.pdf_path) return null
    const { data } = supabase.storage
      .from('company_files')
      .getPublicUrl(offer.company_terms.pdf_path)
    return data.publicUrl
  }, [offer?.company_terms?.pdf_path])

  const hasTerms = Boolean(
    offer?.company_terms?.type &&
      (offer.company_terms.type === 'pdf'
        ? offer.company_terms.pdf_path
        : offer.company_terms.text),
  )

  const acceptMutation = useMutation({
    mutationFn: () => acceptOffer(accessToken, acceptanceForm),
    onSuccess: () => {
      success('Offer Accepted', 'Thank you for accepting the offer!')
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowAcceptForm(false)
    },
    onError: (err: Error) => {
      toastError('Failed to accept offer', err.message || 'Please try again.')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectOffer(accessToken, rejectionForm),
    onSuccess: () => {
      success('Offer Rejected', 'Your rejection has been recorded.')
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowRejectForm(false)
    },
    onError: (err: Error) => {
      toastError('Failed to reject offer', err.message || 'Please try again.')
    },
  })

  const revisionMutation = useMutation({
    mutationFn: () => requestOfferRevision(accessToken, revisionForm),
    onSuccess: () => {
      success(
        'Revision Requested',
        'Your revision request has been sent. We will get back to you with an updated offer.',
      )
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowRevisionForm(false)
    },
    onError: (err: Error) => {
      toastError(
        'Failed to request revision',
        err.message || 'Please try again.',
      )
    },
  })

  React.useEffect(() => {
    if (!showAcceptForm && !showRejectForm && !showRevisionForm) return
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        responseSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        })
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showAcceptForm, showRejectForm, showRevisionForm])

  const has8Digits = (phone: string) => {
    if (!phone) return false
    const parsed = parsePhoneNumberFromString(phone, 'NO')
    return parsed?.nationalNumber.length === 8
  }

  const handleDownloadPDF = async () => {
    if (!offer) return
    setDownloadingPDF(true)
    try {
      await exportOfferAsPDF(offer)
      success('PDF downloaded', 'The offer has been downloaded as PDF.')
    } catch (err) {
      toastError(
        'Failed to export PDF',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setDownloadingPDF(false)
    }
  }

  const toggleResponseAction = (action: 'accept' | 'reject' | 'revision') => {
    setShowAcceptForm((current) => (action === 'accept' ? !current : false))
    setShowRejectForm((current) => (action === 'reject' ? !current : false))
    setShowRevisionForm((current) => (action === 'revision' ? !current : false))
  }

  const responseActionsDisabled =
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    revisionMutation.isPending

  return {
    acceptanceForm,
    setAcceptanceForm,
    rejectionForm,
    setRejectionForm,
    revisionForm,
    setRevisionForm,
    showAcceptForm,
    showRejectForm,
    showRevisionForm,
    setShowAcceptForm,
    setShowRejectForm,
    setShowRevisionForm,
    showTermsDialog,
    setShowTermsDialog,
    downloadingPDF,
    responseSectionRef,
    termsPdfUrl,
    hasTerms,
    acceptMutation,
    rejectMutation,
    revisionMutation,
    handleDownloadPDF,
    toggleResponseAction,
    responseActionsDisabled,
    has8Digits,
  }
}

export function formatPublicOfferCurrency(amount: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPublicOfferDate(dateString: string | null) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
