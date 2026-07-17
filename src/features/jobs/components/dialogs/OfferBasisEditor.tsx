import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Select,
  Separator,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Import, Lock } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import {
  companyExpansionQuery,
  crewPricingLevelsQuery,
} from '@features/company/api/queries'
import {
  createEmptyOfferBasis,
  createOfferBasisFromBookings,
  isOfferBasisLocked,
  offerBasisDetailQuery,
  saveOfferBasis,
} from '../../api/offerBasisQueries'
import {
  calculateOfferTotals,
  calculateRentalFactor,
} from '../../utils/offerCalculations'
import { useOfferEditorAutosave } from '../../hooks/useOfferEditorAutosave'
import {
  canAutosaveOfferBasisState,
  editorStateHasLineItems,
} from '../../utils/offerBasisWriteSafety'
import {
  lineItemsFromBasisDetail,
  lineItemsFromLocalEditorState,
} from './technical-offer-editor/basisLineItems'
import { CrewSection } from './technical-offer-editor/CrewSection'
import { EquipmentSection } from './technical-offer-editor/EquipmentSection'
import { TotalsSection } from './technical-offer-editor/TotalsSection'
import { TransportSection } from './technical-offer-editor/TransportSection'
import {
  OFFER_EDITOR_DIALOG_CLASS,
  offerEditorDialogContentStyle,
} from './offerEditorDialogStyles'
import { UnsavedChangesCloseGuard } from './UnsavedChangesCloseGuard'
import type { RentalFactorConfig } from '../../utils/offerCalculations'
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../../types'
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
    is_partner: boolean
    crew_pricing_level_id: string | null
    crew_pricing_level: {
      crew_rate_per_day: number | null
      crew_rate_per_hour: number | null
      default_crew_billing_unit: 'day' | 'hour' | null
    } | null
  } | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  companyId: string
  basisId?: string
  onSaved?: (basisId: string) => void
}

function serializeBasisEditorState(state: {
  basisTitle: string
  daysOfUse: number
  discountPercent: number
  vatPercent: 0 | 25
  equipmentGroups: Array<LocalEquipmentGroup>
  crewItems: Array<LocalCrewItem>
  transportGroups: Array<LocalTransportGroup>
}) {
  return JSON.stringify({
    basisTitle: state.basisTitle.trim(),
    daysOfUse: state.daysOfUse,
    discountPercent: state.discountPercent,
    vatPercent: state.vatPercent,
    equipmentGroups: state.equipmentGroups,
    crewItems: state.crewItems,
    transportGroups: state.transportGroups,
  })
}

export default function OfferBasisEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  basisId,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [currentBasisId, setCurrentBasisId] = React.useState<string | null>(
    basisId ?? null,
  )
  const persistedBasisId = basisId ?? currentBasisId
  const hasPersistedBasis = !!persistedBasisId

  const [equipmentGroups, setEquipmentGroups] = React.useState<
    Array<LocalEquipmentGroup>
  >([])
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )
  const [crewItems, setCrewItems] = React.useState<Array<LocalCrewItem>>([])
  const [transportGroups, setTransportGroups] = React.useState<
    Array<LocalTransportGroup>
  >([])
  const [basisTitle, setBasisTitle] = React.useState('')
  const [daysOfUse, setDaysOfUse] = React.useState(1)
  const [discountPercent, setDiscountPercent] = React.useState(0)
  const [vatPercent, setVatPercent] = React.useState<0 | 25>(25)
  const [daysOfUseDraft, setDaysOfUseDraft] = React.useState<string | null>(
    null,
  )
  const [discountPercentDraft, setDiscountPercentDraft] = React.useState<
    string | null
  >(null)
  const [closeGuardOpen, setCloseGuardOpen] = React.useState(false)
  const [importConfirmOpen, setImportConfirmOpen] = React.useState(false)
  const [baselineSerialized, setBaselineSerialized] = React.useState<
    string | null
  >(null)
  const baselineSerializedRef = React.useRef<string | null>(null)
  const editorFormRef = React.useRef({
    basisTitle: '',
    daysOfUse: 1,
    discountPercent: 0,
    vatPercent: 25 as 0 | 25,
    equipmentGroups: [] as Array<LocalEquipmentGroup>,
    crewItems: [] as Array<LocalCrewItem>,
    transportGroups: [] as Array<LocalTransportGroup>,
  })
  const initializedBasisIdRef = React.useRef<string | null>(null)
  /** Synchronous gate so double-clicks / autosave+manual cannot overlap delete+rewrite. */
  const saveInFlightRef = React.useRef(false)
  const closeGuardActionRef = React.useRef(false)

  editorFormRef.current = {
    basisTitle,
    daysOfUse,
    discountPercent,
    vatPercent,
    equipmentGroups,
    crewItems,
    transportGroups,
  }

  const { data: jobData, isLoading: isLoadingJob } = useQuery<JobInfo>({
    queryKey: ['job-title', jobId],
    enabled: open && !!jobId,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `title, start_at, end_at,
          customer:customers!jobs_customer_id_fkey (
            is_partner,
            crew_pricing_level_id,
            crew_pricing_level:crew_pricing_level_id ( crew_rate_per_day, crew_rate_per_hour, default_crew_billing_unit )
          )`,
        )
        .eq('id', jobId)
        .single()
      if (error) throw error

      const customer = Array.isArray((data as any).customer)
        ? (data as any).customer[0]
        : (data as any).customer

      return {
        title: data.title,
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        customer: customer
          ? {
              is_partner: customer.is_partner ?? false,
              crew_pricing_level_id: customer.crew_pricing_level_id ?? null,
              crew_pricing_level: Array.isArray(customer.crew_pricing_level)
                ? customer.crew_pricing_level[0]
                : (customer.crew_pricing_level ?? null),
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
    enabled: open && !!companyId,
  })

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
    const value =
      level?.default_crew_billing_unit ??
      companyExpansion?.default_crew_billing_unit ??
      'hour'
    return value === 'hour' ? 'hour' : 'day'
  }, [
    job.customer?.crew_pricing_level?.default_crew_billing_unit,
    job.customer,
    firstCompanyCrewLevel?.default_crew_billing_unit,
    companyExpansion?.default_crew_billing_unit,
  ])

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

  const defaultDaysOfUse = React.useMemo(() => {
    if (!job.start_at || !job.end_at) return 1
    const start = new Date(job.start_at)
    const end = new Date(job.end_at)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }, [job.start_at, job.end_at])

  const equipmentRentalFactor = React.useMemo(
    () => calculateRentalFactor(daysOfUse, rentalFactorConfig),
    [daysOfUse, rentalFactorConfig],
  )

  const totals = React.useMemo(() => {
    const {
      equipmentItems,
      crewItems: crewLineItems,
      transportItems,
    } = lineItemsFromLocalEditorState(
      equipmentGroups,
      crewItems,
      transportGroups,
    )

    const baseTotals = calculateOfferTotals(
      equipmentItems as Array<OfferEquipmentItem>,
      crewLineItems as Array<OfferCrewItem>,
      transportItems as Array<OfferTransportItem>,
      daysOfUse,
      discountPercent,
      vatPercent,
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
    equipmentGroups,
    crewItems,
    transportGroups,
    daysOfUse,
    discountPercent,
    vatPercent,
    rentalFactorConfig,
    companyExpansion?.vehicle_daily_rate,
    companyExpansion?.vehicle_distance_rate,
    companyExpansion?.vehicle_distance_increment,
  ])

  const { data: existingBasis, isLoading: isLoadingBasis } = useQuery({
    ...(persistedBasisId
      ? offerBasisDetailQuery(persistedBasisId)
      : { queryKey: ['no-offer-basis'], queryFn: () => null }),
    enabled: open && !!persistedBasisId,
  })

  const { data: isLocked = false } = useQuery({
    queryKey: ['offer-basis-locked', persistedBasisId] as const,
    queryFn: () => isOfferBasisLocked(persistedBasisId!),
    enabled: open && !!persistedBasisId,
  })

  const isReadOnly = isLocked

  const defaultTitle = job.title ? `Offer for ${job.title}` : 'Offer basis'

  const defaultDiscountPercent = React.useMemo(() => {
    if (!companyExpansion || !job.customer) return 0
    if (
      job.customer.is_partner &&
      companyExpansion.partner_discount_percent !== null
    ) {
      return companyExpansion.partner_discount_percent
    }
    if (
      !job.customer.is_partner &&
      companyExpansion.customer_discount_percent !== null
    ) {
      return companyExpansion.customer_discount_percent
    }
    return 0
  }, [companyExpansion, job.customer])

  React.useEffect(() => {
    if (basisId) {
      setCurrentBasisId(basisId)
    }
  }, [basisId])

  React.useEffect(() => {
    if (!open) {
      initializedBasisIdRef.current = null
      setBaselineSerialized(null)
      baselineSerializedRef.current = null
      setCloseGuardOpen(false)
      setImportConfirmOpen(false)
      closeGuardActionRef.current = false
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    if (isLoadingBasis) return
    if (hasPersistedBasis && !existingBasis) return

    if (existingBasis && persistedBasisId) {
      if (initializedBasisIdRef.current === persistedBasisId) return
      initializedBasisIdRef.current = persistedBasisId

      const parsed = lineItemsFromBasisDetail(
        existingBasis,
        defaultCrewRatePerHour,
      )
      setEquipmentGroups(parsed.equipmentGroups)
      setCrewItems(parsed.crewItems)
      setTransportGroups(parsed.transportGroups)
      setBasisTitle(existingBasis.title)
      setDaysOfUse(existingBasis.days_of_use)
      setDiscountPercent(existingBasis.discount_percent)
      setVatPercent(existingBasis.vat_percent === 0 ? 0 : 25)
      setDaysOfUseDraft(null)
      setDiscountPercentDraft(null)
      const nextBaseline = serializeBasisEditorState({
        basisTitle: existingBasis.title,
        daysOfUse: existingBasis.days_of_use,
        discountPercent: existingBasis.discount_percent,
        vatPercent: existingBasis.vat_percent === 0 ? 0 : 25,
        equipmentGroups: parsed.equipmentGroups,
        crewItems: parsed.crewItems,
        transportGroups: parsed.transportGroups,
      })
      baselineSerializedRef.current = nextBaseline
      setBaselineSerialized(nextBaseline)
    } else if (!hasPersistedBasis) {
      initializedBasisIdRef.current = null
      setEquipmentGroups([])
      setCrewItems([])
      setTransportGroups([])
      setExpandedGroups(new Set())
      setCurrentBasisId(null)
      setBasisTitle(defaultTitle)
      setDaysOfUse(defaultDaysOfUse)
      setDiscountPercent(defaultDiscountPercent)
      setVatPercent(25)
      setDaysOfUseDraft(null)
      setDiscountPercentDraft(null)
      const nextBaseline = serializeBasisEditorState({
        basisTitle: defaultTitle,
        daysOfUse: defaultDaysOfUse,
        discountPercent: defaultDiscountPercent,
        vatPercent: 25,
        equipmentGroups: [],
        crewItems: [],
        transportGroups: [],
      })
      baselineSerializedRef.current = nextBaseline
      setBaselineSerialized(nextBaseline)
    }
  }, [
    open,
    existingBasis,
    persistedBasisId,
    hasPersistedBasis,
    isLoadingBasis,
    defaultCrewRatePerHour,
    defaultTitle,
    defaultDaysOfUse,
    defaultDiscountPercent,
  ])

  const hasUnsavedChanges = React.useCallback(() => {
    if (!open || isReadOnly) return false
    const baseline = baselineSerializedRef.current
    if (baseline === null) return false
    const current = editorFormRef.current
    return (
      serializeBasisEditorState({
        basisTitle: current.basisTitle,
        daysOfUse: current.daysOfUse,
        discountPercent: current.discountPercent,
        vatPercent: current.vatPercent,
        equipmentGroups: current.equipmentGroups,
        crewItems: current.crewItems,
        transportGroups: current.transportGroups,
      }) !== baseline
    )
  }, [
    open,
    isReadOnly,
    baselineSerialized,
    basisTitle,
    daysOfUse,
    discountPercent,
    vatPercent,
    equipmentGroups,
    crewItems,
    transportGroups,
  ])

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

  const saveMutation = useMutation({
    mutationFn: async (payload?: {
      closeAfterSave?: boolean
      autosave?: boolean
    }) => {
      const form = editorFormRef.current
      let workingBasisId = persistedBasisId
      if (!workingBasisId) {
        workingBasisId = await createEmptyOfferBasis({
          jobId,
          companyId,
          title: defaultTitle,
        })
      }

      await saveOfferBasis({
        basisId: workingBasisId,
        title: form.basisTitle.trim() || defaultTitle,
        daysOfUse: form.daysOfUse,
        discountPercent: form.discountPercent,
        vatPercent: form.vatPercent,
        equipmentGroups: form.equipmentGroups,
        crewItems: form.crewItems,
        transportGroups: form.transportGroups,
      })
      return {
        basisId: workingBasisId,
        closeAfterSave: payload?.closeAfterSave === true,
        autosave: payload?.autosave === true,
      }
    },
    onSuccess: async (result) => {
      const savedBasisId = result.basisId
      await qc.invalidateQueries({ queryKey: ['job-offer-bases', jobId] })
      await qc.invalidateQueries({
        queryKey: ['offer-basis-detail', savedBasisId],
      })
      await qc.invalidateQueries({
        queryKey: ['offer-basis-locked', savedBasisId],
      })

      setCurrentBasisId(savedBasisId)
      initializedBasisIdRef.current = savedBasisId
      const current = editorFormRef.current
      const nextBaseline = serializeBasisEditorState({
        basisTitle: current.basisTitle,
        daysOfUse: current.daysOfUse,
        discountPercent: current.discountPercent,
        vatPercent: current.vatPercent,
        equipmentGroups: current.equipmentGroups,
        crewItems: current.crewItems,
        transportGroups: current.transportGroups,
      })
      baselineSerializedRef.current = nextBaseline
      setBaselineSerialized(nextBaseline)

      if (!result.autosave) {
        success(
          hasPersistedBasis ? 'Offer basis updated' : 'Offer basis created',
          'Equipment, crew, and transport lines were saved.',
        )
      }
      onSaved?.(savedBasisId)
      if (result.closeAfterSave) {
        onOpenChange(false)
      }
    },
    onError: (e: any) => {
      toastError(
        'Failed to save offer basis',
        `${e?.message ?? 'Please check your inputs and try again.'} Your edits are still in this dialog — click Save again. Do not discard or reload until it succeeds.`,
      )
    },
  })

  type SaveResult = {
    basisId: string
    closeAfterSave: boolean
    autosave: boolean
  }

  const savePromiseRef = React.useRef<Promise<SaveResult> | null>(null)

  const requestSaveAsync = React.useCallback(
    async (payload?: { closeAfterSave?: boolean; autosave?: boolean }) => {
      if (savePromiseRef.current) {
        await savePromiseRef.current.catch(() => undefined)
        if (!hasUnsavedChanges()) {
          if (payload?.closeAfterSave) onOpenChange(false)
          return null
        }
      }

      saveInFlightRef.current = true
      const promise = saveMutation.mutateAsync(payload).finally(() => {
        saveInFlightRef.current = false
        if (savePromiseRef.current === promise) {
          savePromiseRef.current = null
        }
      })
      savePromiseRef.current = promise
      return promise
    },
    [saveMutation, hasUnsavedChanges, onOpenChange],
  )

  const requestSave = React.useCallback(
    (payload?: { closeAfterSave?: boolean; autosave?: boolean }) => {
      if (saveInFlightRef.current || savePromiseRef.current) return
      void requestSaveAsync(payload)
    },
    [requestSaveAsync],
  )

  const importFromBookingsMutation = useMutation({
    mutationFn: async () => {
      return await createOfferBasisFromBookings({
        jobId,
        companyId,
        basisId: persistedBasisId ?? undefined,
      })
    },
    onSuccess: async (savedBasisId) => {
      await qc.invalidateQueries({ queryKey: ['job-offer-bases', jobId] })
      await qc.invalidateQueries({
        queryKey: ['offer-basis-detail', savedBasisId],
      })
      await qc.invalidateQueries({
        queryKey: ['offer-basis-locked', savedBasisId],
      })
      await qc.invalidateQueries({
        queryKey: ['offer-basis-details-batch'],
      })

      const detail = await qc.fetchQuery(offerBasisDetailQuery(savedBasisId))
      if (detail) {
        const parsed = lineItemsFromBasisDetail(detail, defaultCrewRatePerHour)
        setEquipmentGroups(parsed.equipmentGroups)
        setCrewItems(parsed.crewItems)
        setTransportGroups(parsed.transportGroups)
        setBasisTitle(detail.title)
        setDaysOfUse(detail.days_of_use)
        setDiscountPercent(detail.discount_percent)
        setVatPercent(detail.vat_percent === 0 ? 0 : 25)
        setDaysOfUseDraft(null)
        setDiscountPercentDraft(null)
        const nextBaseline = serializeBasisEditorState({
          basisTitle: detail.title,
          daysOfUse: detail.days_of_use,
          discountPercent: detail.discount_percent,
          vatPercent: detail.vat_percent === 0 ? 0 : 25,
          equipmentGroups: parsed.equipmentGroups,
          crewItems: parsed.crewItems,
          transportGroups: parsed.transportGroups,
        })
        baselineSerializedRef.current = nextBaseline
        setBaselineSerialized(nextBaseline)
      }

      setCurrentBasisId(savedBasisId)
      initializedBasisIdRef.current = savedBasisId

      success(
        'Imported from bookings',
        'Equipment, crew, and transport were loaded from current job bookings.',
      )
      onSaved?.(savedBasisId)
    },
    onError: (e: any) => {
      toastError(
        'Failed to import from bookings',
        e?.message ?? 'Please try again.',
      )
    },
  })

  const isLoading = isLoadingJob || (hasPersistedBasis && isLoadingBasis)
  const baselineHadLineItems = React.useMemo(() => {
    if (!baselineSerialized) return false
    try {
      const parsed = JSON.parse(baselineSerialized) as {
        equipmentGroups?: Array<{ items: Array<unknown> }>
        crewItems?: Array<unknown>
        transportGroups?: Array<{ items: Array<unknown> }>
      }
      return editorStateHasLineItems({
        equipmentGroups: parsed.equipmentGroups ?? [],
        crewItems: parsed.crewItems ?? [],
        transportGroups: parsed.transportGroups ?? [],
      })
    } catch {
      return false
    }
  }, [baselineSerialized])

  const requestImportFromBookings = () => {
    if (
      saveMutation.isPending ||
      importFromBookingsMutation.isPending ||
      saveInFlightRef.current
    ) {
      return
    }
    if (
      editorStateHasLineItems({
        equipmentGroups,
        crewItems,
        transportGroups,
      })
    ) {
      setImportConfirmOpen(true)
      return
    }
    importFromBookingsMutation.mutate()
  }

  useOfferEditorAutosave({
    enabled: open && !isReadOnly && !isLoading && baselineSerialized !== null,
    hasUnsavedChanges,
    isSaving: saveMutation.isPending || importFromBookingsMutation.isPending,
    canSave: () => {
      if (importFromBookingsMutation.isPending || saveInFlightRef.current) {
        return false
      }
      return canAutosaveOfferBasisState({
        baselineHadLineItems,
        current: editorFormRef.current,
      })
    },
    save: () => requestSave({ autosave: true }),
  })

  const handleDialogOpenChange = (next: boolean) => {
    if (next) return
    if (closeGuardOpen) return
    if (!isReadOnly && hasUnsavedChanges()) {
      setCloseGuardOpen(true)
      return
    }
    onOpenChange(false)
  }

  const saveFromCloseGuardAndExit = async () => {
    if (closeGuardActionRef.current || saveInFlightRef.current) return
    closeGuardActionRef.current = true
    try {
      await requestSaveAsync({ closeAfterSave: true })
      setCloseGuardOpen(false)
    } catch {
      // mutation shows error, or save already in progress
    } finally {
      closeGuardActionRef.current = false
    }
  }

  const discardFromCloseGuard = () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    closeGuardActionRef.current = true
    setCloseGuardOpen(false)
    onOpenChange(false)
    closeGuardActionRef.current = false
  }

  const keepEditingFromCloseGuard = () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    setCloseGuardOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Content
        align="center"
        maxWidth="1280px"
        className={OFFER_EDITOR_DIALOG_CLASS}
        style={offerEditorDialogContentStyle}
        onPointerDownOutside={(event) => {
          if (closeGuardOpen) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (closeGuardOpen) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (closeGuardOpen) {
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
            <Dialog.Title style={{ margin: 0 }}>Offer Basis</Dialog.Title>
            {!isReadOnly ? (
              <Flex gap="2" wrap="wrap">
                <Button
                  size="2"
                  variant="soft"
                  onClick={requestImportFromBookings}
                  disabled={
                    importFromBookingsMutation.isPending ||
                    saveMutation.isPending ||
                    isLoading
                  }
                >
                  <Import width={16} height={16} />
                  Import from bookings
                </Button>
                <Button
                  size="2"
                  onClick={() => requestSave({})}
                  disabled={
                    saveMutation.isPending ||
                    importFromBookingsMutation.isPending ||
                    isLoading
                  }
                >
                  Save
                </Button>
              </Flex>
            ) : null}
          </Flex>

          {isReadOnly ? (
            <Flex align="center" gap="2">
              <Lock width={14} height={14} />
              <Text size="2" color="gray">
                Read-only — unlock or duplicate the linked offer to make
                changes.
              </Text>
            </Flex>
          ) : null}

          {isLoading ? (
            <Flex align="center" justify="center" style={{ flex: 1 }}>
              <Text color="gray">Loading…</Text>
            </Flex>
          ) : (
            <Flex
              direction="column"
              gap="3"
              style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <Flex gap="3" wrap="wrap">
                <Box style={{ flex: 2, minWidth: 220 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Title
                  </Text>
                  <TextField.Root
                    value={basisTitle}
                    readOnly={isReadOnly}
                    onChange={(e) => setBasisTitle(e.target.value)}
                  />
                </Box>
                <Box style={{ width: 120 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Days
                  </Text>
                  <TextField.Root
                    type="number"
                    min="1"
                    value={daysOfUseDraft ?? String(daysOfUse)}
                    readOnly={isReadOnly}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      setDaysOfUseDraft(nextValue)
                      if (nextValue === '') return
                      const parsed = Number(nextValue)
                      if (Number.isNaN(parsed)) return
                      setDaysOfUse(Math.max(1, parsed))
                      setDaysOfUseDraft(null)
                    }}
                    onBlur={() => {
                      if (daysOfUseDraft === '') setDaysOfUseDraft(null)
                    }}
                  />
                </Box>
                <Box style={{ width: 120 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Discount
                  </Text>
                  <TextField.Root
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentDraft ?? String(discountPercent)}
                    readOnly={isReadOnly}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      setDiscountPercentDraft(nextValue)
                      if (nextValue === '') return
                      const parsed = Number(nextValue)
                      if (Number.isNaN(parsed)) return
                      setDiscountPercent(Math.max(0, Math.min(100, parsed)))
                      setDiscountPercentDraft(null)
                    }}
                    onBlur={() => {
                      if (discountPercentDraft === '') {
                        setDiscountPercentDraft(null)
                      }
                    }}
                  />
                </Box>
                <Box style={{ width: 120 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    VAT
                  </Text>
                  <Select.Root
                    value={String(vatPercent)}
                    disabled={isReadOnly}
                    onValueChange={(v) => setVatPercent(v === '0' ? 0 : 25)}
                  >
                    <Select.Trigger />
                    <Select.Content style={{ zIndex: 10000 }}>
                      <Select.Item value="25">25%</Select.Item>
                      <Select.Item value="0">0%</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
              </Flex>

              <Text size="1" color="gray">
                Days and discount apply to equipment only. VAT applies to the
                entire basis and linked offers.
              </Text>

              <Separator size="4" />

              <Tabs.Root
                defaultValue="equipment"
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <AnimatedTabsList>
                  <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
                  <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
                  <Tabs.Trigger value="transport">Transport</Tabs.Trigger>
                  <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
                </AnimatedTabsList>

                <Box
                  pt="3"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                  }}
                >
                  <Tabs.Content value="equipment">
                    <EquipmentSection
                      groups={equipmentGroups}
                      onGroupsChange={setEquipmentGroups}
                      expandedGroups={expandedGroups}
                      onExpandedGroupsChange={setExpandedGroups}
                      companyId={companyId}
                      equipmentDaysOfUse={daysOfUse}
                      equipmentRentalFactor={equipmentRentalFactor}
                      readOnly={isReadOnly}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="crew">
                    <CrewSection
                      items={crewItems}
                      onItemsChange={setCrewItems}
                      companyId={companyId}
                      readOnly={isReadOnly}
                      jobStartAt={job.start_at}
                      jobEndAt={job.end_at}
                      defaultRatePerDay={defaultCrewRatePerDay}
                      defaultRatePerHour={defaultCrewRatePerHour}
                      defaultBillingUnit={defaultCrewBillingUnit}
                      defaultsLoading={!!jobId && isLoadingJob}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="transport">
                    <TransportSection
                      groups={transportGroups}
                      onGroupsChange={setTransportGroups}
                      companyId={companyId}
                      readOnly={isReadOnly}
                      jobStartAt={job.start_at}
                      jobEndAt={job.end_at}
                      vehicleDailyRate={
                        companyExpansion?.vehicle_daily_rate ?? null
                      }
                      vehicleDistanceRate={
                        companyExpansion?.vehicle_distance_rate ?? null
                      }
                      vehicleDistanceIncrement={
                        companyExpansion?.vehicle_distance_increment ?? 150
                      }
                    />
                  </Tabs.Content>

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
        onKeepEditing={keepEditingFromCloseGuard}
        onDiscard={discardFromCloseGuard}
        onSaveAndClose={() => void saveFromCloseGuardAndExit()}
      />

      <Dialog.Root
        open={importConfirmOpen}
        onOpenChange={(next) => {
          // Buttons only — ignore dismiss gestures.
          if (next) setImportConfirmOpen(true)
        }}
      >
        <Dialog.Content
          maxWidth="480px"
          style={{ zIndex: 101 }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <Dialog.Title>Replace offer basis from bookings?</Dialog.Title>
          <Separator my="3" />
          <Text size="2">
            This replaces the current equipment, crew, and transport lines with
            whatever is booked on the job. Unsaved edits in this dialog will be
            lost.
          </Text>
          <Flex gap="2" mt="4" justify="end" wrap="wrap">
            <Button
              variant="soft"
              onClick={() => setImportConfirmOpen(false)}
              disabled={importFromBookingsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                setImportConfirmOpen(false)
                importFromBookingsMutation.mutate()
              }}
              disabled={
                importFromBookingsMutation.isPending || saveMutation.isPending
              }
            >
              {importFromBookingsMutation.isPending
                ? 'Importing…'
                : 'Replace from bookings'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Dialog.Root>
  )
}
