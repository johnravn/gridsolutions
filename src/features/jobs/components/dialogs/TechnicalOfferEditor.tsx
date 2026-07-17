// src/features/jobs/components/dialogs/TechnicalOfferEditor.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Separator,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Download, Eye, Lock } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { sendOfferByEmail } from '@shared/email/supabaseEdgeEmail'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import {
  companyExpansionQuery,
  crewPricingLevelsQuery,
} from '@features/company/api/queries'
import { offerBasisDetailQuery } from '../../api/offerBasisQueries'
import {
  createOffer,
  exportOfferPDF,
  lockOffer,
  offerDetailQuery,
  recalculateOfferTotals,
} from '../../api/offerQueries'
import {
  calculateOfferTotals,
  calculateRentalFactor,
} from '../../utils/offerCalculations'
import { canLockOffer } from '../../utils/offerValidation'
import { useOfferEditorAutosave } from '../../hooks/useOfferEditorAutosave'
import { lineItemsFromBasisDetail } from './technical-offer-editor/basisLineItems'
import { CrewSection } from './technical-offer-editor/CrewSection'
import { EquipmentSection } from './technical-offer-editor/EquipmentSection'
import { Field } from './technical-offer-editor/Field'
import { TotalsSection } from './technical-offer-editor/TotalsSection'
import { TransportSection } from './technical-offer-editor/TransportSection'
import {
  OFFER_EDITOR_DIALOG_CLASS,
  offerEditorDialogContentStyle,
} from './offerEditorDialogStyles'
import { UnsavedChangesCloseGuard } from './UnsavedChangesCloseGuard'
import type { RentalFactorConfig } from '../../utils/offerCalculations'
import type { OfferBasisDetail, OfferDetail } from '../../types'
import type {
  LocalCrewItem,
  LocalEquipmentGroup,
  LocalTransportGroup,
} from './technical-offer-editor/types'

type JobInfo = {
  title: string | null
  start_at: string | null
  end_at: string | null
  customer: {
    id: string
    is_partner: boolean
    crew_pricing_level_id: string | null
    crew_pricing_level: {
      crew_rate_per_day: number | null
      crew_rate_per_hour: number | null
      default_crew_billing_unit: 'day' | 'hour' | null
    } | null
  } | null
  customer_contact: {
    id: string
    name: string | null
    email: string | null
  } | null
}

function serializeOfferEditorState(s: {
  title: string
  showPricePerLine: boolean
}): string {
  return JSON.stringify({
    title: s.title.trim(),
    showPricePerLine: s.showPricePerLine,
  })
}

function lineItemsFromSource(
  source: OfferDetail | OfferBasisDetail | null | undefined,
) {
  if (!source) {
    return {
      equipmentItems: [],
      crewItems: [],
      transportItems: [],
    }
  }

  const equipmentItems =
    source.groups?.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        total_price: item.unit_price * item.quantity,
      })),
    ) ?? []

  const crewItems = source.crew_items ?? []
  const transportItems = source.transport_items ?? []

  return { equipmentItems, crewItems, transportItems }
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null
  offerBasisId?: string | null
  onSaved?: (offerId: string) => void
}

export default function TechnicalOfferEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  offerId,
  offerBasisId,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const [currentOfferId, setCurrentOfferId] = React.useState<string | null>(
    offerId || null,
  )
  const persistedOfferId = offerId ?? currentOfferId
  const hasPersistedOffer = !!persistedOfferId

  const { data: jobData } = useQuery<JobInfo>({
    queryKey: ['job-title', jobId],
    enabled: open && !!jobId,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `title, start_at, end_at, customer_id,
          customer:customers!jobs_customer_id_fkey (
            id,
            is_partner,
            crew_pricing_level_id,
            crew_pricing_level:crew_pricing_level_id (
              crew_rate_per_day,
              crew_rate_per_hour,
              default_crew_billing_unit
            )
          ),
          customer_contact:customer_contact_id ( id, name, email )`,
        )
        .eq('id', jobId)
        .single()
      if (error) throw error

      const customer = Array.isArray((data as any).customer)
        ? (data as any).customer[0]
        : (data as any).customer

      const rawContact = (data as any).customer_contact
      const contactRow = Array.isArray(rawContact) ? rawContact[0] : rawContact

      return {
        title: data.title,
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        customer: customer
          ? {
              id: customer.id,
              is_partner: customer.is_partner ?? false,
              crew_pricing_level_id: customer.crew_pricing_level_id ?? null,
              crew_pricing_level: Array.isArray(customer.crew_pricing_level)
                ? customer.crew_pricing_level[0]
                : (customer.crew_pricing_level ?? null),
            }
          : null,
        customer_contact: contactRow
          ? {
              id: contactRow.id,
              name: contactRow.name ?? null,
              email: contactRow.email ?? null,
            }
          : null,
      }
    },
  })

  const job: JobInfo = React.useMemo(
    () =>
      jobData ?? {
        title: null,
        start_at: null,
        end_at: null,
        customer: null,
        customer_contact: null,
      },
    [jobData],
  )

  const { data: crewPricingLevels } = useQuery({
    ...crewPricingLevelsQuery(companyId),
    enabled: open && !!companyId,
  })

  const firstCompanyCrewLevel = crewPricingLevels?.[0] ?? null

  const { data: companyExpansion } = useQuery({
    ...companyExpansionQuery({ companyId }),
    enabled: open && !!companyId && typeof companyId === 'string',
  })

  const rentalFactorConfig = React.useMemo(() => {
    if (!companyExpansion?.rental_factor_config) return null
    try {
      const config =
        typeof companyExpansion.rental_factor_config === 'string'
          ? JSON.parse(companyExpansion.rental_factor_config)
          : companyExpansion.rental_factor_config
      return config as RentalFactorConfig
    } catch {
      return null
    }
  }, [companyExpansion?.rental_factor_config])

  const { data: existingOffer, isLoading: isLoadingOffer } = useQuery({
    ...(currentOfferId
      ? offerDetailQuery(currentOfferId)
      : { queryKey: ['no-offer'], queryFn: () => null }),
    enabled: open && !!currentOfferId,
  })

  const basisIdForPreview =
    existingOffer?.offer_basis_id ?? offerBasisId ?? null

  const { data: linkedBasisDetail, isLoading: isLoadingLinkedBasis } = useQuery(
    {
      ...(basisIdForPreview
        ? offerBasisDetailQuery(basisIdForPreview)
        : { queryKey: ['no-basis'], queryFn: () => null }),
      enabled: open && !!basisIdForPreview,
    },
  )

  const lineItemSource = existingOffer ?? linkedBasisDetail

  const isReadOnly = existingOffer?.locked || false
  const canLock = existingOffer ? canLockOffer(existingOffer) : false

  const defaultTitle = job.title ? `Offer for ${job.title}` : ''

  const defaultDaysOfUse = React.useMemo(() => {
    if (!job.start_at || !job.end_at) return 1
    const start = new Date(job.start_at)
    const end = new Date(job.end_at)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }, [job.start_at, job.end_at])

  const [title, setTitle] = React.useState('')
  const [showPricePerLine, setShowPricePerLine] = React.useState(true)
  const [closeGuardOpen, setCloseGuardOpen] = React.useState(false)
  const closeGuardActionRef = React.useRef(false)
  const [lockSendStep, setLockSendStep] = React.useState<
    null | 'choose' | 'email'
  >(null)
  const [gridEmailDraft, setGridEmailDraft] = React.useState('')
  const [lockSendBusy, setLockSendBusy] = React.useState(false)
  const [basisEquipmentGroups, setBasisEquipmentGroups] = React.useState<
    Array<LocalEquipmentGroup>
  >([])
  const [basisExpandedGroups, setBasisExpandedGroups] = React.useState<
    Set<string>
  >(new Set())
  const [basisCrewItems, setBasisCrewItems] = React.useState<
    Array<LocalCrewItem>
  >([])
  const [basisTransportGroups, setBasisTransportGroups] = React.useState<
    Array<LocalTransportGroup>
  >([])
  const initializedLinkedBasisIdRef = React.useRef<string | null>(null)

  const [baselineSerialized, setBaselineSerialized] = React.useState<
    string | null
  >(null)
  const editorFormRef = React.useRef({
    title: '',
    showPricePerLine: true,
  })
  const lockOutcomeRef = React.useRef<'close' | 'stay_open'>('close')
  const initializedOfferIdRef = React.useRef<string | null>(null)

  editorFormRef.current = {
    title,
    showPricePerLine,
  }

  const basisPricing = React.useMemo(() => {
    if (linkedBasisDetail) {
      return {
        daysOfUse: linkedBasisDetail.days_of_use,
        discountPercent: linkedBasisDetail.discount_percent,
        vatPercent:
          linkedBasisDetail.vat_percent === 0 ? (0 as const) : (25 as const),
      }
    }
    return {
      daysOfUse: defaultDaysOfUse,
      discountPercent: 0,
      vatPercent: 25 as const,
    }
  }, [linkedBasisDetail, defaultDaysOfUse])

  const hasUnsavedChanges = React.useCallback(() => {
    if (!open || isReadOnly) return false
    if (baselineSerialized === null) return false
    return (
      serializeOfferEditorState({
        title: editorFormRef.current.title.trim(),
        showPricePerLine: editorFormRef.current.showPricePerLine,
      }) !== baselineSerialized
    )
  }, [open, isReadOnly, baselineSerialized, title, showPricePerLine])

  const isDirty = hasUnsavedChanges()

  React.useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  React.useEffect(() => {
    if (!open) {
      setBaselineSerialized(null)
      setCloseGuardOpen(false)
      setLockSendStep(null)
      setGridEmailDraft('')
      initializedOfferIdRef.current = null
    }
  }, [open])

  React.useEffect(() => {
    if (offerId) {
      setCurrentOfferId(offerId)
    }
  }, [offerId])

  React.useEffect(() => {
    if (!open) return
    if (isLoadingOffer) return
    if (hasPersistedOffer && !existingOffer) return

    if (existingOffer && currentOfferId) {
      if (initializedOfferIdRef.current === currentOfferId) {
        return
      }
      initializedOfferIdRef.current = currentOfferId

      setTitle(existingOffer.title)
      setShowPricePerLine(existingOffer.show_price_per_line)

      setBaselineSerialized(
        serializeOfferEditorState({
          title: existingOffer.title.trim(),
          showPricePerLine: existingOffer.show_price_per_line,
        }),
      )
    } else if (!hasPersistedOffer) {
      initializedOfferIdRef.current = null
      setTitle(defaultTitle)
      setShowPricePerLine(true)
      setCurrentOfferId(null)

      setBaselineSerialized(
        serializeOfferEditorState({
          title: defaultTitle.trim(),
          showPricePerLine: true,
        }),
      )
    }
  }, [
    open,
    existingOffer,
    currentOfferId,
    defaultTitle,
    isLoadingOffer,
    hasPersistedOffer,
  ])

  const defaultCrewRatePerDay = React.useMemo(() => {
    const level =
      job.customer?.crew_pricing_level ??
      (job.customer ? firstCompanyCrewLevel : null)
    const value =
      level?.crew_rate_per_day != null
        ? level.crew_rate_per_day
        : (companyExpansion?.crew_rate_per_day ?? null)
    if (value === null) return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }, [
    job.customer?.crew_pricing_level?.crew_rate_per_day,
    job.customer,
    firstCompanyCrewLevel?.crew_rate_per_day,
    companyExpansion?.crew_rate_per_day,
  ])

  const defaultCrewRatePerHour = React.useMemo(() => {
    const level =
      job.customer?.crew_pricing_level ??
      (job.customer ? firstCompanyCrewLevel : null)
    const value =
      level?.crew_rate_per_hour != null
        ? level.crew_rate_per_hour
        : (companyExpansion?.crew_rate_per_hour ?? null)
    if (value === null) return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }, [
    job.customer?.crew_pricing_level?.crew_rate_per_hour,
    job.customer,
    firstCompanyCrewLevel?.crew_rate_per_hour,
    companyExpansion?.crew_rate_per_hour,
  ])

  const defaultCrewBillingUnit = React.useMemo((): 'day' | 'hour' => {
    const level =
      job.customer?.crew_pricing_level ??
      (job.customer ? firstCompanyCrewLevel : null)
    const unit = level?.default_crew_billing_unit
    return unit === 'hour' ? 'hour' : 'day'
  }, [
    job.customer?.crew_pricing_level?.default_crew_billing_unit,
    job.customer,
    firstCompanyCrewLevel?.default_crew_billing_unit,
  ])

  const equipmentRentalFactor = React.useMemo(
    () => calculateRentalFactor(basisPricing.daysOfUse, rentalFactorConfig),
    [basisPricing.daysOfUse, rentalFactorConfig],
  )

  React.useEffect(() => {
    if (!open) {
      initializedLinkedBasisIdRef.current = null
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !basisIdForPreview) return
    if (isLoadingLinkedBasis) return
    if (!linkedBasisDetail) return
    if (initializedLinkedBasisIdRef.current === basisIdForPreview) return

    initializedLinkedBasisIdRef.current = basisIdForPreview
    const parsed = lineItemsFromBasisDetail(
      linkedBasisDetail,
      defaultCrewRatePerHour,
    )
    setBasisEquipmentGroups(parsed.equipmentGroups)
    setBasisCrewItems(parsed.crewItems)
    setBasisTransportGroups(parsed.transportGroups)
    setBasisExpandedGroups(new Set())
  }, [
    open,
    basisIdForPreview,
    linkedBasisDetail,
    isLoadingLinkedBasis,
    defaultCrewRatePerHour,
  ])

  const totals = React.useMemo(() => {
    const { equipmentItems, crewItems, transportItems } =
      lineItemsFromSource(lineItemSource)

    const baseTotals = calculateOfferTotals(
      equipmentItems,
      crewItems,
      transportItems,
      basisPricing.daysOfUse,
      basisPricing.discountPercent,
      basisPricing.vatPercent,
      rentalFactorConfig,
      companyExpansion?.vehicle_distance_rate,
      companyExpansion?.vehicle_distance_increment,
      companyExpansion?.vehicle_daily_rate,
    )

    const round2 = (n: number) => Math.round(n * 100) / 100
    return {
      ...baseTotals,
      equipmentSubtotal: round2(baseTotals.equipmentSubtotal),
      crewSubtotal: round2(baseTotals.crewSubtotal),
      transportSubtotal: round2(baseTotals.transportSubtotal),
      totalBeforeDiscount: round2(baseTotals.totalBeforeDiscount),
      totalAfterDiscount: round2(baseTotals.totalAfterDiscount),
      totalWithVAT: round2(baseTotals.totalWithVAT),
      discountAmount: round2(baseTotals.discountAmount),
    }
  }, [
    lineItemSource,
    basisPricing,
    rentalFactorConfig,
    companyExpansion?.vehicle_daily_rate,
    companyExpansion?.vehicle_distance_rate,
    companyExpansion?.vehicle_distance_increment,
  ])

  const saveMutation = useMutation({
    mutationFn: async (payload?: {
      closeAfterSave?: boolean
      autosave?: boolean
    }) => {
      if (!title.trim()) {
        throw new Error('Title is required')
      }

      const persistedBefore = offerId ?? currentOfferId
      let workingOfferId: string
      let createdNew = false

      if (!persistedBefore) {
        if (!offerBasisId) {
          throw new Error('Offer basis is required to create a new offer')
        }
        createdNew = true
        workingOfferId = await createOffer({
          jobId,
          companyId,
          offerBasisId,
          offerType: 'technical',
          title: title.trim(),
          daysOfUse: basisPricing.daysOfUse,
          discountPercent: basisPricing.discountPercent,
          vatPercent: basisPricing.vatPercent,
          showPricePerLine,
        })
      } else {
        workingOfferId = persistedBefore
        const { error } = await supabase
          .from('job_offers')
          .update({
            title: title.trim(),
            show_price_per_line: showPricePerLine,
          })
          .eq('id', workingOfferId)

        if (error) throw error
      }

      try {
        await recalculateOfferTotals(workingOfferId)
      } catch (recalcError) {
        console.warn('Failed to recalculate offer totals:', recalcError)
      }

      return {
        offerId: workingOfferId,
        createdNew,
        closeAfterSave: payload?.closeAfterSave === true,
        autosave: payload?.autosave === true,
      }
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', result.offerId] })
      setCurrentOfferId(result.offerId)
      setBaselineSerialized(
        serializeOfferEditorState({
          title: editorFormRef.current.title.trim(),
          showPricePerLine: editorFormRef.current.showPricePerLine,
        }),
      )
      if (!result.autosave) {
        success(
          result.createdNew ? 'Offer created' : 'Offer updated',
          `Technical offer "${title.trim()}" was saved successfully.`,
        )
      }

      onSaved?.(result.offerId)
      if (result.closeAfterSave) {
        onOpenChange(false)
      }
    },
    onError: (e: any) => {
      toastError(
        'Failed to save offer',
        e?.message ?? 'Please check your inputs and try again.',
      )
    },
  })

  const lockOfferMutation = useMutation({
    mutationFn: lockOffer,
    onSuccess: async (_, lockedOfferId) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', lockedOfferId] })
      const updatedOffer = await qc.fetchQuery(offerDetailQuery(lockedOfferId))
      const stayOpen = lockOutcomeRef.current === 'stay_open'
      lockOutcomeRef.current = 'close'
      if (updatedOffer?.access_token) {
        const url = `${window.location.origin}/offer/${updatedOffer.access_token}`
        try {
          await navigator.clipboard.writeText(url)
          success(
            'Link copied',
            stayOpen
              ? 'The offer is locked. The link is on your clipboard — send it when you are ready.'
              : `The offer is locked. The link has been copied to your clipboard.`,
          )
          info('Offer link', `Link: ${url}`)
        } catch {
          success(
            'Offer locked',
            stayOpen
              ? `The offer is locked. Copy this link to send it yourself: ${url}`
              : `The offer is locked. Copy and send this link: ${url}`,
          )
        }
      } else {
        success(
          'Offer locked',
          'The offer has been locked. You can share the offer link once it is available.',
        )
      }

      onSaved?.(lockedOfferId)
      if (!stayOpen) {
        onOpenChange(false)
      }
    },
    onError: (e: any) => {
      lockOutcomeRef.current = 'close'
      toastError('Failed to lock offer', e?.message ?? 'Please try again.')
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: exportOfferPDF,
    onSuccess: () => {
      success('PDF exported', 'The offer has been exported as PDF.')
    },
    onError: (e: any) => {
      toastError('Failed to export PDF', e?.message ?? 'Please try again.')
    },
  })

  const handleOfferDialogOpenChange = (next: boolean) => {
    if (next) return
    if (closeGuardOpen) return
    if (lockSendStep) {
      setLockSendStep(null)
      return
    }
    if (!isReadOnly && hasUnsavedChanges()) {
      setCloseGuardOpen(true)
      return
    }
    onOpenChange(false)
  }

  const handleSaveClick = () => {
    if (saveMutation.isPending) return
    saveMutation.mutate({ closeAfterSave: false })
  }

  const openLockSendFlow = () => {
    if (!currentOfferId) {
      info('Save required', 'Save the offer before locking and sending it.')
      return
    }
    if (existingOffer?.locked) return
    setLockSendStep('choose')
  }

  const performSelfLock = async () => {
    if (!currentOfferId) return
    try {
      setLockSendBusy(true)
      setLockSendStep(null)
      if (hasUnsavedChanges()) {
        await saveMutation.mutateAsync({ closeAfterSave: false })
      }
      lockOutcomeRef.current = 'stay_open'
      await lockOfferMutation.mutateAsync(currentOfferId)
    } catch {
      // errors surfaced by mutations
    } finally {
      setLockSendBusy(false)
    }
  }

  const performGridEmailSend = async () => {
    const email = gridEmailDraft.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastError('Invalid email', 'Enter a valid email address.')
      return
    }
    if (!currentOfferId) return
    try {
      setLockSendBusy(true)
      if (hasUnsavedChanges()) {
        await saveMutation.mutateAsync({ closeAfterSave: false })
      }
      await lockOffer(currentOfferId)
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', currentOfferId] })
      const sent = await sendOfferByEmail({
        offerId: currentOfferId,
        toEmail: email,
      })
      if (!sent.ok) {
        throw new Error(
          sent.failure.details
            ? `${sent.failure.message}: ${sent.failure.details}`
            : sent.failure.message,
        )
      }
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', currentOfferId] })
      success('Offer emailed', `The offer link was sent to ${email}.`)
      setLockSendStep(null)
      setBaselineSerialized(
        serializeOfferEditorState({
          title: editorFormRef.current.title.trim(),
          showPricePerLine: editorFormRef.current.showPricePerLine,
        }),
      )
      onSaved?.(currentOfferId)
      onOpenChange(false)
    } catch (e: any) {
      toastError(
        'Could not send email',
        e?.message ?? 'Check the address and try again.',
      )
    } finally {
      setLockSendBusy(false)
    }
  }

  const saveFromCloseGuardAndExit = async () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    closeGuardActionRef.current = true
    try {
      await saveMutation.mutateAsync({ closeAfterSave: true })
      setCloseGuardOpen(false)
      onOpenChange(false)
    } catch {
      // mutation shows error
    } finally {
      closeGuardActionRef.current = false
    }
  }

  const discardFromCloseGuard = () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    setCloseGuardOpen(false)
    onOpenChange(false)
  }

  const keepEditingFromCloseGuard = () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    setCloseGuardOpen(false)
  }

  const linkedBasisTitle = linkedBasisDetail?.title.trim() || 'Offer basis'

  const canSave =
    !!title.trim() &&
    (hasPersistedOffer || !!offerBasisId || !!existingOffer?.offer_basis_id)

  useOfferEditorAutosave({
    enabled: open && !isReadOnly && !(hasPersistedOffer && isLoadingOffer),
    hasUnsavedChanges,
    isSaving: saveMutation.isPending,
    canSave: () => canSave,
    save: () => saveMutation.mutate({ closeAfterSave: false, autosave: true }),
  })

  return (
    <Dialog.Root open={open} onOpenChange={handleOfferDialogOpenChange}>
      <Dialog.Content
        align="center"
        maxWidth="1280px"
        className={OFFER_EDITOR_DIALOG_CLASS}
        style={offerEditorDialogContentStyle}
        onPointerDownOutside={(event) => {
          if (closeGuardOpen || lockSendStep) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (closeGuardOpen || lockSendStep) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (closeGuardOpen || lockSendStep) {
            event.preventDefault()
            return
          }
          if (!isReadOnly && hasUnsavedChanges()) {
            event.preventDefault()
            setCloseGuardOpen(true)
          }
        }}
      >
        <Flex
          direction="column"
          gap="3"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <Flex justify="between" align="center" gap="3" wrap="wrap">
            <Dialog.Title style={{ margin: 0 }}>Technical Offer</Dialog.Title>
            <Flex gap="2" wrap="wrap">
              {currentOfferId ? (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => exportPdfMutation.mutate(currentOfferId)}
                  disabled={exportPdfMutation.isPending}
                >
                  <Download width={16} height={16} />
                  PDF
                </Button>
              ) : null}
              {canLock && !isReadOnly ? (
                <Button
                  size="2"
                  onClick={openLockSendFlow}
                  disabled={
                    lockOfferMutation.isPending || lockSendBusy || !title.trim()
                  }
                >
                  <Lock width={16} height={16} />
                  Lock & send
                </Button>
              ) : null}
              {!isReadOnly ? (
                <Button
                  size="2"
                  onClick={handleSaveClick}
                  disabled={saveMutation.isPending || !canSave}
                >
                  Save
                </Button>
              ) : null}
            </Flex>
          </Flex>

          {hasPersistedOffer && isLoadingOffer ? (
            <Flex align="center" justify="center" style={{ flex: 1 }}>
              <Text>Loading…</Text>
            </Flex>
          ) : (
            <Flex
              direction="column"
              gap="3"
              style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <Flex gap="3" wrap="wrap" align="end">
                <Box style={{ flex: 2, minWidth: 220 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Title
                  </Text>
                  <Flex gap="2" align="center">
                    <TextField.Root
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter offer title"
                      readOnly={isReadOnly}
                      style={{ flex: 1 }}
                    />
                    {!isReadOnly && defaultTitle ? (
                      <Button
                        size="2"
                        variant="soft"
                        onClick={() => setTitle(defaultTitle)}
                        disabled={title === defaultTitle}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </Flex>
                </Box>
                <Flex align="center" gap="2" style={{ minHeight: 32 }}>
                  <Checkbox
                    checked={showPricePerLine}
                    onCheckedChange={(checked) =>
                      setShowPricePerLine(checked === true)
                    }
                    disabled={isReadOnly}
                  />
                  <Text size="2" as="label" style={{ cursor: 'pointer' }}>
                    Show price per line to customer
                  </Text>
                </Flex>
              </Flex>

              <Separator size="4" />

              <Tabs.Root
                defaultValue={basisIdForPreview ? 'basis' : 'totals'}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <AnimatedTabsList>
                  {basisIdForPreview ? (
                    <Tabs.Trigger value="basis">Basis</Tabs.Trigger>
                  ) : null}
                  <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
                  {currentOfferId ? (
                    <Tabs.Trigger value="preview">
                      <Eye width={14} height={14} />
                      Preview
                    </Tabs.Trigger>
                  ) : null}
                </AnimatedTabsList>

                <Box
                  pt="3"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                  }}
                >
                  {basisIdForPreview ? (
                    <Tabs.Content value="basis">
                      <Flex direction="column" gap="3">
                        <Text size="2" color="gray">
                          Line items from{' '}
                          <Text weight="medium" as="span">
                            {linkedBasisTitle}
                          </Text>
                          . Edit equipment, crew, and transport on the Offers
                          tab.
                        </Text>

                        {isLoadingLinkedBasis ? (
                          <Text color="gray">Loading basis…</Text>
                        ) : (
                          <Tabs.Root defaultValue="equipment">
                            <AnimatedTabsList>
                              <Tabs.Trigger value="equipment">
                                Equipment
                              </Tabs.Trigger>
                              <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
                              <Tabs.Trigger value="transport">
                                Transport
                              </Tabs.Trigger>
                            </AnimatedTabsList>

                            <Box pt="3">
                              <Tabs.Content value="equipment">
                                <EquipmentSection
                                  groups={basisEquipmentGroups}
                                  onGroupsChange={setBasisEquipmentGroups}
                                  expandedGroups={basisExpandedGroups}
                                  onExpandedGroupsChange={
                                    setBasisExpandedGroups
                                  }
                                  companyId={companyId}
                                  equipmentDaysOfUse={basisPricing.daysOfUse}
                                  equipmentRentalFactor={equipmentRentalFactor}
                                  readOnly
                                />
                              </Tabs.Content>

                              <Tabs.Content value="crew">
                                <CrewSection
                                  items={basisCrewItems}
                                  onItemsChange={setBasisCrewItems}
                                  companyId={companyId}
                                  readOnly
                                  jobStartAt={job.start_at}
                                  jobEndAt={job.end_at}
                                  defaultRatePerDay={defaultCrewRatePerDay}
                                  defaultRatePerHour={defaultCrewRatePerHour}
                                  defaultBillingUnit={defaultCrewBillingUnit}
                                />
                              </Tabs.Content>

                              <Tabs.Content value="transport">
                                <TransportSection
                                  groups={basisTransportGroups}
                                  onGroupsChange={setBasisTransportGroups}
                                  companyId={companyId}
                                  readOnly
                                  jobStartAt={job.start_at}
                                  jobEndAt={job.end_at}
                                  vehicleDailyRate={
                                    companyExpansion?.vehicle_daily_rate ?? null
                                  }
                                  vehicleDistanceRate={
                                    companyExpansion?.vehicle_distance_rate ??
                                    null
                                  }
                                  vehicleDistanceIncrement={
                                    companyExpansion?.vehicle_distance_increment ??
                                    150
                                  }
                                />
                              </Tabs.Content>
                            </Box>
                          </Tabs.Root>
                        )}
                      </Flex>
                    </Tabs.Content>
                  ) : null}

                  {currentOfferId ? (
                    <Tabs.Content value="preview">
                      <Flex direction="column" gap="3">
                        <Text size="2" color="gray">
                          Open the public offer page as your customer sees it.
                        </Text>
                        <Button
                          size="2"
                          variant="soft"
                          onClick={() => {
                            const token = existingOffer?.access_token
                            if (!token) return
                            window.open(
                              `${window.location.origin}/offer/${token}`,
                              '_blank',
                            )
                          }}
                          disabled={!existingOffer?.access_token}
                        >
                          <Eye width={14} height={14} />
                          Show preview
                        </Button>
                      </Flex>
                    </Tabs.Content>
                  ) : null}

                  <Tabs.Content value="totals">
                    <TotalsSection totals={totals} />
                  </Tabs.Content>
                </Box>
              </Tabs.Root>
            </Flex>
          )}
        </Flex>
      </Dialog.Content>

      <UnsavedChangesCloseGuard
        open={closeGuardOpen}
        isSaving={saveMutation.isPending}
        canSave={canSave}
        onKeepEditing={keepEditingFromCloseGuard}
        onDiscard={discardFromCloseGuard}
        onSaveAndClose={() => void saveFromCloseGuardAndExit()}
      />

      <Dialog.Root
        open={lockSendStep === 'choose'}
        onOpenChange={(o) => {
          if (!o) setLockSendStep(null)
        }}
      >
        <Dialog.Content maxWidth="520px" style={{ zIndex: 102 }}>
          <Dialog.Title>Lock & send</Dialog.Title>
          <Separator my="3" />
          <Text size="2" mb="3">
            Locking prevents further edits. How do you want to deliver the offer
            to your customer?
          </Text>
          <Flex direction="column" gap="2">
            <Button
              variant="solid"
              disabled={lockSendBusy}
              onClick={() => void performSelfLock()}
            >
              I'll send the link myself
            </Button>
            <Button
              variant="soft"
              disabled={lockSendBusy}
              onClick={() => {
                setGridEmailDraft(job.customer_contact?.email?.trim() ?? '')
                setLockSendStep('email')
              }}
            >
              Send offer by email (Grid)
            </Button>
            <Button variant="ghost" onClick={() => setLockSendStep(null)}>
              Cancel
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={lockSendStep === 'email'}
        onOpenChange={(o) => {
          if (!o) setLockSendStep(null)
        }}
      >
        <Dialog.Content maxWidth="520px" style={{ zIndex: 102 }}>
          <Dialog.Title>Send offer by email</Dialog.Title>
          <Separator my="3" />
          <Text size="2" mb="2">
            We use the job’s main contact when available. Confirm or edit the
            recipient address.
          </Text>
          {job.customer_contact?.name ? (
            <Text size="2" color="gray" mb="2">
              Contact: {job.customer_contact.name}
            </Text>
          ) : null}
          <Field label="Recipient email">
            <TextField.Root
              type="email"
              value={gridEmailDraft}
              onChange={(e) => setGridEmailDraft(e.target.value)}
              placeholder="name@company.com"
              disabled={lockSendBusy}
            />
          </Field>
          <Flex gap="2" mt="4" justify="end" wrap="wrap">
            <Button
              variant="soft"
              onClick={() => setLockSendStep('choose')}
              disabled={lockSendBusy}
            >
              Back
            </Button>
            <Button
              variant="soft"
              onClick={() => setLockSendStep(null)}
              disabled={lockSendBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void performGridEmailSend()}
              disabled={lockSendBusy || !gridEmailDraft.trim()}
            >
              {lockSendBusy ? 'Sending…' : 'Lock & send email'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Dialog.Root>
  )
}
