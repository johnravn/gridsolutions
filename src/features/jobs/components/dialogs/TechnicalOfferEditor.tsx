// src/features/jobs/components/dialogs/TechnicalOfferEditor.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Separator,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Download, Eye, Lock, Refresh } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { sendOfferByEmail } from '@shared/email/supabaseEdgeEmail'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  companyExpansionQuery,
  crewPricingLevelsQuery,
} from '@features/company/api/queries'
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
import { calculateHoursPerDay } from './technical-offer-editor/utils'
import { CrewSection } from './technical-offer-editor/CrewSection'
import { EquipmentSection } from './technical-offer-editor/EquipmentSection'
import { Field } from './technical-offer-editor/Field'
import { TotalsSection } from './technical-offer-editor/TotalsSection'
import { TransportSection } from './technical-offer-editor/TransportSection'
import type { RentalFactorConfig } from '../../utils/offerCalculations'
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../../types'
import type {
  LocalCrewItem,
  LocalEquipmentGroup,
  LocalEquipmentItem,
  LocalTransportGroup,
  LocalTransportItem,
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
      id: string
      name: string
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
  daysOfUse: number
  discountPercent: number
  vatPercent: number
  showPricePerLine: boolean
  equipmentGroups: Array<LocalEquipmentGroup>
  crewItems: Array<LocalCrewItem>
  transportGroups: Array<LocalTransportGroup>
}): string {
  const packEquipmentItem = (it: LocalEquipmentItem) => ({
    id: it.id,
    item_id: it.item_id,
    group_id: it.group_id,
    quantity: it.quantity,
    unit_price: it.unit_price,
    is_internal: it.is_internal,
    sort_order: it.sort_order,
    custom_line_description: it.custom_line_description ?? null,
    custom_line_brand: it.custom_line_brand ?? null,
    custom_line_model: it.custom_line_model ?? null,
  })

  const packTransportItem = (it: LocalTransportItem) => ({
    id: it.id,
    transport_group_id: it.transport_group_id ?? null,
    vehicle_name: it.vehicle_name,
    vehicle_id: it.vehicle_id,
    vehicle_category: it.vehicle_category,
    distance_km: it.distance_km,
    start_date: it.start_date,
    end_date: it.end_date,
    days_used: it.days_used ?? null,
    daily_rate_count: it.daily_rate_count ?? null,
    daily_rate: it.daily_rate,
    distance_rate: it.distance_rate,
    is_internal: it.is_internal,
    sort_order: it.sort_order,
  })

  const equipment = [...s.equipmentGroups]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((g) => ({
      id: g.id,
      group_name: g.group_name,
      sort_order: g.sort_order,
      items: [...g.items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(packEquipmentItem),
    }))

  const crew = [...s.crewItems]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      role_title: c.role_title,
      crew_count: c.crew_count,
      start_date: c.start_date,
      end_date: c.end_date,
      daily_rate: c.daily_rate,
      hourly_rate: c.hourly_rate,
      hours_per_day: c.hours_per_day,
      billing_type: c.billing_type,
      sort_order: c.sort_order,
      role_category: c.role_category ?? null,
    }))

  const transport = [...s.transportGroups]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((g) => ({
      id: g.id,
      group_name: g.group_name,
      sort_order: g.sort_order,
      items: [...g.items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(packTransportItem),
    }))

  return JSON.stringify({
    title: s.title.trim(),
    daysOfUse: s.daysOfUse,
    discountPercent: s.discountPercent,
    vatPercent: s.vatPercent,
    showPricePerLine: s.showPricePerLine,
    equipment,
    crew,
    transport,
  })
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null // If provided, edit mode; otherwise create mode
  onSaved?: (offerId: string) => void
  onSyncBookingsAfterSave?: (offerId: string) => void
}

export default function TechnicalOfferEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  offerId,
  onSaved,
  onSyncBookingsAfterSave,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const [currentOfferId, setCurrentOfferId] = React.useState<string | null>(
    offerId || null,
  )
  const persistedOfferId = offerId ?? currentOfferId
  const hasPersistedOffer = !!persistedOfferId

  // Fetch job title, duration, customer (incl. crew pricing level), and main contact for offer email
  const { data: jobData, isLoading: isLoadingJob } = useQuery<JobInfo>({
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
            crew_pricing_level:crew_pricing_level_id ( id, name, crew_rate_per_day, crew_rate_per_hour, default_crew_billing_unit )
          ),
          customer_contact:customer_contact_id ( id, name, email )`,
        )
        .eq('id', jobId)
        .single()
      if (error) throw error

      // Normalize customer relationship (PostgREST can return as array or object)
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
          ? ({
              id: customer.id,
              is_partner: customer.is_partner ?? false,
              crew_pricing_level_id: customer.crew_pricing_level_id ?? null,
              crew_pricing_level: Array.isArray(customer.crew_pricing_level)
                ? customer.crew_pricing_level[0]
                : (customer.crew_pricing_level ?? null),
            } as JobInfo['customer'])
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

  // Fetch company crew pricing levels (for fallback when customer has no level)
  const { data: crewPricingLevels } = useQuery({
    ...crewPricingLevelsQuery(companyId),
    enabled: open && !!companyId && typeof companyId === 'string',
  })

  const firstCompanyCrewLevel = crewPricingLevels?.[0] ?? null

  // Fetch company expansion for default rates and rental factors
  const { data: companyExpansion } = useQuery({
    ...companyExpansionQuery({ companyId }),
    enabled: open && !!companyId && typeof companyId === 'string',
  })

  // Effective crew rates: use customer's pricing level if set, else first company level, else company expansion
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

  // Parse rental factor config from company expansion
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

  // Fetch existing offer if editing or if we have a current offer ID (after saving)
  const { data: existingOffer, isLoading: isLoadingOffer } = useQuery({
    ...(currentOfferId
      ? offerDetailQuery(currentOfferId)
      : { queryKey: ['no-offer'], queryFn: () => null }),
    enabled: open && !!currentOfferId,
  })

  const isReadOnly = existingOffer?.locked || false

  // Default title based on job
  const defaultTitle = job.title ? `Offer for ${job.title}` : ''

  // Calculate default days of use from job duration
  const defaultDaysOfUse = React.useMemo(() => {
    if (!job.start_at || !job.end_at) return 1
    const start = new Date(job.start_at)
    const end = new Date(job.end_at)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays) // Ensure at least 1 day
  }, [job.start_at, job.end_at])

  // Offer metadata
  const [title, setTitle] = React.useState('')
  const [daysOfUse, setDaysOfUse] = React.useState(defaultDaysOfUse)
  const [discountPercent, setDiscountPercent] = React.useState(0)
  const [vatPercent, setVatPercent] = React.useState(25)
  const [showPricePerLine, setShowPricePerLine] = React.useState(true)
  const [daysOfUseDraft, setDaysOfUseDraft] = React.useState<string | null>(
    null,
  )
  const [discountPercentDraft, setDiscountPercentDraft] = React.useState<
    string | null
  >(null)
  const [closeGuardOpen, setCloseGuardOpen] = React.useState(false)
  const [lockSendStep, setLockSendStep] = React.useState<
    null | 'choose' | 'email'
  >(null)
  const [gridEmailDraft, setGridEmailDraft] = React.useState('')
  const [syncRunning, setSyncRunning] = React.useState(false)
  const [lockSendBusy, setLockSendBusy] = React.useState(false)

  const [baselineSerialized, setBaselineSerialized] = React.useState<
    string | null
  >(null)
  const editorFormRef = React.useRef({
    title: '',
    daysOfUse: 1,
    discountPercent: 0,
    vatPercent: 25,
    showPricePerLine: true,
    equipmentGroups: [] as Array<LocalEquipmentGroup>,
    crewItems: [] as Array<LocalCrewItem>,
    transportGroups: [] as Array<LocalTransportGroup>,
  })
  const lockOutcomeRef = React.useRef<'close' | 'stay_open'>('close')

  // Equipment groups and items
  const [equipmentGroups, setEquipmentGroups] = React.useState<
    Array<LocalEquipmentGroup>
  >([])
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )

  // Crew items
  const [crewItems, setCrewItems] = React.useState<Array<LocalCrewItem>>([])

  // Transport groups and items
  const [transportGroups, setTransportGroups] = React.useState<
    Array<LocalTransportGroup>
  >([])

  editorFormRef.current = {
    title,
    daysOfUse,
    discountPercent,
    vatPercent,
    showPricePerLine,
    equipmentGroups,
    crewItems,
    transportGroups,
  }

  const hasUnsavedChanges = React.useCallback(() => {
    if (!open || isReadOnly) return false
    if (baselineSerialized === null) return false
    return (
      serializeOfferEditorState({
        title: editorFormRef.current.title.trim(),
        daysOfUse: editorFormRef.current.daysOfUse,
        discountPercent: editorFormRef.current.discountPercent,
        vatPercent: editorFormRef.current.vatPercent,
        showPricePerLine: editorFormRef.current.showPricePerLine,
        equipmentGroups: editorFormRef.current.equipmentGroups,
        crewItems: editorFormRef.current.crewItems,
        transportGroups: editorFormRef.current.transportGroups,
      }) !== baselineSerialized
    )
  }, [
    open,
    isReadOnly,
    baselineSerialized,
    title,
    daysOfUse,
    discountPercent,
    vatPercent,
    showPricePerLine,
    equipmentGroups,
    crewItems,
    transportGroups,
  ])

  React.useEffect(() => {
    if (!open) {
      setBaselineSerialized(null)
      setCloseGuardOpen(false)
      setLockSendStep(null)
      setGridEmailDraft('')
    }
  }, [open])

  // Update currentOfferId when offerId prop changes
  React.useEffect(() => {
    if (offerId) {
      setCurrentOfferId(offerId)
    }
  }, [offerId])

  // Update daysOfUse when job duration becomes available (only for new offers)
  React.useEffect(() => {
    if (!open || hasPersistedOffer || !job.start_at || !job.end_at) return
    setDaysOfUse(defaultDaysOfUse)
    setDaysOfUseDraft(null)
  }, [open, hasPersistedOffer, defaultDaysOfUse, job.start_at, job.end_at])

  // Initialize from existing offer
  React.useEffect(() => {
    if (!open) return
    // Wait for query to finish loading before initializing
    if (isLoadingOffer) return

    if (existingOffer && currentOfferId) {
      setTitle(existingOffer.title)
      setDaysOfUse(existingOffer.days_of_use)
      setDiscountPercent(existingOffer.discount_percent)
      setDaysOfUseDraft(null)
      setDiscountPercentDraft(null)
      // Normalize VAT to 0 or 25
      const normalizedVat =
        existingOffer.vat_percent === 0 || existingOffer.vat_percent === 25
          ? existingOffer.vat_percent
          : 25
      setVatPercent(normalizedVat)
      setShowPricePerLine(existingOffer.show_price_per_line)

      // Convert equipment groups
      const groups: Array<LocalEquipmentGroup> =
        existingOffer.groups?.map((group) => ({
          id: group.id,
          group_name: group.group_name,
          sort_order: group.sort_order,
          items: group.items.map((item) => {
            const rawItem = item.item as any
            const rawBrand = rawItem?.brand
            const brand = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand
            const rawGroup = (item as any).group
            return {
              id: item.id,
              item_id: item.item_id,
              group_id: item.group_id ?? null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              is_internal: item.is_internal,
              sort_order: item.sort_order,
              custom_line_description:
                (item as any).custom_line_description ?? null,
              custom_line_brand: (item as any).custom_line_brand ?? null,
              custom_line_model: (item as any).custom_line_model ?? null,
              item: rawItem
                ? {
                    id: rawItem.id,
                    name: rawItem.name,
                    externally_owned: !rawItem.internally_owned,
                    external_owner_id: rawItem.external_owner_id ?? null,
                    external_owner_name: rawItem.external_owner?.name ?? null,
                    brand: brand ?? null,
                    model: rawItem.model ?? null,
                  }
                : null,
              group: rawGroup
                ? {
                    id: rawGroup.id,
                    name: rawGroup.name,
                    externally_owned: !rawGroup.internally_owned,
                    external_owner_id: rawGroup.external_owner_id ?? null,
                    external_owner_name: rawGroup.external_owner?.name ?? null,
                  }
                : null,
            }
          }),
        })) || []
      setEquipmentGroups(groups)

      // Convert crew items
      const crew: Array<LocalCrewItem> =
        existingOffer.crew_items?.map((item) => {
          const rawItem: any = item

          const billingType: 'daily' | 'hourly' =
            rawItem?.billing_type === 'hourly' ? 'hourly' : 'daily'

          const hoursFromDates = calculateHoursPerDay(
            item.start_date,
            item.end_date,
          )

          const baseHoursPerDay =
            billingType === 'hourly'
              ? (hoursFromDates ?? rawItem?.hours_per_day ?? 8)
              : null

          const baseHourlyRate =
            billingType === 'hourly'
              ? (rawItem?.hourly_rate ??
                (baseHoursPerDay && baseHoursPerDay > 0
                  ? item.daily_rate / baseHoursPerDay
                  : (defaultCrewRatePerHour ?? null)))
              : null

          const normalizedDailyRate =
            billingType === 'hourly'
              ? (baseHourlyRate ?? 0) * (baseHoursPerDay ?? 0)
              : item.daily_rate

          return {
            id: item.id,
            role_title: item.role_title,
            crew_count: item.crew_count,
            start_date: item.start_date,
            end_date: item.end_date,
            daily_rate: normalizedDailyRate,
            hourly_rate: billingType === 'hourly' ? baseHourlyRate : null,
            hours_per_day: billingType === 'hourly' ? baseHoursPerDay : null,
            billing_type: billingType,
            sort_order: item.sort_order,
            role_category: rawItem?.role_category ?? null,
          }
        }) || []
      setCrewItems(crew)

      let transportBaseline: Array<LocalTransportGroup>
      const fromTransportGroups = existingOffer.transport_groups
      if (fromTransportGroups && fromTransportGroups.length > 0) {
        transportBaseline = fromTransportGroups.map((group) => ({
          id: group.id,
          group_name: group.group_name,
          sort_order: group.sort_order,
          items: group.items.map((item) => ({
            id: item.id,
            transport_group_id: group.id,
            vehicle_name: item.vehicle_name,
            vehicle_id: item.vehicle_id ?? null,
            vehicle_category: item.vehicle_category ?? null,
            distance_km: item.distance_km ?? null,
            start_date: item.start_date,
            end_date: item.end_date,
            days_used: item.days_used ?? null,
            daily_rate_count: item.daily_rate_count ?? null,
            daily_rate: item.daily_rate > 0 ? item.daily_rate : null,
            distance_rate: item.distance_rate ?? null,
            is_internal: item.is_internal,
            sort_order: item.sort_order,
            vehicle: item.vehicle ?? null,
          })),
        }))
        setTransportGroups(transportBaseline)
      } else if (
        existingOffer.transport_items &&
        existingOffer.transport_items.length > 0
      ) {
        const gid = `temp-${Date.now()}-tg`
        transportBaseline = [
          {
            id: gid,
            group_name: 'Transport',
            sort_order: 0,
            items: existingOffer.transport_items.map((item) => ({
              id: item.id,
              transport_group_id: gid,
              vehicle_name: item.vehicle_name,
              vehicle_id: item.vehicle_id ?? null,
              vehicle_category: item.vehicle_category ?? null,
              distance_km: item.distance_km ?? null,
              start_date: item.start_date,
              end_date: item.end_date,
              days_used: item.days_used ?? null,
              daily_rate_count: item.daily_rate_count ?? null,
              daily_rate: item.daily_rate > 0 ? item.daily_rate : null,
              distance_rate: item.distance_rate ?? null,
              is_internal: item.is_internal,
              sort_order: item.sort_order,
              vehicle: item.vehicle ?? null,
            })),
          },
        ]
        setTransportGroups(transportBaseline)
      } else {
        transportBaseline = []
        setTransportGroups([])
      }

      setBaselineSerialized(
        serializeOfferEditorState({
          title: existingOffer.title.trim(),
          daysOfUse: existingOffer.days_of_use,
          discountPercent: existingOffer.discount_percent,
          vatPercent: normalizedVat,
          showPricePerLine: existingOffer.show_price_per_line,
          equipmentGroups: groups,
          crewItems: crew,
          transportGroups: transportBaseline,
        }),
      )
    } else {
      // Reset for new offer
      setTitle(defaultTitle)
      setDaysOfUse(defaultDaysOfUse)

      // Set default discount based on customer type (partner vs regular customer)
      let defaultDiscount = 0
      if (companyExpansion && job.customer) {
        if (
          job.customer.is_partner &&
          companyExpansion.partner_discount_percent !== null
        ) {
          defaultDiscount = companyExpansion.partner_discount_percent
        } else if (
          !job.customer.is_partner &&
          companyExpansion.customer_discount_percent !== null
        ) {
          defaultDiscount = companyExpansion.customer_discount_percent
        }
      }
      setDiscountPercent(defaultDiscount)

      setVatPercent(25)
      setShowPricePerLine(true)
      setEquipmentGroups([])
      setCrewItems([])
      setTransportGroups([])
      setExpandedGroups(new Set())
      setCurrentOfferId(null)

      setBaselineSerialized(
        serializeOfferEditorState({
          title: defaultTitle.trim(),
          daysOfUse: defaultDaysOfUse,
          discountPercent: defaultDiscount,
          vatPercent: 25,
          showPricePerLine: true,
          equipmentGroups: [],
          crewItems: [],
          transportGroups: [],
        }),
      )
    }
  }, [
    open,
    existingOffer,
    currentOfferId,
    defaultTitle,
    defaultDaysOfUse,
    companyExpansion,
    job,
    isLoadingOffer,
    hasPersistedOffer,
    defaultCrewRatePerHour,
  ])

  // Calculate totals
  const totals = React.useMemo(() => {
    const equipmentItems: Array<OfferEquipmentItem> = equipmentGroups.flatMap(
      (group) =>
        group.items.map((item) => ({
          id: item.id,
          offer_group_id: group.id,
          item_id: item.item_id,
          group_id: item.group_id ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          item: item.item,
          group: item.group ?? undefined,
        })),
    )

    const crew: Array<OfferCrewItem> = crewItems.map((item) => ({
      id: item.id,
      offer_id: persistedOfferId || '',
      role_title: item.role_title,
      role_category: item.role_category ?? null,
      crew_count: item.crew_count,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: 0, // Will be calculated
      sort_order: item.sort_order,
    }))

    const transport: Array<OfferTransportItem> = transportGroups.flatMap(
      (group) =>
        group.items.map((item) => ({
          id: item.id,
          offer_id: persistedOfferId || '',
          transport_group_id:
            group.id as OfferTransportItem['transport_group_id'],
          vehicle_name: item.vehicle_name,
          vehicle_id: item.vehicle_id,
          vehicle_category: item.vehicle_category,
          distance_km: item.distance_km,
          start_date: item.start_date,
          end_date: item.end_date,
          days_used: item.days_used,
          daily_rate_count: item.daily_rate_count,
          daily_rate:
            item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0,
          distance_rate: item.distance_rate ?? null,
          total_price: 0, // Will be calculated
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          vehicle: item.vehicle,
        })),
    )

    const distanceIncrement = Math.max(
      1,
      companyExpansion?.vehicle_distance_increment ?? 150,
    )
    const transportSubtotal = transportGroups.reduce(
      (sum, group) =>
        sum +
        group.items.reduce((itemSum, item) => {
          const days = Math.ceil(
            (new Date(item.end_date).getTime() -
              new Date(item.start_date).getTime()) /
              (1000 * 60 * 60 * 24),
          )
          const derivedDays = Math.max(1, days)
          const daysUsed = item.days_used ?? derivedDays
          const effectiveDailyRate =
            item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0
          const dailyCost = effectiveDailyRate * Math.max(0, daysUsed)
          const distanceRate =
            item.distance_rate ??
            companyExpansion?.vehicle_distance_rate ??
            null
          const distanceIncrements = item.distance_km
            ? Math.ceil(item.distance_km / distanceIncrement)
            : 0
          const distanceCost =
            distanceRate && distanceIncrements > 0
              ? distanceRate * distanceIncrements
              : 0
          return itemSum + dailyCost + distanceCost
        }, 0),
      0,
    )

    const baseTotals = calculateOfferTotals(
      equipmentItems,
      crew,
      transport,
      daysOfUse,
      discountPercent,
      vatPercent,
      rentalFactorConfig,
      companyExpansion?.vehicle_distance_rate,
      companyExpansion?.vehicle_distance_increment,
    )

    // Override transport subtotal with our custom calculation that uses item-specific rates
    // and recompute dependent totals so the breakdown stays consistent.
    const totalBeforeDiscount =
      baseTotals.equipmentSubtotal + baseTotals.crewSubtotal + transportSubtotal
    const discountAmount = baseTotals.discountAmount
    const totalAfterDiscount = totalBeforeDiscount - discountAmount
    const totalWithVAT =
      totalAfterDiscount + (totalAfterDiscount * vatPercent) / 100

    // Round monetary values to 2 decimals to avoid floating-point display issues
    const round2 = (n: number) => Math.round(n * 100) / 100
    return {
      ...baseTotals,
      equipmentSubtotal: round2(baseTotals.equipmentSubtotal),
      crewSubtotal: round2(baseTotals.crewSubtotal),
      transportSubtotal: round2(transportSubtotal),
      totalBeforeDiscount: round2(totalBeforeDiscount),
      totalAfterDiscount: round2(totalAfterDiscount),
      totalWithVAT: round2(totalWithVAT),
      discountAmount: round2(discountAmount),
    }
  }, [
    equipmentGroups,
    crewItems,
    transportGroups,
    daysOfUse,
    discountPercent,
    vatPercent,
    rentalFactorConfig,
    persistedOfferId,
    companyExpansion?.vehicle_daily_rate,
    companyExpansion?.vehicle_distance_rate,
    companyExpansion?.vehicle_distance_increment,
  ])

  const saveMutation = useMutation({
    mutationFn: async (payload?: {
      syncAfterSave?: boolean
      closeAfterSave?: boolean
    }) => {
      if (!title.trim()) {
        throw new Error('Title is required')
      }

      const persistedBefore = offerId ?? currentOfferId
      let workingOfferId: string
      let createdNew = false

      // Create offer only when nothing exists yet (prop + local)
      if (!persistedBefore) {
        createdNew = true
        workingOfferId = await createOffer({
          jobId,
          companyId,
          offerType: 'technical',
          title: title.trim(),
          daysOfUse,
          discountPercent,
          vatPercent,
          showPricePerLine,
        })
      } else {
        workingOfferId = persistedBefore
        // Update offer metadata
        const { error } = await supabase
          .from('job_offers')
          .update({
            title: title.trim(),
            days_of_use: daysOfUse,
            discount_percent: discountPercent,
            vat_percent: vatPercent,
            show_price_per_line: showPricePerLine,
          })
          .eq('id', workingOfferId)

        if (error) throw error
      }

      // Delete existing groups and items if editing
      if (workingOfferId && existingOffer) {
        // Delete equipment items first (foreign key constraint)
        if (existingOffer.groups && existingOffer.groups.length > 0) {
          const groupIds = existingOffer.groups.map((g) => g.id)
          const { error: itemsErr } = await supabase
            .from('offer_equipment_items')
            .delete()
            .in('offer_group_id', groupIds)
          if (itemsErr) throw itemsErr

          // Delete groups
          const { error: groupsErr } = await supabase
            .from('offer_equipment_groups')
            .delete()
            .eq('offer_id', workingOfferId)
          if (groupsErr) throw groupsErr
        }

        // Delete crew items
        if (existingOffer.crew_items && existingOffer.crew_items.length > 0) {
          const { error: crewErr } = await supabase
            .from('offer_crew_items')
            .delete()
            .eq('offer_id', workingOfferId)
          if (crewErr) throw crewErr
        }

        // Delete transport groups (cascades to items). Table may be absent from generated DB types until types are refreshed.
        const { error: transportGroupsDelErr } = await (supabase as any)
          .from('offer_transport_groups')
          .delete()
          .eq('offer_id', workingOfferId)
        if (transportGroupsDelErr) throw transportGroupsDelErr
      }

      const equipmentRentalFactor = calculateRentalFactor(
        daysOfUse,
        rentalFactorConfig,
      )
      const roundMoney = (value: number) => Math.round(value * 100) / 100

      // Save equipment groups and items
      for (const group of equipmentGroups) {
        const isExistingGroup = !group.id.startsWith('temp-')

        let groupId: string
        if (isExistingGroup) {
          const { data: upsertedGroup, error: groupErr } = await supabase
            .from('offer_equipment_groups')
            .upsert({
              id: group.id,
              offer_id: workingOfferId,
              group_name: group.group_name,
              sort_order: group.sort_order,
            })
            .select('id')
            .single()

          if (groupErr) throw groupErr
          groupId = upsertedGroup.id
        } else {
          // Create new group
          const { data: newGroup, error: groupErr } = await supabase
            .from('offer_equipment_groups')
            .insert({
              offer_id: workingOfferId,
              group_name: group.group_name,
              sort_order: group.sort_order,
            })
            .select('id')
            .single()

          if (groupErr) throw groupErr
          groupId = newGroup.id
        }

        // Save items in this group
        for (const item of group.items) {
          const isExistingItem = !item.id.startsWith('temp-')
          if (isExistingItem) {
            // Upsert existing item (handles duplicated offers where items were deleted)
            const { error: itemErr } = await supabase
              .from('offer_equipment_items')
              .upsert({
                id: item.id,
                offer_group_id: groupId,
                item_id: item.item_id,
                group_id: item.group_id ?? null,
                custom_line_description:
                  item.custom_line_description?.trim() || null,
                custom_line_brand: item.custom_line_brand?.trim() || null,
                custom_line_model: item.custom_line_model?.trim() || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: roundMoney(
                  item.unit_price * item.quantity * equipmentRentalFactor,
                ),
                is_internal: item.is_internal,
                sort_order: item.sort_order,
              })

            if (itemErr) throw itemErr
          } else {
            // Create new item
            const { error: itemErr } = await supabase
              .from('offer_equipment_items')
              .insert({
                offer_group_id: groupId,
                item_id: item.item_id,
                group_id: item.group_id ?? null,
                custom_line_description:
                  item.custom_line_description?.trim() || null,
                custom_line_brand: item.custom_line_brand?.trim() || null,
                custom_line_model: item.custom_line_model?.trim() || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: roundMoney(
                  item.unit_price * item.quantity * equipmentRentalFactor,
                ),
                is_internal: item.is_internal,
                sort_order: item.sort_order,
              })

            if (itemErr) throw itemErr
          }
        }
      }

      // Save crew items
      for (const item of crewItems) {
        const isExistingItem = !item.id.startsWith('temp-')
        const days = Math.ceil(
          (new Date(item.end_date).getTime() -
            new Date(item.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
        const safeDays = Math.max(1, days)
        let totalPrice = item.daily_rate * item.crew_count * safeDays
        if (item.billing_type === 'hourly' && item.hourly_rate !== null) {
          const hoursPerDay =
            item.hours_per_day ??
            calculateHoursPerDay(item.start_date, item.end_date) ??
            0
          totalPrice =
            item.hourly_rate * hoursPerDay * item.crew_count * safeDays
        }

        if (isExistingItem) {
          const { error: itemErr } = await supabase
            .from('offer_crew_items')
            .upsert({
              id: item.id,
              offer_id: workingOfferId,
              role_title: item.role_title,
              role_category: item.role_category ?? null,
              crew_count: item.crew_count,
              start_date: item.start_date,
              end_date: item.end_date,
              daily_rate: item.daily_rate,
              hourly_rate:
                item.billing_type === 'hourly' ? item.hourly_rate : null,
              hours_per_day:
                item.billing_type === 'hourly' ? item.hours_per_day : null,
              billing_type: item.billing_type,
              total_price: totalPrice,
              sort_order: item.sort_order,
            })

          if (itemErr) throw itemErr
        } else {
          const { error: itemErr } = await supabase
            .from('offer_crew_items')
            .insert({
              offer_id: workingOfferId,
              role_title: item.role_title,
              role_category: item.role_category ?? null,
              crew_count: item.crew_count,
              start_date: item.start_date,
              end_date: item.end_date,
              daily_rate: item.daily_rate,
              hourly_rate:
                item.billing_type === 'hourly' ? item.hourly_rate : null,
              hours_per_day:
                item.billing_type === 'hourly' ? item.hours_per_day : null,
              billing_type: item.billing_type,
              total_price: totalPrice,
              sort_order: item.sort_order,
            })

          if (itemErr) throw itemErr
        }
      }

      // Save transport groups and items
      const distanceIncrementSave = Math.max(
        1,
        companyExpansion?.vehicle_distance_increment ?? 150,
      )
      for (const group of transportGroups) {
        const isExistingGroup = !group.id.startsWith('temp-')

        let groupId: string
        if (isExistingGroup) {
          const { data: upsertedGroup, error: groupErr } = await (
            supabase as any
          )
            .from('offer_transport_groups')
            .upsert({
              id: group.id,
              offer_id: workingOfferId,
              group_name: group.group_name,
              sort_order: group.sort_order,
            })
            .select('id')
            .single()

          if (groupErr) throw groupErr
          groupId = (upsertedGroup as { id: string }).id
        } else {
          const { data: newGroup, error: groupErr } = await (supabase as any)
            .from('offer_transport_groups')
            .insert({
              offer_id: workingOfferId,
              group_name: group.group_name,
              sort_order: group.sort_order,
            })
            .select('id')
            .single()

          if (groupErr) throw groupErr
          groupId = (newGroup as { id: string }).id
        }

        for (const item of group.items) {
          const isExistingItem = !item.id.startsWith('temp-')
          const days = Math.ceil(
            (new Date(item.end_date).getTime() -
              new Date(item.start_date).getTime()) /
              (1000 * 60 * 60 * 24),
          )
          const derivedDays = Math.max(1, days)
          const daysUsed = item.days_used ?? derivedDays
          const effectiveDailyRate =
            item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0
          const effectiveDistanceRate =
            item.distance_rate ??
            companyExpansion?.vehicle_distance_rate ??
            null
          const distanceIncrements = item.distance_km
            ? Math.ceil(item.distance_km / distanceIncrementSave)
            : 0
          const distanceCost =
            effectiveDistanceRate && distanceIncrements > 0
              ? effectiveDistanceRate * distanceIncrements
              : 0
          const dailyCost = effectiveDailyRate * Math.max(0, daysUsed)
          const totalPrice = dailyCost + distanceCost

          if (isExistingItem) {
            const { error: itemErr } = await (supabase as any)
              .from('offer_transport_items')
              .upsert({
                id: item.id,
                offer_id: workingOfferId,
                transport_group_id: groupId,
                vehicle_name: item.vehicle_name,
                vehicle_id: item.vehicle_id ?? null,
                vehicle_category: item.vehicle_category,
                distance_km: item.distance_km,
                distance_rate: item.distance_rate ?? null,
                start_date: item.start_date,
                end_date: item.end_date,
                days_used: item.days_used ?? null,
                daily_rate_count: item.daily_rate_count ?? null,
                daily_rate: effectiveDailyRate,
                total_price: totalPrice,
                is_internal: item.is_internal,
                sort_order: item.sort_order,
              })

            if (itemErr) throw itemErr
          } else {
            const insertPayload: Record<string, unknown> = {
              offer_id: workingOfferId,
              transport_group_id: groupId,
              vehicle_name: item.vehicle_name,
              vehicle_category: item.vehicle_category,
              distance_km: item.distance_km,
              distance_rate: item.distance_rate ?? null,
              start_date: item.start_date,
              end_date: item.end_date,
              days_used: item.days_used ?? null,
              daily_rate_count: item.daily_rate_count ?? null,
              daily_rate: effectiveDailyRate,
              total_price: totalPrice,
              is_internal: item.is_internal,
              sort_order: item.sort_order,
            }

            if (item.vehicle_id !== null) {
              insertPayload.vehicle_id = item.vehicle_id
            }

            const { error: itemErr } = await (supabase as any)
              .from('offer_transport_items')
              .insert(insertPayload)

            if (itemErr) throw itemErr
          }
        }
      }

      // Recalculate totals (non-blocking - if it fails, offer is still saved)
      try {
        await recalculateOfferTotals(workingOfferId)
      } catch (recalcError) {
        // Log but don't fail the save - totals can be recalculated later
        console.warn('Failed to recalculate offer totals:', recalcError)
        // The offer is still saved successfully, just totals might be stale
      }

      return {
        offerId: workingOfferId,
        createdNew,
        syncAfterSave: !!payload?.syncAfterSave,
        closeAfterSave: payload?.closeAfterSave === true,
      }
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', result.offerId] })
      setCurrentOfferId(result.offerId)
      setBaselineSerialized(
        serializeOfferEditorState({
          title: editorFormRef.current.title.trim(),
          daysOfUse: editorFormRef.current.daysOfUse,
          discountPercent: editorFormRef.current.discountPercent,
          vatPercent: editorFormRef.current.vatPercent,
          showPricePerLine: editorFormRef.current.showPricePerLine,
          equipmentGroups: editorFormRef.current.equipmentGroups,
          crewItems: editorFormRef.current.crewItems,
          transportGroups: editorFormRef.current.transportGroups,
        }),
      )
      success(
        result.createdNew ? 'Offer created' : 'Offer updated',
        `Technical offer "${title.trim()}" was saved successfully.`,
      )

      onSaved?.(result.offerId)
      if (result.syncAfterSave) {
        onSyncBookingsAfterSave?.(result.offerId)
      }
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
    saveMutation.mutate({ closeAfterSave: false })
  }

  const handleSyncBookingsClick = async () => {
    if (!currentOfferId) {
      info('Save required', 'Save the offer first so bookings can be synced.')
      return
    }
    try {
      setSyncRunning(true)
      if (hasUnsavedChanges()) {
        await saveMutation.mutateAsync({ closeAfterSave: false })
      }
      if (onSyncBookingsAfterSave) {
        await onSyncBookingsAfterSave(currentOfferId)
      }
      success('Bookings synced', 'Job bookings now match this offer.')
    } catch (e: any) {
      toastError(
        'Sync failed',
        e?.message ?? 'Could not sync bookings. Try again.',
      )
    } finally {
      setSyncRunning(false)
    }
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
          daysOfUse: editorFormRef.current.daysOfUse,
          discountPercent: editorFormRef.current.discountPercent,
          vatPercent: editorFormRef.current.vatPercent,
          showPricePerLine: editorFormRef.current.showPricePerLine,
          equipmentGroups: editorFormRef.current.equipmentGroups,
          crewItems: editorFormRef.current.crewItems,
          transportGroups: editorFormRef.current.transportGroups,
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
    try {
      await saveMutation.mutateAsync({ closeAfterSave: true })
      setCloseGuardOpen(false)
      onOpenChange(false)
    } catch {
      // mutation shows error
    }
  }

  const discardFromCloseGuard = () => {
    setCloseGuardOpen(false)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOfferDialogOpenChange}>
      <Dialog.Content
        maxWidth="1340px"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '90vh',
          position: 'relative',
        }}
      >
        <Dialog.Title>
          {hasPersistedOffer
            ? 'Edit Technical Offer'
            : 'Create Technical Offer'}
        </Dialog.Title>
        <Dialog.Description>
          {hasPersistedOffer
            ? 'Edit the technical offer details, equipment, crew, and transport items.'
            : 'Create a new technical offer with equipment, crew, and transport items.'}
        </Dialog.Description>
        <Separator my="2" />

        <Tabs.Root
          defaultValue="metadata"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs.List>
            <Tabs.Trigger value="metadata">Metadata</Tabs.Trigger>
            <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
            <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
            <Tabs.Trigger value="transport">Transport</Tabs.Trigger>
            <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
          </Tabs.List>

          <Box
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingTop: '16px',
              paddingBottom: '80px', // Space for fixed buttons
            }}
          >
            {/* Metadata Tab */}
            <Tabs.Content value="metadata">
              <Flex direction="column" gap="3">
                <Field label="Title">
                  <Flex gap="2" align="center">
                    <TextField.Root
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter offer title"
                      readOnly={isReadOnly}
                      style={{ width: '400px' }}
                    />
                    {!isReadOnly && defaultTitle && (
                      <Button
                        size="2"
                        variant="soft"
                        onClick={() => setTitle(defaultTitle)}
                        disabled={title === defaultTitle}
                      >
                        Reset
                      </Button>
                    )}
                  </Flex>
                </Field>

                <Box
                  p="3"
                  style={{
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 8,
                    background: 'var(--gray-a1)',
                  }}
                >
                  <Flex direction="column" gap="2">
                    <Text weight="medium">Equipment pricing</Text>
                    <Text size="1" color="gray">
                      Days of use and discount apply to equipment only.
                    </Text>

                    <Flex gap="3" wrap="wrap" align="end">
                      <Field label="Days of use">
                        <TextField.Root
                          type="number"
                          min="1"
                          value={daysOfUseDraft ?? String(daysOfUse)}
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
                            if (daysOfUseDraft === '') {
                              setDaysOfUseDraft(null)
                            }
                          }}
                          readOnly={isReadOnly}
                          style={{ width: 110 }}
                        />
                      </Field>

                      <Field label="Discount (%)">
                        <TextField.Root
                          type="number"
                          min="0"
                          max="100"
                          value={
                            discountPercentDraft ?? String(discountPercent)
                          }
                          onChange={(e) => {
                            const nextValue = e.target.value
                            setDiscountPercentDraft(nextValue)

                            if (nextValue === '') return
                            const parsed = Number(nextValue)
                            if (Number.isNaN(parsed)) return

                            setDiscountPercent(
                              Math.max(0, Math.min(100, parsed)),
                            )
                            setDiscountPercentDraft(null)
                          }}
                          onBlur={() => {
                            if (discountPercentDraft === '') {
                              setDiscountPercentDraft(null)
                            }
                          }}
                          readOnly={isReadOnly}
                          style={{ width: 110 }}
                        />
                      </Field>
                    </Flex>

                    <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
                      Rental factor: {totals.equipmentRentalFactor.toFixed(2)}x
                    </Text>
                  </Flex>
                </Box>

                <Field label="VAT (%)">
                  <Flex direction="column" gap="1">
                    <Select.Root
                      value={
                        vatPercent === 0 || vatPercent === 25
                          ? String(vatPercent)
                          : '25'
                      }
                      onValueChange={(value) => setVatPercent(Number(value))}
                      disabled={isReadOnly}
                    >
                      <Select.Trigger
                        placeholder="Select VAT"
                        style={{ width: 110 }}
                      />
                      <Select.Content style={{ zIndex: 10000 }}>
                        <Select.Item value="0">0%</Select.Item>
                        <Select.Item value="25">25%</Select.Item>
                      </Select.Content>
                    </Select.Root>
                    <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
                      Applies to the entire offer.
                    </Text>
                  </Flex>
                </Field>

                <Field label="Pricing Display">
                  <Flex align="center" gap="2">
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
                  <Text
                    size="1"
                    color="gray"
                    mt="1"
                    style={{ fontStyle: 'italic' }}
                  >
                    {showPricePerLine
                      ? 'Prices will be shown for each line item in the offer.'
                      : 'Only group totals will be shown. Prices per line item will be hidden.'}
                  </Text>
                </Field>
              </Flex>
            </Tabs.Content>

            {/* Equipment Tab */}
            <Tabs.Content value="equipment">
              <EquipmentSection
                groups={equipmentGroups}
                onGroupsChange={setEquipmentGroups}
                expandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                companyId={companyId}
                equipmentDaysOfUse={daysOfUse}
                equipmentRentalFactor={totals.equipmentRentalFactor}
                readOnly={isReadOnly}
              />
            </Tabs.Content>

            {/* Crew Tab */}
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

            {/* Transport Tab */}
            <Tabs.Content value="transport">
              <TransportSection
                groups={transportGroups}
                onGroupsChange={setTransportGroups}
                companyId={companyId}
                readOnly={isReadOnly}
                jobStartAt={job.start_at}
                jobEndAt={job.end_at}
                vehicleDailyRate={companyExpansion?.vehicle_daily_rate ?? null}
                vehicleDistanceRate={
                  companyExpansion?.vehicle_distance_rate ?? null
                }
                vehicleDistanceIncrement={
                  companyExpansion?.vehicle_distance_increment ?? 150
                }
              />
            </Tabs.Content>

            {/* Totals Tab */}
            <Tabs.Content value="totals">
              <TotalsSection totals={totals} />
            </Tabs.Content>
          </Box>
        </Tabs.Root>

        <Flex
          justify="between"
          align="center"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--color-panel-solid)',
            paddingTop: '12px',
            paddingBottom: '12px',
            paddingLeft: '24px',
            paddingRight: '24px',
            borderTop: '1px solid var(--gray-a6)',
          }}
        >
          <Flex gap="2" wrap="wrap">
            {currentOfferId ? (
              <>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    const token = existingOffer?.access_token
                    if (!token) return
                    const url = `${window.location.origin}/offer/${token}`
                    window.open(url, '_blank')
                  }}
                  disabled={!existingOffer?.access_token}
                  title="Open the public offer page as your customer sees it"
                >
                  <Eye width={14} height={14} />
                  Show preview
                </Button>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    exportPdfMutation.mutate(currentOfferId)
                  }}
                  disabled={exportPdfMutation.isPending}
                >
                  <Download width={14} height={14} />
                  Export PDF
                </Button>
              </>
            ) : null}
          </Flex>
          <Flex gap="2" wrap="wrap" justify="end">
            <Button
              type="button"
              variant="soft"
              onClick={() => handleOfferDialogOpenChange(false)}
            >
              Close
            </Button>
            {!isReadOnly && (
              <>
                <Button
                  type="button"
                  variant="solid"
                  onClick={handleSaveClick}
                  disabled={saveMutation.isPending || !title.trim()}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  color="blue"
                  onClick={() => void handleSyncBookingsClick()}
                  disabled={
                    !currentOfferId ||
                    syncRunning ||
                    saveMutation.isPending ||
                    !title.trim()
                  }
                >
                  <Refresh width={14} height={14} />
                  {syncRunning ? 'Syncing…' : 'Sync'}
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  color="blue"
                  onClick={openLockSendFlow}
                  disabled={
                    !currentOfferId ||
                    !!existingOffer?.locked ||
                    lockOfferMutation.isPending ||
                    lockSendBusy ||
                    !title.trim()
                  }
                >
                  <Lock width={14} height={14} />
                  Lock & send
                </Button>
              </>
            )}
          </Flex>
        </Flex>
      </Dialog.Content>

      <Dialog.Root open={closeGuardOpen} onOpenChange={setCloseGuardOpen}>
        <Dialog.Content maxWidth="480px" style={{ zIndex: 101 }}>
          <Dialog.Title>Unsaved changes</Dialog.Title>
          <Separator my="3" />
          <Text size="2">
            You have unsaved changes. Save them before closing, discard them, or
            keep editing.
          </Text>
          <Flex gap="2" mt="4" justify="end" wrap="wrap">
            <Button variant="soft" onClick={() => setCloseGuardOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="soft"
              color="red"
              onClick={discardFromCloseGuard}
              disabled={saveMutation.isPending}
            >
              Discard
            </Button>
            <Button
              onClick={() => void saveFromCloseGuardAndExit()}
              disabled={saveMutation.isPending || !title.trim()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save & close'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

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
