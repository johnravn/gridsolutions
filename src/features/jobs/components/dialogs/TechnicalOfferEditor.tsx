// src/features/jobs/components/dialogs/TechnicalOfferEditor.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Select,
  Separator,
  Table,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import {
  Download,
  Eye,
  Lock,
  NavArrowDown,
  NavArrowRight,
  NavArrowUp,
  Plus,
  Trash,
} from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { companyExpansionQuery } from '@features/company/api/queries'
import {
  createOffer,
  exportOfferPDF,
  lockOffer,
  offerDetailQuery,
  recalculateOfferTotals,
} from '../../api/offerQueries'
import { calculateOfferTotals, calculateRentalFactor } from '../../utils/offerCalculations'
import type { RentalFactorConfig } from '../../utils/offerCalculations'
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
  UUID,
} from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null // If provided, edit mode; otherwise create mode
  onSaved?: (offerId: string) => void
  onSyncBookingsAfterSave?: (offerId: string) => void
}

type LocalEquipmentGroup = {
  id: string // temp ID for new groups
  group_name: string
  sort_order: number
  items: Array<LocalEquipmentItem>
}

type LocalEquipmentItem = {
  id: string // temp ID for new items
  item_id: string | null
  group_id: string | null
  quantity: number
  unit_price: number
  is_internal: boolean
  sort_order: number
  group_items?: Array<{
    id: string
    name: string
    brand_name: string | null
    model: string | null
    quantity: number
  }>
  item?: {
    id: string
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
    external_owner_name?: string | null
    brand?: { id: string; name: string } | null
    model?: string | null
  } | null
  group?: {
    id: string
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
    external_owner_name?: string | null
  } | null
}

function escapeForPostgrestOr(value: string) {
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

type LocalCrewItem = {
  id: string // temp ID for new items
  role_title: string
  crew_count: number
  start_date: string
  end_date: string
  daily_rate: number
  hourly_rate: number | null
  hours_per_day: number | null
  billing_type: 'daily' | 'hourly'
  sort_order: number
  role_category?: string | null
}

function calculateHoursPerDay(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end) return null

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }

  const diffMs = endDate.getTime() - startDate.getTime()
  if (diffMs <= 0) return null

  const hours = diffMs / (1000 * 60 * 60)
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  return hours / days
}

type LocalTransportItem = {
  id: string // temp ID for new items
  vehicle_name: string
  vehicle_id: string | null
  vehicle_category:
    | 'passenger_car_small'
    | 'passenger_car_medium'
    | 'passenger_car_big'
    | 'van_small'
    | 'van_medium'
    | 'van_big'
    | 'C1'
    | 'C1E'
    | 'C'
    | 'CE'
    | null
  distance_km: number | null
  start_date: string
  end_date: string
  daily_rate: number | null
  distance_rate: number | null // Distance rate per increment (null means use default)
  is_internal: boolean
  sort_order: number
  vehicle?: {
    id: string
    name: string
    external_owner_id?: UUID | null
  } | null
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ minWidth: 160 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
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
  const isEditMode = !!offerId
  const [currentOfferId, setCurrentOfferId] = React.useState<string | null>(
    offerId || null,
  )

  type JobInfo = {
    title: string | null
    start_at: string | null
    end_at: string | null
    customer: { id: string; is_partner: boolean } | null
  }

  // Fetch job title, duration, and customer for default offer name, time defaults, and discount
  const { data: jobData } = useQuery<JobInfo>({
    queryKey: ['job-title', jobId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'title, start_at, end_at, customer_id, customer:customers!jobs_customer_id_fkey ( id, is_partner )',
        )
        .eq('id', jobId)
        .single()
      if (error) throw error

      // Normalize customer relationship (PostgREST can return as array or object)
      const customer = Array.isArray((data as any).customer)
        ? (data as any).customer[0]
        : (data as any).customer

      return {
        title: data.title,
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        customer: customer
          ? ({
              id: customer.id,
              is_partner: customer.is_partner ?? false,
            } as { id: string; is_partner: boolean })
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

  // Fetch company expansion for default rates and rental factors
  const { data: companyExpansion } = useQuery({
    ...companyExpansionQuery({ companyId }),
    enabled: open && !!companyId && typeof companyId === 'string',
  })

  const defaultCrewRatePerDay = React.useMemo(() => {
    const value = companyExpansion?.crew_rate_per_day ?? null
    if (value === null) return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }, [companyExpansion?.crew_rate_per_day])

  const defaultCrewRatePerHour = React.useMemo(() => {
    const value = companyExpansion?.crew_rate_per_hour ?? null
    if (value === null) return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }, [companyExpansion?.crew_rate_per_hour])

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
  const [syncBeforeSaveOpen, setSyncBeforeSaveOpen] = React.useState(false)
  const [syncPromptAction, setSyncPromptAction] = React.useState<
    'create' | 'save' | 'lock'
  >('save')
  const [afterSaveAction, setAfterSaveAction] = React.useState<'lock' | null>(
    null,
  )

  // Equipment groups and items
  const [equipmentGroups, setEquipmentGroups] = React.useState<
    Array<LocalEquipmentGroup>
  >([])
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )

  // Crew items
  const [crewItems, setCrewItems] = React.useState<Array<LocalCrewItem>>([])

  // Transport items
  const [transportItems, setTransportItems] = React.useState<
    Array<LocalTransportItem>
  >([])

  // Update currentOfferId when offerId prop changes
  React.useEffect(() => {
    if (offerId) {
      setCurrentOfferId(offerId)
    }
  }, [offerId])

  // Update daysOfUse when job duration becomes available (only for new offers)
  React.useEffect(() => {
    if (!open || isEditMode || !job.start_at || !job.end_at) return
    setDaysOfUse(defaultDaysOfUse)
    setDaysOfUseDraft(null)
  }, [open, isEditMode, defaultDaysOfUse, job.start_at, job.end_at])

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

      // Convert transport items
      const transport: Array<LocalTransportItem> =
        existingOffer.transport_items?.map((item) => ({
          id: item.id,
          vehicle_name: item.vehicle_name,
          vehicle_id: item.vehicle_id,
          vehicle_category: item.vehicle_category ?? null,
          distance_km: item.distance_km ?? null,
          start_date: item.start_date,
          end_date: item.end_date,
          daily_rate: item.daily_rate > 0 ? item.daily_rate : null,
          distance_rate: item.distance_rate ?? null,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          vehicle: item.vehicle,
        })) || []
      setTransportItems(transport)
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
      setTransportItems([])
      setExpandedGroups(new Set())
      setCurrentOfferId(null)
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
    isEditMode,
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
      offer_id: offerId || '',
      role_title: item.role_title,
      role_category: item.role_category ?? null,
      crew_count: item.crew_count,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: 0, // Will be calculated
      sort_order: item.sort_order,
    }))

    const transport: Array<OfferTransportItem> = transportItems.map((item) => ({
      id: item.id,
      offer_id: offerId || '',
      vehicle_name: item.vehicle_name,
      vehicle_id: item.vehicle_id,
      vehicle_category: item.vehicle_category,
      distance_km: item.distance_km,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0,
      total_price: 0, // Will be calculated
      is_internal: item.is_internal,
      sort_order: item.sort_order,
      vehicle: item.vehicle,
    }))

    // Calculate totals with item-specific rates
    const transportSubtotal = transportItems.reduce((sum, item) => {
      const days = Math.ceil(
        (new Date(item.end_date).getTime() -
          new Date(item.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      // Use item's daily_rate if set, otherwise use default from company
      const effectiveDailyRate =
        item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0
      const dailyCost = effectiveDailyRate * Math.max(1, days)

      // Use item's distance_rate if set, otherwise use default from company
      const distanceRate =
        item.distance_rate ?? companyExpansion?.vehicle_distance_rate ?? null
      const increment = companyExpansion?.vehicle_distance_increment ?? 150
      const distanceIncrements = item.distance_km
        ? Math.ceil(item.distance_km / increment)
        : 0
      const distanceCost =
        distanceRate && distanceIncrements > 0
          ? distanceRate * distanceIncrements
          : 0

      return sum + dailyCost + distanceCost
    }, 0)

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
    const totalWithVAT = totalAfterDiscount + (totalAfterDiscount * vatPercent) / 100

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
    transportItems,
    daysOfUse,
    discountPercent,
    vatPercent,
    rentalFactorConfig,
    offerId,
    companyExpansion?.vehicle_daily_rate,
    companyExpansion?.vehicle_distance_rate,
    companyExpansion?.vehicle_distance_increment,
  ])

  const saveMutation = useMutation({
    mutationFn: async (payload?: { syncAfterSave?: boolean }) => {
      if (!title.trim()) {
        throw new Error('Title is required')
      }

      let workingOfferId: string

      // Create offer if new
      if (!offerId) {
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
        workingOfferId = offerId
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

        // Delete transport items
        if (
          existingOffer.transport_items &&
          existingOffer.transport_items.length > 0
        ) {
          const { error: transportErr } = await supabase
            .from('offer_transport_items')
            .delete()
            .eq('offer_id', workingOfferId)
          if (transportErr) throw transportErr
        }
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

      // Save transport items
      for (const item of transportItems) {
        const isExistingItem = !item.id.startsWith('temp-')
        const days = Math.ceil(
          (new Date(item.end_date).getTime() -
            new Date(item.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
        // Calculate total: daily_rate * days + distance_rate * (distance rounded up to increment)
        // Use item's daily_rate if set, otherwise use default from company
        const effectiveDailyRate =
          item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0
        // Use item's distance_rate if set, otherwise use default from company
        const effectiveDistanceRate =
          item.distance_rate ?? companyExpansion?.vehicle_distance_rate ?? null
        const distanceIncrement =
          companyExpansion?.vehicle_distance_increment ?? 150
        const distanceIncrements = item.distance_km
          ? Math.ceil(item.distance_km / distanceIncrement)
          : 0
        const distanceCost =
          effectiveDistanceRate && distanceIncrements > 0
            ? effectiveDistanceRate * distanceIncrements
            : 0
        const dailyCost = effectiveDailyRate * Math.max(1, days)
        const totalPrice = dailyCost + distanceCost

        if (isExistingItem) {
          const { error: itemErr } = await supabase
            .from('offer_transport_items')
            .upsert({
              id: item.id,
              offer_id: workingOfferId,
              vehicle_name: item.vehicle_name,
              vehicle_id: item.vehicle_id ?? null,
              vehicle_category: item.vehicle_category,
              distance_km: item.distance_km,
              distance_rate: item.distance_rate ?? null,
              start_date: item.start_date,
              end_date: item.end_date,
              daily_rate: effectiveDailyRate,
              total_price: totalPrice,
              is_internal: item.is_internal,
              sort_order: item.sort_order,
            })

          if (itemErr) throw itemErr
        } else {
          // For new items, only include vehicle_id if it has a value
          const insertPayload: any = {
            offer_id: workingOfferId,
            vehicle_name: item.vehicle_name,
            vehicle_category: item.vehicle_category,
            distance_km: item.distance_km,
            distance_rate: item.distance_rate ?? null,
            start_date: item.start_date,
            end_date: item.end_date,
            daily_rate: effectiveDailyRate,
            total_price: totalPrice,
            is_internal: item.is_internal,
            sort_order: item.sort_order,
          }

          // Only include vehicle_id if it has a value
          // Omitting null vehicle_id avoids PostgREST relationship embedding issues
          if (item.vehicle_id !== null) {
            insertPayload.vehicle_id = item.vehicle_id
          }

          const { error: itemErr } = await supabase
            .from('offer_transport_items')
            .insert(insertPayload)

          if (itemErr) throw itemErr
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
        syncAfterSave: !!payload?.syncAfterSave,
      }
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', result.offerId] })
      // Update current offer ID so we can show preview/lock buttons
      setCurrentOfferId(result.offerId)
      success(
        isEditMode ? 'Offer updated' : 'Offer created',
        `Technical offer "${title.trim()}" was saved successfully.`,
      )

      if (afterSaveAction === 'lock') {
        setAfterSaveAction(null)
        lockOfferMutation.mutate(result.offerId)
        return
      }

      // Close dialog after save
      onOpenChange(false)
      onSaved?.(result.offerId)
      if (result.syncAfterSave) {
        onSyncBookingsAfterSave?.(result.offerId)
      }
    },
    onError: (e: any) => {
      setAfterSaveAction(null)
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
      // Fetch updated offer to get access_token
      const updatedOffer = await qc.fetchQuery(offerDetailQuery(lockedOfferId))
      if (updatedOffer?.access_token) {
        const url = `${window.location.origin}/offer/${updatedOffer.access_token}`
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(url)
          success(
            'Offer locked and sent',
            `The offer has been locked. The link has been copied to your clipboard.`,
          )
          info('Offer link', `Link: ${url}`)
        } catch {
          success(
            'Offer locked and sent',
            `The offer has been locked. Share this link: ${url}`,
          )
        }
      } else {
        success(
          'Offer locked',
          'The offer has been locked and is ready to send.',
        )
      }

      onOpenChange(false)
      onSaved?.(lockedOfferId)
    },
    onError: (e: any) => {
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

  const handleLockAndSend = () => {
    // If no offer ID yet, save first
    if (!currentOfferId) {
      info('Save required', 'Please save the offer first before locking it.')
      return
    }
    setSyncPromptAction('lock')
    setSyncBeforeSaveOpen(true)
  }

  const handleSaveClick = () => {
    setSyncPromptAction(isEditMode ? 'save' : 'create')
    setSyncBeforeSaveOpen(true)
  }

  const handleSaveWithSync = (syncAfterSave: boolean) => {
    setSyncBeforeSaveOpen(false)
    if (syncPromptAction === 'lock') {
      setAfterSaveAction('lock')
      saveMutation.mutate({ syncAfterSave })
      return
    }

    setAfterSaveAction(null)
    saveMutation.mutate({ syncAfterSave })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
          {isEditMode ? 'Edit Technical Offer' : 'Create Technical Offer'}
        </Dialog.Title>
        <Dialog.Description>
          {isEditMode
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
                    {!isReadOnly && !isEditMode && defaultTitle && (
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
                          value={discountPercentDraft ?? String(discountPercent)}
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

                    <Text
                      size="1"
                      color="gray"
                      style={{ fontStyle: 'italic' }}
                    >
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
                    <Text
                      size="1"
                      color="gray"
                      style={{ fontStyle: 'italic' }}
                    >
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
              />
            </Tabs.Content>

            {/* Transport Tab */}
            <Tabs.Content value="transport">
              <TransportSection
                items={transportItems}
                onItemsChange={setTransportItems}
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
          <Flex gap="2">
            {existingOffer?.access_token && (
              <>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    const url = `${window.location.origin}/offer/${existingOffer.access_token}`
                    window.open(url, '_blank')
                  }}
                  disabled={
                    !existingOffer.access_token ||
                    existingOffer.status === 'draft'
                  }
                  title={
                    existingOffer.status === 'draft'
                      ? 'Draft offers can be previewed after they are sent'
                      : 'Preview offer as customer will see it'
                  }
                >
                  <Eye width={14} height={14} />
                  Show Preview
                </Button>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    exportPdfMutation.mutate(existingOffer.id)
                  }}
                  disabled={exportPdfMutation.isPending}
                >
                  <Download width={14} height={14} />
                  Export PDF
                </Button>
                {!existingOffer.locked && (
                  <Button
                    size="2"
                    variant="soft"
                    color="blue"
                    onClick={() => {
                      handleLockAndSend()
                    }}
                    disabled={lockOfferMutation.isPending}
                  >
                    <Lock width={14} height={14} />
                    Lock & Send
                  </Button>
                )}
              </>
            )}
          </Flex>
          <Flex gap="2">
            <Dialog.Close>
              <Button variant="soft">{isReadOnly ? 'Close' : 'Cancel'}</Button>
            </Dialog.Close>
            {!isReadOnly && (
              <Button
                variant="classic"
                onClick={handleSaveClick}
                disabled={saveMutation.isPending || !title.trim()}
              >
                {saveMutation.isPending
                  ? 'Saving...'
                  : isEditMode
                    ? 'Save Draft'
                    : 'Create Offer'}
              </Button>
            )}
          </Flex>
        </Flex>
      </Dialog.Content>

      <Dialog.Root
        open={syncBeforeSaveOpen}
        onOpenChange={(openValue) => setSyncBeforeSaveOpen(openValue)}
      >
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>Sync offer to bookings?</Dialog.Title>
          <Separator my="3" />
          <Text size="2">
            Do you want to sync bookings to match this offer? Syncing will
            replace the current equipment, crew, and transport bookings on this
            job.
          </Text>
          <Flex gap="2" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="soft"
              onClick={() => handleSaveWithSync(false)}
              disabled={saveMutation.isPending}
            >
              {syncPromptAction === 'lock'
                ? 'Send without syncing'
                : syncPromptAction === 'create'
                  ? 'Create without syncing'
                  : 'Save without syncing'}
            </Button>
            <Button
              onClick={() => handleSaveWithSync(true)}
              disabled={saveMutation.isPending}
            >
              {syncPromptAction === 'lock'
                ? 'Send and sync'
                : syncPromptAction === 'create'
                  ? 'Create and sync'
                  : 'Save and sync'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Dialog.Root>
  )
}

// Search field with fixed-position dropdown
function ItemSearchField({
  searchTerm,
  onSearchChange,
  searchResults,
  onSelectItem,
  formatCurrency,
}: {
  searchTerm: string
  onSearchChange: (term: string) => void
  searchResults: Array<{
    id: string
    name: string
    is_group: boolean
    on_hand: number | null
    price: number | null
    internally_owned: boolean
    external_owner_name: string | null
    brand_name: string | null
    model: string | null
  }>
  onSelectItem: (itemId: string) => void
  formatCurrency: (amount: number) => string
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  // Update dropdown position when search term or results change
  React.useEffect(() => {
    if (!searchTerm || searchResults.length === 0) {
      setDropdownPosition(null)
      return
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const updatePosition = () => {
      if (containerRef.current) {
        const input = containerRef.current.querySelector('input')
        if (input) {
          const rect = input.getBoundingClientRect()
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
          })
        }
      }
    }

    // Try immediately, then with a small delay to ensure layout is ready
    updatePosition()
    const timer = setTimeout(updatePosition, 10)

    return () => clearTimeout(timer)
  }, [searchTerm, searchResults.length])

  return (
    <Box mb="3" ref={containerRef} style={{ position: 'relative' }}>
      <TextField.Root
        placeholder="Search items or groups to add..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {dropdownPosition && searchResults.length > 0 && (
        <Box
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 10000,
            backgroundColor: 'var(--color-panel-solid)',
            border: '1px solid var(--gray-6)',
            borderRadius: 8,
            maxHeight: 'min(400px, 50vh)',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {searchResults.map((item) => (
            <Box
              key={item.id}
              p="2"
              style={{
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-4)',
                backgroundColor: 'transparent',
              }}
              onClick={() => onSelectItem(item.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Flex justify="between" align="center" gap="2">
                <Flex
                  direction="column"
                  gap="1"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                    <Text style={{ flex: 1, minWidth: 0 }}>{item.name}</Text>
                    {item.internally_owned ? (
                      <Badge size="1" variant="soft" color="indigo">
                        Internal
                      </Badge>
                    ) : (
                      <Badge size="1" variant="soft" color="amber">
                        {item.external_owner_name ?? 'External'}
                      </Badge>
                    )}
                  </Flex>
                  <Text size="1" color="gray">
                    {item.is_group
                      ? `Group | Qty: ${item.on_hand ?? 'N/A'}`
                      : `Brand: ${item.brand_name ?? 'N/A'} | Model: ${
                          item.model ?? 'N/A'
                        } | Qty: ${item.on_hand ?? 'N/A'}`}
                  </Text>
                </Flex>
                {item.price !== null && (
                  <Text size="2" color="gray" style={{ flexShrink: 0 }}>
                    {formatCurrency(item.price)}
                  </Text>
                )}
              </Flex>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// Equipment Section Component
function EquipmentSection({
  groups,
  onGroupsChange,
  expandedGroups,
  onExpandedGroupsChange,
  companyId,
  equipmentDaysOfUse,
  equipmentRentalFactor,
  readOnly = false,
}: {
  groups: Array<LocalEquipmentGroup>
  onGroupsChange: (groups: Array<LocalEquipmentGroup>) => void
  expandedGroups: Set<string>
  onExpandedGroupsChange: (groups: Set<string>) => void
  companyId: string
  equipmentDaysOfUse: number
  equipmentRentalFactor: number
  readOnly?: boolean
}) {
  // Track search state per group
  const [searchTerms, setSearchTerms] = React.useState<Map<string, string>>(
    new Map(),
  )
  const [activeSearchGroupId, setActiveSearchGroupId] = React.useState<
    string | null
  >(null)
  const [quantityDrafts, setQuantityDrafts] = React.useState<
    Record<string, string>
  >({})
  const [unitPriceDrafts, setUnitPriceDrafts] = React.useState<
    Record<string, string>
  >({})
  const [searchResults, setSearchResults] = React.useState<
    Array<{
      id: string
      name: string
      is_group: boolean
      on_hand: number | null
      price: number | null
      internally_owned: boolean
      external_owner_name: string | null
      brand_name: string | null
      model: string | null
    }>
  >([])
  const groupItemsCacheRef = React.useRef<
    Map<
      string,
      Array<{
        id: string
        name: string
        brand_name: string | null
        model: string | null
        quantity: number
      }>
    >
  >(new Map())
  const groupsRef = React.useRef(groups)
  const [expandedGroupItems, setExpandedGroupItems] = React.useState<
    Set<string>
  >(new Set())

  const groupNameSuggestions = ['Audio', 'Lights', 'Rigging', 'AV', 'General']

  React.useEffect(() => {
    groupsRef.current = groups
  }, [groups])

  // Get search term for a specific group
  const getSearchTerm = (groupId: string) => {
    return searchTerms.get(groupId) || ''
  }

  // Set search term for a specific group
  const setSearchTerm = (groupId: string, term: string) => {
    const newTerms = new Map(searchTerms)
    newTerms.set(groupId, term)
    setSearchTerms(newTerms)
    setActiveSearchGroupId(groupId) // Track which group is being searched
  }

  // Search for items
  const searchItems = React.useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([])
        return
      }

      const termSafe = escapeForPostgrestOr(term)
      const { data, error } = await supabase
        .from('inventory_index')
        .select(
          `
          id,
          name,
          is_group,
          on_hand,
          current_price,
          internally_owned,
          external_owner_name,
          brand_name,
          model
        `,
        )
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .or('is_group.eq.true,allow_individual_booking.eq.true')
        .or(
          `name.ilike.%${termSafe}%,category_name.ilike.%${termSafe}%,brand_name.ilike.%${termSafe}%,model.ilike.%${termSafe}%,nicknames.ilike.%${termSafe}%`,
        )
        .limit(20)

      if (error) {
        console.error('Search error:', error)
        return
      }

      setSearchResults(
        data.map((r: any) => {
          return {
            id: r.id,
            name: r.name,
            is_group: !!r.is_group,
            on_hand: r.on_hand != null ? Number(r.on_hand) : null,
            price: r.current_price ?? null,
            internally_owned: !!r.internally_owned,
            external_owner_name: r.external_owner_name ?? null,
            brand_name: r.brand_name ?? null,
            model: r.model ?? null,
          }
        }),
      )
    },
    [companyId],
  )

  const addGroup = () => {
    const newGroup: LocalEquipmentGroup = {
      id: `temp-${Date.now()}`,
      group_name: '',
      sort_order: groups.length,
      items: [],
    }
    onGroupsChange([...groups, newGroup])
    onExpandedGroupsChange(new Set([...expandedGroups, newGroup.id]))
  }

  const updateGroup = (
    groupId: string,
    updates: Partial<LocalEquipmentGroup>,
  ) => {
    onGroupsChange(
      groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    )
  }

  const deleteGroup = (groupId: string) => {
    onGroupsChange(groups.filter((g) => g.id !== groupId))
    const next = new Set(expandedGroups)
    next.delete(groupId)
    onExpandedGroupsChange(next)
  }

  const addItemToGroup = (groupId: string, itemId?: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    const selectedItem = searchResults.find((r) => r.id === itemId)
    if (!selectedItem) return
    const isGroup = selectedItem.is_group
    const newItem: LocalEquipmentItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      item_id: isGroup ? null : itemId || null,
      group_id: isGroup ? itemId || null : null,
      quantity: 1,
      unit_price: selectedItem.price ?? 0,
      is_internal: selectedItem.internally_owned,
      sort_order: group.items.length,
      item: !isGroup
        ? {
            id: selectedItem.id,
            name: selectedItem.name,
            externally_owned: !selectedItem.internally_owned,
            external_owner_id: selectedItem.internally_owned
              ? null
              : selectedItem.external_owner_name
                ? 'temp'
                : null,
            external_owner_name: selectedItem.external_owner_name,
            brand: selectedItem.brand_name
              ? { id: 'temp', name: selectedItem.brand_name }
              : null,
            model: selectedItem.model ?? null,
          }
        : null,
      group: isGroup
        ? {
            id: selectedItem.id,
            name: selectedItem.name,
            externally_owned: !selectedItem.internally_owned,
            external_owner_id: null,
            external_owner_name: selectedItem.external_owner_name,
          }
        : null,
    }

    updateGroup(groupId, {
      items: [...group.items, newItem],
    })
    setSearchTerm(groupId, '')
    setActiveSearchGroupId(null)
    setSearchResults([])

    if (isGroup && itemId) {
      void loadGroupItems(itemId, groupId, newItem.id)
    }
  }

  // Derive active search term for dependency tracking
  const activeSearchTerm = React.useMemo(() => {
    if (!activeSearchGroupId) return ''
    return searchTerms.get(activeSearchGroupId) || ''
  }, [activeSearchGroupId, searchTerms])

  // Search effect - trigger search when active group's search term changes
  React.useEffect(() => {
    if (!activeSearchGroupId) {
      if (activeSearchTerm.trim() === '') {
        setSearchResults([])
      }
      return
    }

    if (!activeSearchTerm.trim()) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(() => {
      // Double-check the term hasn't changed and we're still on the same group
      const currentTerm = searchTerms.get(activeSearchGroupId) || ''
      if (
        activeSearchGroupId &&
        currentTerm.trim() === activeSearchTerm.trim()
      ) {
        searchItems(activeSearchTerm.trim())
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [activeSearchGroupId, activeSearchTerm, searchTerms, searchItems])

  const updateItem = (
    groupId: string,
    itemId: string,
    updates: Partial<LocalEquipmentItem>,
  ) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    updateGroup(groupId, {
      items: group.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    })
  }

  const applyGroupItems = (
    groupId: string,
    groupItemId: string,
    groupItems: Array<{
      id: string
      name: string
      brand_name: string | null
      model: string | null
      quantity: number
    }>,
  ) => {
    const currentGroups = groupsRef.current
    const group = currentGroups.find((g) => g.id === groupId)
    if (!group) return

    onGroupsChange(
      currentGroups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              items: g.items.map((item) =>
                item.id === groupItemId
                  ? { ...item, group_items: groupItems }
                  : item,
              ),
            },
      ),
    )
  }

  const loadGroupItems = React.useCallback(
    async (groupId: string, targetGroupId: string, groupItemId: string) => {
      const cached = groupItemsCacheRef.current.get(groupId)
      if (cached) {
        applyGroupItems(targetGroupId, groupItemId, cached)
        return
      }

      const { data, error } = await supabase
        .from('group_items')
        .select(
          `
          item_id,
          quantity,
          item:items (
            id,
            name,
            model,
            brand:item_brands ( id, name )
          )
        `,
        )
        .eq('group_id', groupId)

      if (error) {
        console.error('Failed to load group items:', error)
        return
      }

      const groupItems = data.map((row: any) => {
          const rawItem = Array.isArray(row.item) ? row.item[0] : row.item
          const rawBrand = rawItem?.brand
          const brand = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand
          return {
            id: rawItem?.id ?? row.item_id,
            name: rawItem?.name ?? 'Unknown item',
            brand_name: brand?.name ?? null,
            model: rawItem?.model ?? null,
            quantity: row.quantity ?? 1,
          }
        })

      groupItemsCacheRef.current.set(groupId, groupItems)
      applyGroupItems(targetGroupId, groupItemId, groupItems)
    },
    [],
  )

  const toggleGroupItems = (itemId: string) => {
    setExpandedGroupItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  React.useEffect(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.group_id && !item.group_items) {
          void loadGroupItems(item.group_id, group.id, item.id)
        }
      }
    }
  }, [groups, loadGroupItems])

  const deleteItem = (groupId: string, itemId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    updateGroup(groupId, {
      items: group.items.filter((item) => item.id !== itemId),
    })
  }

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups)
    if (next.has(groupId)) {
      next.delete(groupId)
    } else {
      next.add(groupId)
    }
    onExpandedGroupsChange(next)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex
      direction="column"
      gap="3"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex justify="between" align="center" style={{ flexShrink: 0 }}>
        <Heading size="3">Equipment</Heading>
        {!readOnly && (
          <Button size="2" onClick={addGroup}>
            <Plus width={16} height={16} /> Add Group
          </Button>
        )}
      </Flex>

      <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
        Equipment totals are calculated as unit price × qty × rental factor (
        {equipmentDaysOfUse} day{equipmentDaysOfUse === 1 ? '' : 's'} →{' '}
        {equipmentRentalFactor.toFixed(2)}x).
      </Text>

      {groups.length > 0 && (
        <Flex direction="column" gap="2">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const groupTotal = group.items.reduce(
              (sum, item) =>
                sum + item.unit_price * item.quantity * equipmentRentalFactor,
              0,
            )

            return (
              <Box
                key={group.id}
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <Box
                  p="3"
                  style={{
                    background: 'var(--gray-a2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleGroup(group.id)}
                >
                  <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                      {isExpanded ? (
                        <NavArrowDown width={18} height={18} />
                      ) : (
                        <NavArrowRight width={18} height={18} />
                      )}
                      <TextField.Root
                        value={group.group_name}
                        onChange={(e) => {
                          e.stopPropagation()
                          updateGroup(group.id, { group_name: e.target.value })
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter group name"
                        style={{ width: 200 }}
                        readOnly={readOnly}
                      />
                      <Text size="2" color="gray">
                        ({group.items.length} items)
                      </Text>
                    </Flex>
                    <Flex align="center" gap="3">
                      <Text weight="medium">{formatCurrency(groupTotal)}</Text>
                      {!readOnly && (
                        <Button
                          size="1"
                          variant="soft"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteGroup(group.id)
                          }}
                        >
                          <Trash width={14} height={14} />
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Box>

                {isExpanded && (
                  <Box p="3" style={{ background: 'var(--gray-a1)' }}>
                    {/* Group name suggestions */}
                    {!readOnly && !group.group_name && (
                      <Box mb="3">
                        <Text size="1" color="gray" mb="1">
                          Group name suggestions:
                        </Text>
                        <Flex gap="2" wrap="wrap">
                          {groupNameSuggestions.map((suggestion) => (
                            <Button
                              key={suggestion}
                              size="1"
                              variant="soft"
                              color="gray"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateGroup(group.id, {
                                  group_name: suggestion,
                                })
                              }}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </Flex>
                      </Box>
                    )}
                    {/* Search for items */}
                    {!readOnly && (
                      <ItemSearchField
                        searchTerm={getSearchTerm(group.id)}
                        onSearchChange={(term) => setSearchTerm(group.id, term)}
                        searchResults={
                          activeSearchGroupId === group.id ? searchResults : []
                        }
                        onSelectItem={(itemId) =>
                          addItemToGroup(group.id, itemId)
                        }
                        formatCurrency={formatCurrency}
                      />
                    )}

                    {/* Items table */}
                    {group.items.length > 0 ? (
                      <Table.Root variant="surface" size="1">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell>
                              Item
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>
                              Brand
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>
                              Model
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>
                              Unit Price (/day)
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>
                              Total
                            </Table.ColumnHeaderCell>
                            {!readOnly && <Table.ColumnHeaderCell />}
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {group.items.map((item) => {
                            const isGroupExpanded = expandedGroupItems.has(
                              item.id,
                            )
                            return (
                              <React.Fragment key={item.id}>
                                <Table.Row>
                                  <Table.Cell>
                                    <Flex align="center" gap="2" wrap="wrap">
                                      {item.group && (
                                        <IconButton
                                          variant="ghost"
                                          size="1"
                                          onClick={() =>
                                            toggleGroupItems(item.id)
                                          }
                                          style={{
                                            width: 20,
                                            height: 20,
                                            padding: 0,
                                          }}
                                        >
                                          {isGroupExpanded ? (
                                            <NavArrowDown
                                              width={12}
                                              height={12}
                                            />
                                          ) : (
                                            <NavArrowRight
                                              width={12}
                                              height={12}
                                            />
                                          )}
                                        </IconButton>
                                      )}
                                      <Text>
                                        {item.item?.name ||
                                          item.group?.name ||
                                          '—'}
                                      </Text>
                                      {item.group ? (
                                        <Badge
                                          size="1"
                                          variant="soft"
                                          color="gray"
                                        >
                                          Group
                                        </Badge>
                                      ) : null}
                                      {item.group?.externally_owned ||
                                      item.item?.externally_owned ? (
                                        <Badge
                                          size="1"
                                          variant="soft"
                                          color="amber"
                                        >
                                          {item.group?.external_owner_name ??
                                            item.item?.external_owner_name ??
                                            'External'}
                                        </Badge>
                                      ) : (
                                        <Badge
                                          size="1"
                                          variant="soft"
                                          color="indigo"
                                        >
                                          Internal
                                        </Badge>
                                      )}
                                    </Flex>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>{item.item?.brand?.name ?? '—'}</Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>{item.item?.model ?? '—'}</Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <TextField.Root
                                      type="number"
                                      min="1"
                                      value={
                                        quantityDrafts[item.id] ??
                                        String(item.quantity)
                                      }
                                      onChange={(e) => {
                                        const nextValue = e.target.value
                                        setQuantityDrafts((prev) => ({
                                          ...prev,
                                          [item.id]: nextValue,
                                        }))

                                        if (nextValue === '') return
                                        const parsed = Number(nextValue)
                                        if (Number.isNaN(parsed)) return

                                        updateItem(group.id, item.id, {
                                          quantity: Math.max(1, parsed),
                                        })
                                        setQuantityDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[item.id]
                                          return next
                                        })
                                      }}
                                      onBlur={() => {
                                        if (quantityDrafts[item.id] === '') {
                                          setQuantityDrafts((prev) => {
                                            const next = { ...prev }
                                            delete next[item.id]
                                            return next
                                          })
                                        }
                                      }}
                                      style={{ width: 80 }}
                                      readOnly={readOnly}
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <TextField.Root
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        unitPriceDrafts[item.id] ??
                                        String(item.unit_price)
                                      }
                                      onChange={(e) => {
                                        const nextValue = e.target.value
                                        setUnitPriceDrafts((prev) => ({
                                          ...prev,
                                          [item.id]: nextValue,
                                        }))

                                        if (nextValue === '') return
                                        const parsed = Number(nextValue)
                                        if (Number.isNaN(parsed)) return

                                        updateItem(group.id, item.id, {
                                          unit_price: Math.max(0, parsed),
                                        })
                                        setUnitPriceDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[item.id]
                                          return next
                                        })
                                      }}
                                      onBlur={() => {
                                        if (unitPriceDrafts[item.id] === '') {
                                          setUnitPriceDrafts((prev) => {
                                            const next = { ...prev }
                                            delete next[item.id]
                                            return next
                                          })
                                        }
                                      }}
                                      style={{ width: 120 }}
                                      readOnly={readOnly}
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>
                                      {formatCurrency(
                                        item.unit_price *
                                          item.quantity *
                                          equipmentRentalFactor,
                                      )}
                                    </Text>
                                  </Table.Cell>
                                  {!readOnly && (
                                    <Table.Cell align="right">
                                      <Button
                                        size="1"
                                        variant="soft"
                                        color="red"
                                        onClick={() =>
                                          deleteItem(group.id, item.id)
                                        }
                                      >
                                        <Trash width={14} height={14} />
                                      </Button>
                                    </Table.Cell>
                                  )}
                                </Table.Row>
                                {item.group &&
                                  isGroupExpanded &&
                                  item.group_items?.map((groupItem) => {
                                    const totalQty =
                                      groupItem.quantity * item.quantity
                                    return (
                                      <Table.Row
                                        key={`${item.id}-group-${groupItem.id}`}
                                        style={{
                                          background: 'var(--gray-a2)',
                                          opacity: 0.75,
                                        }}
                                      >
                                        <Table.Cell>
                                          <Text
                                            size="1"
                                            color="gray"
                                            style={{ paddingLeft: 16 }}
                                          >
                                            {groupItem.name}
                                          </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Text size="1" color="gray">
                                            {groupItem.brand_name ?? '—'}
                                          </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Text size="1" color="gray">
                                            {groupItem.model ?? '—'}
                                          </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Text size="1" color="gray">
                                            {totalQty}
                                          </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Text size="1" color="gray">
                                            Included
                                          </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Text size="1" color="gray">
                                            Included
                                          </Text>
                                        </Table.Cell>
                                        {!readOnly && <Table.Cell />}
                                      </Table.Row>
                                    )
                                  })}
                              </React.Fragment>
                            )
                          })}
                        </Table.Body>
                      </Table.Root>
                    ) : (
                      <Text size="2" color="gray">
                        No items in this group. Search above to add items.
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            )
          })}
        </Flex>
      )}

      {/* Always show empty state box at bottom */}
      <Box
        p="4"
        style={{
          border: '2px dashed var(--gray-a6)',
          borderRadius: 8,
          textAlign: 'center',
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 100ms',
        }}
        onClick={readOnly ? undefined : addGroup}
        onMouseEnter={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }
        }}
        onMouseLeave={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <Flex direction="column" align="center" gap="2">
          {!readOnly && <Plus width={24} height={24} />}
          <Text size="2" color="gray">
            {readOnly ? 'No equipment groups yet' : 'Add equipment group'}
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}

// Crew Section Component
function CrewSection({
  items,
  onItemsChange,
  companyId: _companyId,
  readOnly = false,
  jobStartAt,
  jobEndAt,
  defaultRatePerDay,
  defaultRatePerHour,
}: {
  items: Array<LocalCrewItem>
  onItemsChange: (items: Array<LocalCrewItem>) => void
  companyId: string
  readOnly?: boolean
  jobStartAt?: string | null
  jobEndAt?: string | null
  defaultRatePerDay?: number | null
  defaultRatePerHour?: number | null
}) {
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set(),
  )
  const [countDrafts, setCountDrafts] = React.useState<Record<string, string>>(
    {},
  )
  const [dailyRateDrafts, setDailyRateDrafts] = React.useState<
    Record<string, string>
  >({})

  const roleSuggestions = [
    'Technician',
    'Loader',
    'FOH',
    'Monitors',
    'Hands',
    'Driver',
  ]

  const categorySuggestions = ['Audio', 'Lights', 'AV', 'Transport', 'Rigging']

  // Group items by category
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string | null, Array<LocalCrewItem>>()
    const noCategory: Array<LocalCrewItem> = []

    for (const item of items) {
      const cat = item.role_category || null
      if (!cat) {
        noCategory.push(item)
      } else {
        const existing = groups.get(cat) || []
        existing.push(item)
        groups.set(cat, existing)
      }
    }

    // Convert map to sorted array: no category first, then sorted categories
    const result: Array<{
      category: string | null
      items: Array<LocalCrewItem>
    }> = []
    if (noCategory.length > 0) {
      result.push({ category: null, items: noCategory })
    }

    const sortedCategories = Array.from(groups.keys()).sort()
    for (const cat of sortedCategories) {
      result.push({ category: cat, items: groups.get(cat)! })
    }

    return result
  }, [items])

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const addItem = () => {
    // Default to job duration if available, otherwise use current time + 1 day
    // This ensures times default to the job length (start_at to end_at)
    const startDate = jobStartAt ? new Date(jobStartAt) : new Date()
    const endDate = jobEndAt
      ? new Date(jobEndAt)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000) // +1 day if no job end

    // Ensure we preserve the full date-time from the job
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    const hasProvidedWindow = Boolean(jobStartAt && jobEndAt)
    const computedHours = calculateHoursPerDay(startIso, endIso)
    const hoursPerDay = hasProvidedWindow ? (computedHours ?? 8) : 8
    const hourlyRate = defaultRatePerHour ?? 0
    const dailyRate = hourlyRate * hoursPerDay

    const newItem: LocalCrewItem = {
      id: `temp-${Date.now()}`,
      role_title: '',
      crew_count: 1,
      start_date: startIso,
      end_date: endIso,
      daily_rate: dailyRate,
      hourly_rate: hourlyRate,
      hours_per_day: hoursPerDay,
      billing_type: 'hourly',
      sort_order: items.length,
      role_category: null,
    }
    onItemsChange([...items, newItem])
    setExpandedItems((prev) => new Set([...prev, newItem.id]))
  }

  const normalizeCrewItem = (item: LocalCrewItem): LocalCrewItem => {
    if (item.billing_type === 'hourly') {
      const computedHours =
        calculateHoursPerDay(item.start_date, item.end_date) ??
        (item.hours_per_day != null ? Math.max(0, item.hours_per_day) : null) ??
        0
      const normalizedHourly = Math.max(
        0,
        item.hourly_rate != null ? item.hourly_rate : (defaultRatePerHour ?? 0),
      )
      return {
        ...item,
        hours_per_day: computedHours,
        hourly_rate: normalizedHourly,
        daily_rate: normalizedHourly * computedHours,
      }
    }

    return {
      ...item,
      hourly_rate: null,
      hours_per_day: null,
      daily_rate: Math.max(0, item.daily_rate),
    }
  }

  const updateItem = (itemId: string, updates: Partial<LocalCrewItem>) => {
    onItemsChange(
      items.map((item) =>
        item.id === itemId ? normalizeCrewItem({ ...item, ...updates }) : item,
      ),
    )
  }

  const deleteItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Crew</Heading>
        {!readOnly && (
          <Button size="2" onClick={addItem}>
            <Plus width={16} height={16} /> Add Crew Item
          </Button>
        )}
      </Flex>

      {items.length > 0 && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedItems.map((group) => (
            <Box key={group.category || 'no-category'}>
              {group.category && (
                <Heading
                  size="4"
                  mb="2"
                  style={{ textTransform: 'capitalize' }}
                >
                  {group.category}
                </Heading>
              )}
              <Box
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {group.items.map((item) => {
                  const isExpanded = expandedItems.has(item.id)
                  const days = Math.ceil(
                    (new Date(item.end_date).getTime() -
                      new Date(item.start_date).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                  const total =
                    item.daily_rate * item.crew_count * Math.max(1, days)
                  const computedHoursPerDay =
                    item.billing_type === 'hourly'
                      ? (item.hours_per_day ??
                        calculateHoursPerDay(item.start_date, item.end_date) ??
                        0)
                      : null
                  const formattedHoursPerDay =
                    computedHoursPerDay != null
                      ? Number(computedHoursPerDay.toFixed(2))
                      : null
                  const displayHourlyRate =
                    item.billing_type === 'hourly'
                      ? (item.hourly_rate ?? defaultRatePerHour ?? 0)
                      : null

                  return (
                    <Box
                      key={item.id}
                      p="3"
                      style={{
                        border: '1px solid var(--gray-a6)',
                        borderRadius: 8,
                        background: 'var(--gray-a2)',
                      }}
                    >
                      <Box
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        onClick={() => toggleItem(item.id)}
                      >
                        <Flex align="center" gap="2">
                          {isExpanded ? (
                            <NavArrowDown width={18} height={18} />
                          ) : (
                            <NavArrowRight width={18} height={18} />
                          )}
                          <Text weight="bold">{item.role_title || '—'}</Text>
                          <Text size="2" color="gray">
                            ({item.crew_count} crew
                            {item.crew_count !== 1 ? 's' : ''})
                          </Text>
                          <Text size="2" color="gray">
                            • {formatCurrency(total)}
                          </Text>
                        </Flex>
                        {!readOnly && (
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteItem(item.id)
                            }}
                          >
                            <Trash width={14} height={14} />
                          </Button>
                        )}
                      </Box>

                      {isExpanded && (
                        <Box
                          mt="3"
                          pt="3"
                          style={{ borderTop: '1px solid var(--gray-a6)' }}
                        >
                          <Flex direction="column" gap="3">
                            <Flex gap="3" wrap="wrap">
                              {/* Role Title */}
                              <Box style={{ flex: '1 1 260px' }}>
                                <Text size="2" color="gray" mb="1">
                                  Role Title
                                </Text>
                                <TextField.Root
                                  value={item.role_title}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      role_title: e.target.value,
                                    })
                                  }
                                  placeholder="e.g., Technician"
                                  readOnly={readOnly}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {!readOnly && !item.role_title && (
                                  <Flex gap="2" wrap="wrap" mt="2">
                                    <Text
                                      size="1"
                                      color="gray"
                                      style={{ width: '100%' }}
                                    >
                                      Quick suggestions:
                                    </Text>
                                    {roleSuggestions.map((suggestion) => (
                                      <Button
                                        key={suggestion}
                                        size="1"
                                        variant="soft"
                                        color="gray"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          updateItem(item.id, {
                                            role_title: suggestion,
                                          })
                                        }}
                                      >
                                        {suggestion}
                                      </Button>
                                    ))}
                                  </Flex>
                                )}
                              </Box>

                              {/* Role Category */}
                              <Box style={{ flex: '1 1 220px' }}>
                                <Text size="2" color="gray" mb="1">
                                  Role Category
                                </Text>
                                <TextField.Root
                                  placeholder="e.g. Audio, Lights, AV"
                                  value={item.role_category || ''}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      role_category:
                                        e.target.value.trim() || null,
                                    })
                                  }
                                  readOnly={readOnly}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {!readOnly && (
                                  <Flex gap="2" wrap="wrap" mt="2">
                                    <Text
                                      size="1"
                                      color="gray"
                                      style={{ width: '100%' }}
                                    >
                                      Quick suggestions:
                                    </Text>
                                    {categorySuggestions.map((suggestion) => (
                                      <Button
                                        key={suggestion}
                                        size="1"
                                        variant="soft"
                                        color="gray"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          updateItem(item.id, {
                                            role_category:
                                              suggestion.toLowerCase(),
                                          })
                                        }}
                                      >
                                        {suggestion}
                                      </Button>
                                    ))}
                                  </Flex>
                                )}
                              </Box>
                            </Flex>

                            {/* Rate Type */}
                            <Box>
                              <Text size="2" color="gray" mb="1">
                                Rate Type
                              </Text>
                              {readOnly ? (
                                <Badge size="1" variant="soft" color="gray">
                                  {item.billing_type === 'hourly'
                                    ? 'Hourly rate'
                                    : 'Daily rate'}
                                </Badge>
                              ) : (
                                <Flex gap="2">
                                  <Button
                                    size="1"
                                    variant={
                                      item.billing_type === 'daily'
                                        ? 'classic'
                                        : 'soft'
                                    }
                                    color={
                                      item.billing_type === 'daily'
                                        ? 'blue'
                                        : 'gray'
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (item.billing_type !== 'daily') {
                                        const fallbackDaily = Math.max(
                                          0,
                                          defaultRatePerDay ?? item.daily_rate,
                                        )
                                        updateItem(item.id, {
                                          billing_type: 'daily',
                                          daily_rate: fallbackDaily,
                                        })
                                      }
                                    }}
                                  >
                                    Daily
                                  </Button>
                                  <Button
                                    size="1"
                                    variant={
                                      item.billing_type === 'hourly'
                                        ? 'classic'
                                        : 'soft'
                                    }
                                    color={
                                      item.billing_type === 'hourly'
                                        ? 'blue'
                                        : 'gray'
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (item.billing_type !== 'hourly') {
                                        const computedHours =
                                          calculateHoursPerDay(
                                            item.start_date,
                                            item.end_date,
                                          ) ??
                                          (item.hours_per_day &&
                                          item.hours_per_day > 0
                                            ? item.hours_per_day
                                            : 8)
                                        const baseHourly =
                                          defaultRatePerHour ??
                                          (item.hourly_rate != null &&
                                          item.hourly_rate > 0
                                            ? item.hourly_rate
                                            : computedHours > 0
                                              ? item.daily_rate / computedHours
                                              : 0)
                                        const resolvedHourly = Number.isFinite(
                                          baseHourly,
                                        )
                                          ? baseHourly
                                          : 0

                                        updateItem(item.id, {
                                          billing_type: 'hourly',
                                          hours_per_day: computedHours,
                                          hourly_rate: Math.max(
                                            0,
                                            resolvedHourly,
                                          ),
                                        })
                                      }
                                    }}
                                  >
                                    Hourly
                                  </Button>
                                </Flex>
                              )}
                            </Box>

                            {/* Details Grid */}
                            <Flex gap="3" wrap="wrap">
                              <Box style={{ minWidth: 120 }}>
                                <Text size="2" color="gray" mb="1">
                                  Crew Count
                                </Text>
                                <TextField.Root
                                  type="number"
                                  min="1"
                                  value={
                                    countDrafts[item.id] ??
                                    String(item.crew_count)
                                  }
                                  onChange={(e) => {
                                    const nextValue = e.target.value
                                    setCountDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: nextValue,
                                    }))

                                    if (nextValue === '') return
                                    const parsed = Number(nextValue)
                                    if (Number.isNaN(parsed)) return

                                    updateItem(item.id, {
                                      crew_count: Math.max(1, parsed),
                                    })
                                    setCountDrafts((prev) => {
                                      const next = { ...prev }
                                      delete next[item.id]
                                      return next
                                    })
                                  }}
                                  onBlur={() => {
                                    if (countDrafts[item.id] === '') {
                                      setCountDrafts((prev) => {
                                        const next = { ...prev }
                                        delete next[item.id]
                                        return next
                                      })
                                    }
                                  }}
                                  style={{ width: 120 }}
                                  readOnly={readOnly}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </Box>

                              <Box style={{ minWidth: 200 }}>
                                <Text size="2" color="gray" mb="1">
                                  Start Date
                                </Text>
                                {readOnly ? (
                                  <Text>
                                    {item.start_date
                                      ? new Date(
                                          item.start_date,
                                        ).toLocaleDateString('nb-NO')
                                      : '—'}
                                  </Text>
                                ) : (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <DateTimePicker
                                      value={item.start_date}
                                      onChange={(value) =>
                                        updateItem(item.id, {
                                          start_date: value,
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </Box>

                              <Box style={{ minWidth: 200 }}>
                                <Text size="2" color="gray" mb="1">
                                  End Date
                                </Text>
                                {readOnly ? (
                                  <Text>
                                    {item.end_date
                                      ? new Date(
                                          item.end_date,
                                        ).toLocaleDateString('nb-NO')
                                      : '—'}
                                  </Text>
                                ) : (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <DateTimePicker
                                      value={item.end_date}
                                      onChange={(value) =>
                                        updateItem(item.id, { end_date: value })
                                      }
                                    />
                                  </div>
                                )}
                              </Box>

                              {item.billing_type === 'daily' ? (
                                <Box style={{ minWidth: 120 }}>
                                  <Text size="2" color="gray" mb="1">
                                    Daily Rate
                                  </Text>
                                  <TextField.Root
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                      dailyRateDrafts[item.id] ??
                                      String(item.daily_rate)
                                    }
                                    onChange={(e) => {
                                      const nextValue = e.target.value
                                      setDailyRateDrafts((prev) => ({
                                        ...prev,
                                        [item.id]: nextValue,
                                      }))

                                      if (nextValue === '') return
                                      const parsed = Number(nextValue)
                                      if (Number.isNaN(parsed)) return

                                      updateItem(item.id, {
                                        daily_rate: Math.max(0, parsed),
                                      })
                                      setDailyRateDrafts((prev) => {
                                        const next = { ...prev }
                                        delete next[item.id]
                                        return next
                                      })
                                    }}
                                    onBlur={() => {
                                      if (dailyRateDrafts[item.id] === '') {
                                        setDailyRateDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[item.id]
                                          return next
                                        })
                                      }
                                    }}
                                    placeholder={
                                      defaultRatePerDay != null
                                        ? String(defaultRatePerDay)
                                        : undefined
                                    }
                                    style={{ width: 110 }}
                                    readOnly={readOnly}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </Box>
                              ) : (
                                <>
                                  <Box style={{ minWidth: 120 }}>
                                    <Text size="2" color="gray" mb="1">
                                      Hourly Rate
                                    </Text>
                                    <TextField.Root
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        item.hourly_rate == null
                                          ? ''
                                          : String(item.hourly_rate)
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === '') {
                                          updateItem(item.id, {
                                            hourly_rate: null,
                                          })
                                          return
                                        }
                                        updateItem(item.id, {
                                          hourly_rate: Math.max(
                                            0,
                                            Number(value) || 0,
                                          ),
                                        })
                                      }}
                                      onBlur={() => {
                                        if (item.hourly_rate == null) {
                                          updateItem(item.id, {
                                            hourly_rate:
                                              defaultRatePerHour ?? 0,
                                          })
                                        }
                                      }}
                                      placeholder={
                                        defaultRatePerHour != null
                                          ? String(defaultRatePerHour)
                                          : undefined
                                      }
                                      style={{ width: 110 }}
                                      readOnly={readOnly}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {!readOnly &&
                                      defaultRatePerHour != null && (
                                        <Text
                                          size="1"
                                          color="gray"
                                          style={{ fontStyle: 'italic' }}
                                          mt="1"
                                        >
                                          Default:{' '}
                                          {formatCurrency(defaultRatePerHour)}
                                          /hour
                                        </Text>
                                      )}
                                  </Box>
                                  <Box style={{ minWidth: 120 }}>
                                    <Text size="2" color="gray" mb="1">
                                      Hours per Day
                                    </Text>
                                    <TextField.Root
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      value={
                                        formattedHoursPerDay != null
                                          ? formattedHoursPerDay.toFixed(2)
                                          : ''
                                      }
                                      style={{ width: 110 }}
                                      disabled
                                      readOnly
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </Box>
                                  <Box style={{ minWidth: 160 }}>
                                    <Text size="2" color="gray" mb="1">
                                      Daily Equivalent
                                    </Text>
                                    <Flex direction="column" gap="1">
                                      <Text weight="medium">
                                        {formatCurrency(item.daily_rate)}
                                      </Text>
                                      <Text size="1" color="gray">
                                        per day
                                      </Text>
                                    </Flex>
                                  </Box>
                                </>
                              )}
                            </Flex>

                            {/* Summary */}
                            <Box
                              p="2"
                              style={{
                                background: 'var(--gray-a3)',
                                borderRadius: 4,
                              }}
                            >
                              <Flex justify="between" align="center">
                                <Text size="2" color="gray">
                                  {days} day{days !== 1 ? 's' : ''} ×{' '}
                                  {item.crew_count} crew
                                  {item.crew_count !== 1 ? 's' : ''}{' '}
                                  {item.billing_type === 'hourly'
                                    ? `• ${(formattedHoursPerDay ?? 0).toFixed(2)}h/day @ ${formatCurrency(displayHourlyRate ?? 0)}/hour`
                                    : `• ${formatCurrency(item.daily_rate)}/day`}
                                </Text>
                                <Text weight="medium">
                                  Total: {formatCurrency(total)}
                                </Text>
                              </Flex>
                            </Box>
                          </Flex>
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Always show empty state box at bottom */}
      <Box
        p="4"
        style={{
          border: '2px dashed var(--gray-a6)',
          borderRadius: 8,
          textAlign: 'center',
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 100ms',
        }}
        onClick={readOnly ? undefined : addItem}
        onMouseEnter={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }
        }}
        onMouseLeave={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <Flex direction="column" align="center" gap="2">
          {!readOnly && <Plus width={24} height={24} />}
          <Text size="2" color="gray">
            {readOnly ? 'No crew items yet' : 'Add crew item'}
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}

// Helper function to format vehicle category for display
function formatVehicleCategory(
  category:
    | 'passenger_car_small'
    | 'passenger_car_medium'
    | 'passenger_car_big'
    | 'van_small'
    | 'van_medium'
    | 'van_big'
    | 'C1'
    | 'C1E'
    | 'C'
    | 'CE'
    | null,
): string {
  if (!category) return '—'
  const map: Record<string, string> = {
    passenger_car_small: 'Passenger Car - Small',
    passenger_car_medium: 'Passenger Car - Medium',
    passenger_car_big: 'Passenger Car - Big',
    van_small: 'Van - Small',
    van_medium: 'Van - Medium',
    van_big: 'Van - Big',
    C1: 'C1',
    C1E: 'C1E',
    C: 'C',
    CE: 'CE',
  }
  return map[category] || category
}

// Transport Section Component
function TransportSection({
  items,
  onItemsChange,
  companyId: _companyId,
  readOnly = false,
  jobStartAt,
  jobEndAt,
  vehicleDailyRate,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
}: {
  items: Array<LocalTransportItem>
  onItemsChange: (items: Array<LocalTransportItem>) => void
  companyId: string
  readOnly?: boolean
  jobStartAt?: string | null
  jobEndAt?: string | null
  vehicleDailyRate?: number | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number
}) {
  const addItem = () => {
    // Default to job duration if available, otherwise use current time + 1 day
    // This ensures times default to the job length (start_at to end_at)
    const startDate = jobStartAt ? new Date(jobStartAt) : new Date()
    const endDate = jobEndAt
      ? new Date(jobEndAt)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000) // +1 day if no job end
    const increment = Math.max(1, vehicleDistanceIncrement ?? 150)

    // Ensure we preserve the full date-time from the job
    const newItem: LocalTransportItem = {
      id: `temp-${Date.now()}`,
      vehicle_name: '',
      vehicle_id: null,
      vehicle_category: null,
      distance_km: increment,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      daily_rate: null,
      distance_rate: null,
      is_internal: true,
      sort_order: items.length,
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (itemId: string, updates: Partial<LocalTransportItem>) => {
    onItemsChange(
      items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    )
  }

  const deleteItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Transport</Heading>
        {!readOnly && (
          <Button size="2" onClick={addItem}>
            <Plus width={16} height={16} /> Add Transport Item
          </Button>
        )}
      </Flex>

      {items.length > 0 && (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Vehicle Category</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Distance (km)</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Start Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>End Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Daily Rate</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Distance Rate</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
              {!readOnly && <Table.ColumnHeaderCell />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => {
              const companyDailyRate = vehicleDailyRate ?? null
              const companyDistanceRate = vehicleDistanceRate ?? null
              const distanceIncrement = Math.max(
                1,
                vehicleDistanceIncrement ?? 150,
              )
              const dailyRateValue = item.daily_rate ?? companyDailyRate
              const distanceRateValue =
                item.distance_rate ?? companyDistanceRate
              const adjustDistance = (delta: number) => {
                const step = distanceIncrement
                const current = item.distance_km ?? step
                const next = current + delta
                const minValue = step
                let snapped: number
                if (delta >= 0) {
                  snapped = Math.ceil(next / step) * step
                } else {
                  snapped = Math.floor(next / step) * step
                }
                if (snapped < minValue) snapped = minValue
                updateItem(item.id, { distance_km: snapped })
              }

              const days = Math.ceil(
                (new Date(item.end_date).getTime() -
                  new Date(item.start_date).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
              // Calculate total: daily_rate * days + distance_rate * (distance rounded up to increment)
              // Use item's daily_rate if set, otherwise use default from company
              const effectiveDailyRate = dailyRateValue ?? 0
              const dailyCost = effectiveDailyRate * Math.max(1, days)

              // Use item's distance_rate if set, otherwise use default from company
              const effectiveDistanceRate = distanceRateValue
              const distanceIncrements = item.distance_km
                ? Math.ceil(item.distance_km / distanceIncrement)
                : 0
              const distanceCost =
                effectiveDistanceRate && distanceIncrements > 0
                  ? effectiveDistanceRate * distanceIncrements
                  : 0
              const total = dailyCost + distanceCost
              const isUsingDefaultDistanceRate =
                companyDistanceRate !== null &&
                (item.distance_rate === null ||
                  item.distance_rate === companyDistanceRate)
              const isUsingDefaultDailyRate =
                companyDailyRate !== null &&
                (item.daily_rate === null ||
                  item.daily_rate === companyDailyRate)

              return (
                <Table.Row key={item.id} style={{ verticalAlign: 'middle' }}>
                  <Table.Cell>
                    {readOnly ? (
                      <Text>
                        {formatVehicleCategory(item.vehicle_category)}
                      </Text>
                    ) : (
                      <Select.Root
                        value={item.vehicle_category ?? ''}
                        onValueChange={(value) =>
                          updateItem(item.id, {
                            vehicle_category: (value ||
                              null) as LocalTransportItem['vehicle_category'],
                          })
                        }
                      >
                        <Select.Trigger placeholder="Select category" />
                        <Select.Content style={{ zIndex: 10000 }}>
                          <Select.Item value="passenger_car_small">
                            Passenger Car - Small
                          </Select.Item>
                          <Select.Item value="passenger_car_medium">
                            Passenger Car - Medium
                          </Select.Item>
                          <Select.Item value="passenger_car_big">
                            Passenger Car - Big
                          </Select.Item>
                          <Select.Item value="van_small">
                            Van - Small
                          </Select.Item>
                          <Select.Item value="van_medium">
                            Van - Medium
                          </Select.Item>
                          <Select.Item value="van_big">Van - Big</Select.Item>
                          <Select.Item value="C1">C1</Select.Item>
                          <Select.Item value="C1E">C1E</Select.Item>
                          <Select.Item value="C">C</Select.Item>
                          <Select.Item value="CE">CE</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ verticalAlign: 'middle' }}>
                    {readOnly ? (
                      <Text>{item.distance_km ?? '—'}</Text>
                    ) : (
                      <Flex align="center" gap="1">
                        <TextField.Root
                          type="number"
                          min={distanceIncrement}
                          step={String(distanceIncrement)}
                          value={String(item.distance_km ?? '')}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === '') {
                              updateItem(item.id, { distance_km: null })
                            } else {
                              const numValue = Number(value) || 0
                              // Force to nearest increment (round to nearest)
                              const rounded =
                                Math.round(numValue / distanceIncrement) *
                                distanceIncrement
                              updateItem(item.id, {
                                distance_km: Math.max(
                                  distanceIncrement,
                                  rounded,
                                ),
                              })
                            }
                          }}
                          onBlur={() => {
                            // Ensure value is rounded to increment on blur
                            if (
                              item.distance_km !== null &&
                              item.distance_km > 0
                            ) {
                              const rounded =
                                Math.round(
                                  item.distance_km / distanceIncrement,
                                ) * distanceIncrement
                              const nextValue = Math.max(
                                distanceIncrement,
                                rounded,
                              )
                              if (nextValue !== item.distance_km) {
                                updateItem(item.id, { distance_km: nextValue })
                              }
                            }
                            if (
                              item.distance_km !== null &&
                              item.distance_km < distanceIncrement
                            ) {
                              updateItem(item.id, {
                                distance_km: distanceIncrement,
                              })
                            }
                          }}
                          placeholder="Distance"
                          style={{ width: 80 }}
                        />
                        <Flex
                          direction="column"
                          gap="1"
                          style={{ alignSelf: 'stretch' }}
                        >
                          <IconButton
                            size="1"
                            variant="soft"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              adjustDistance(distanceIncrement)
                            }}
                            style={{ width: 20, height: 18, padding: 0 }}
                          >
                            <NavArrowUp width={12} height={12} />
                          </IconButton>
                          <IconButton
                            size="1"
                            variant="soft"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              adjustDistance(-distanceIncrement)
                            }}
                            style={{ width: 20, height: 18, padding: 0 }}
                          >
                            <NavArrowDown width={12} height={12} />
                          </IconButton>
                        </Flex>
                      </Flex>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ verticalAlign: 'middle' }}>
                    {readOnly ? (
                      <Text>
                        {item.start_date
                          ? new Date(item.start_date).toLocaleDateString(
                              'nb-NO',
                            )
                          : '—'}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={item.start_date}
                        onChange={(value) =>
                          updateItem(item.id, { start_date: value })
                        }
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ verticalAlign: 'middle' }}>
                    {readOnly ? (
                      <Text>
                        {item.end_date
                          ? new Date(item.end_date).toLocaleDateString('nb-NO')
                          : '—'}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={item.end_date}
                        onChange={(value) =>
                          updateItem(item.id, { end_date: value })
                        }
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ verticalAlign: 'middle' }}>
                    <Flex direction="column" gap="1">
                      <TextField.Root
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          dailyRateValue == null ? '' : String(dailyRateValue)
                        }
                        onChange={(e) => {
                          const value = e.target.value
                          // If empty, set to null (use default)
                          if (value === '') {
                            updateItem(item.id, { daily_rate: null })
                          } else {
                            const numValue = Number(value) || 0
                            updateItem(item.id, {
                              daily_rate: Math.max(0, numValue),
                            })
                          }
                        }}
                        placeholder={
                          companyDailyRate !== null
                            ? String(companyDailyRate)
                            : 'Not set'
                        }
                        style={{ width: 100 }}
                        readOnly={readOnly}
                      />
                      {!readOnly &&
                        companyDailyRate !== null &&
                        !isUsingDefaultDailyRate && (
                          <Text
                            size="1"
                            color="gray"
                            style={{ fontStyle: 'italic' }}
                          >
                            Default: {formatCurrency(companyDailyRate)}/day
                          </Text>
                        )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell style={{ verticalAlign: 'middle' }}>
                    <Flex direction="column" gap="1">
                      <TextField.Root
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          distanceRateValue == null
                            ? ''
                            : String(distanceRateValue)
                        }
                        onChange={(e) => {
                          const value = e.target.value
                          // If empty, set to null to use default
                          if (value === '') {
                            updateItem(item.id, { distance_rate: null })
                          } else {
                            const numValue = Number(value) || 0
                            updateItem(item.id, {
                              distance_rate: Math.max(0, numValue),
                            })
                          }
                        }}
                        placeholder={
                          companyDistanceRate !== null
                            ? String(companyDistanceRate)
                            : 'Not set'
                        }
                        style={{ width: 100 }}
                        readOnly={readOnly}
                      />
                      {!readOnly &&
                        !isUsingDefaultDistanceRate &&
                        companyDistanceRate !== null && (
                          <Text
                            size="1"
                            color="gray"
                            style={{ fontStyle: 'italic' }}
                          >
                            Default: {formatCurrency(companyDistanceRate)} /{' '}
                            {distanceIncrement}km
                          </Text>
                        )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{formatCurrency(total)}</Text>
                  </Table.Cell>
                  {!readOnly && (
                    <Table.Cell align="right">
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    </Table.Cell>
                  )}
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      )}

      {/* Always show empty state box at bottom */}
      <Box
        p="4"
        style={{
          border: '2px dashed var(--gray-a6)',
          borderRadius: 8,
          textAlign: 'center',
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 100ms',
        }}
        onClick={readOnly ? undefined : addItem}
        onMouseEnter={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }
        }}
        onMouseLeave={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <Flex direction="column" align="center" gap="2">
          {!readOnly && <Plus width={24} height={24} />}
          <Text size="2" color="gray">
            {readOnly ? 'No transport items yet' : 'Add transport item'}
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}

// Totals Section Component
function TotalsSection({
  totals,
}: {
  totals: ReturnType<typeof calculateOfferTotals>
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Heading size="3">Totals</Heading>
      <Table.Root variant="surface">
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Equipment Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.equipmentSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Crew Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.crewSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Transport Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.transportSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Total Before Discount</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.totalBeforeDiscount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">
                Equipment discount ({totals.discountPercent}%)
              </Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text color="red">
                -
                {formatCurrency(totals.discountAmount)}
              </Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Total After Discount</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.totalAfterDiscount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">VAT ({totals.vatPercent}%)</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>
                {formatCurrency(
                  totals.totalWithVAT - totals.totalAfterDiscount,
                )}
              </Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text size="4" weight="bold">
                Total With VAT
              </Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text size="4" weight="bold">
                {formatCurrency(totals.totalWithVAT)}
              </Text>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Flex>
  )
}
