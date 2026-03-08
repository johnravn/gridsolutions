// src/features/jobs/api/invoiceQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type BookingInvoiceLine = {
  id: string
  type: 'equipment' | 'crew' | 'transport'
  description: string
  brandName?: string | null
  model?: string | null
  quantity: number
  unitPrice: number // Price ex VAT per unit
  totalPrice: number // Total ex VAT
  vatPercent: number
  /** Billing unit for crew/transport: 'day' or 'hour'. Equipment has no unit. */
  unit?: 'day' | 'hour'
  timePeriodId: string
  timePeriodTitle: string | null
  startAt: string
  endAt: string
}

export type BookingsForInvoice = {
  equipment: Array<BookingInvoiceLine>
  crew: Array<BookingInvoiceLine>
  transport: Array<BookingInvoiceLine>
  all: Array<BookingInvoiceLine>
  totalExVat: number
  totalVat: number
  totalWithVat: number
}

/**
 * Fetch all bookings for a job with pricing information for invoice creation
 */
export function jobBookingsForInvoiceQuery({
  jobId,
  companyId,
  defaultVatPercent = 25,
}: {
  jobId: string
  companyId: string
  defaultVatPercent?: number
}) {
  return queryOptions<BookingsForInvoice>({
    queryKey: ['jobs', jobId, 'invoice', 'bookings', defaultVatPercent],
    queryFn: async (): Promise<BookingsForInvoice> => {
      // Fetch job with customer and crew_pricing_level for crew rates
      const { data: jobData } = await supabase
        .from('jobs')
        .select(
          `customer_id,
          customer:customers!jobs_customer_id_fkey (
            crew_pricing_level_id,
            crew_pricing_level:crew_pricing_level_id (
              crew_rate_per_day,
              crew_rate_per_hour,
              default_crew_billing_unit
            )
          )`,
        )
        .eq('id', jobId)
        .maybeSingle()

      const customer = Array.isArray((jobData as any)?.customer)
        ? (jobData as any)?.customer?.[0]
        : (jobData as any)?.customer
      const crewLevel = Array.isArray(customer?.crew_pricing_level)
        ? customer?.crew_pricing_level?.[0]
        : customer?.crew_pricing_level

      // Fetch company expansion for rates (crew standard + vehicle)
      const { data: companyExpansion } = await supabase
        .from('company_expansions')
        .select(
          'crew_rate_per_day, crew_rate_per_hour, default_crew_billing_unit, vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment',
        )
        .eq('company_id', companyId)
        .maybeSingle()

      const crewBillingUnit: 'day' | 'hour' =
        (crewLevel?.default_crew_billing_unit ??
          (companyExpansion as { default_crew_billing_unit?: string })
            ?.default_crew_billing_unit ??
          'hour') === 'hour'
          ? 'hour'
          : 'day'
      const crewRatePerDay =
        crewLevel?.crew_rate_per_day ??
        (companyExpansion?.crew_rate_per_day ?? 0)
      const crewRatePerHour =
        crewLevel?.crew_rate_per_hour ??
        (companyExpansion?.crew_rate_per_hour ?? 0)

      const vehicleDailyRate = companyExpansion?.vehicle_daily_rate ?? 0
      const vehicleDistanceRate = companyExpansion?.vehicle_distance_rate ?? 0
      const vehicleDistanceIncrement =
        companyExpansion?.vehicle_distance_increment ?? 0

      // Fetch all time periods for this job
      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, category')
        .eq('job_id', jobId)
        .eq('deleted', false)

      if (tpError) throw tpError

      if (!timePeriods || timePeriods.length === 0) {
        return {
          equipment: [],
          crew: [],
          transport: [],
          all: [],
          totalExVat: 0,
          totalVat: 0,
          totalWithVat: 0,
        }
      }

      const timePeriodIds = timePeriods.map((tp) => tp.id)
      const timePeriodMap = new Map(timePeriods.map((tp) => [tp.id, tp]))

      // Helper to calculate days between two dates
      const calculateDays = (start: string, end: string): number => {
        const startDate = new Date(start)
        const endDate = new Date(end)
        const diffMs = endDate.getTime() - startDate.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        return Math.max(1, diffDays) // At least 1 day
      }

      const calculateHours = (start: string, end: string): number => {
        const startDate = new Date(start)
        const endDate = new Date(end)
        const diffMs = endDate.getTime() - startDate.getTime()
        return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
      }

      // Fetch equipment bookings
      const { data: equipmentBookings, error: eqError } = await supabase
        .from('reserved_items')
        .select(
          `
          id, time_period_id, item_id, quantity,
          item:item_id (
            id, name, model,
            brand:brand_id ( name )
          )
        `,
        )
        .in('time_period_id', timePeriodIds)

      if (eqError) throw eqError

      // Fetch prices separately from item_current_price view
      const itemIds =
        equipmentBookings
          ?.map((b) => b.item_id)
          .filter((id): id is string => !!id) ?? []
      const pricesMap = new Map<string, number | null>()
      if (itemIds.length > 0) {
        const { data: prices, error: pricesError } = await supabase
          .from('item_current_price')
          .select('item_id, current_price')
          .in('item_id', itemIds)

        if (pricesError) throw pricesError

        if (prices) {
          for (const price of prices) {
            pricesMap.set(price.item_id, price.current_price)
          }
        }
      }

      // Fetch crew roles (time_periods with category='crew') - invoice uses roles, not assigned crew
      const crewTimePeriodIds = timePeriods
        .filter((tp) => tp.category === 'crew')
        .map((tp) => tp.id)
      const { data: crewRoles, error: crewError } =
        crewTimePeriodIds.length > 0
          ? await supabase
              .from('time_periods')
              .select('id, title, role_category, needed_count, start_at, end_at')
              .in('id', crewTimePeriodIds)
          : { data: [], error: null }

      if (crewError) throw crewError

      // Fetch transport bookings
      const { data: transportBookings, error: transError } = await supabase
        .from('reserved_vehicles')
        .select(
          `
          id, time_period_id, vehicle_id,
          vehicle:vehicle_id (
            id, name
          ),
          time_period:time_period_id (
            id, start_at, end_at
          )
        `,
        )
        .in('time_period_id', timePeriodIds)

      if (transError) throw transError

      // Process equipment bookings - description = brand + model
      const equipmentLines: Array<BookingInvoiceLine> = []
      if (equipmentBookings) {
        for (const booking of equipmentBookings) {
          const item = Array.isArray(booking.item)
            ? booking.item[0]
            : booking.item
          const timePeriod = timePeriodMap.get(booking.time_period_id)
          if (!item || !timePeriod) continue
          const brand = Array.isArray(item.brand) ? item.brand[0] : item.brand
          const brandName = brand?.name ?? null
          const model = item.model ?? null
          const desc =
            [brandName, model].filter(Boolean).join(' ') ||
            item.name ||
            'Equipment'

          const unitPrice = pricesMap.get(booking.item_id) ?? 0
          const quantity = booking.quantity
          const totalPrice = unitPrice * quantity

          equipmentLines.push({
            id: booking.id,
            type: 'equipment',
            description: desc,
            brandName,
            model,
            quantity,
            unitPrice,
            totalPrice,
            vatPercent: defaultVatPercent,
            timePeriodId: booking.time_period_id,
            timePeriodTitle: timePeriod.title,
            startAt: timePeriod.start_at,
            endAt: timePeriod.end_at,
          })
        }
      }

      // Process crew roles (one line per role, using role title/category - not assigned crew)
      const crewLines: Array<BookingInvoiceLine> = []
      if (crewRoles) {
        for (const role of crewRoles) {
          const timePeriod = timePeriodMap.get(role.id)
          if (!timePeriod) continue

          const startAt = role.start_at
          const endAt = role.end_at
          const neededCount = Math.max(1, role.needed_count ?? 1)
          const roleLabel =
            role.title?.trim() ||
            role.role_category?.trim() ||
            'technician'
          const unitLabel =
            crewBillingUnit === 'hour'
              ? 'per hour'
              : 'per day'
          const roleDescription = `Crew - ${roleLabel} - ${unitLabel}`

          let quantity: number
          let unitPrice: number
          const unit: 'day' | 'hour' = crewBillingUnit

          if (crewBillingUnit === 'hour') {
            quantity =
              neededCount *
              Math.max(0.1, calculateHours(startAt, endAt))
            unitPrice = crewRatePerHour
          } else {
            quantity = neededCount * calculateDays(startAt, endAt)
            unitPrice = crewRatePerDay
          }
          const totalPrice = unitPrice * quantity

          crewLines.push({
            id: role.id,
            type: 'crew',
            description: roleDescription,
            brandName: null,
            model: null,
            quantity,
            unitPrice,
            totalPrice,
            vatPercent: defaultVatPercent,
            unit,
            timePeriodId: role.id,
            timePeriodTitle: timePeriod.title,
            startAt,
            endAt,
          })
        }
      }

      // Process transport bookings
      const transportLines: Array<BookingInvoiceLine> = []
      if (transportBookings) {
        for (const booking of transportBookings) {
          const vehicle = Array.isArray(booking.vehicle)
            ? booking.vehicle[0]
            : booking.vehicle
          const timePeriod = Array.isArray(booking.time_period)
            ? booking.time_period[0]
            : booking.time_period

          if (!vehicle || !timePeriod) continue

          const startAt = timePeriod.start_at
          const endAt = timePeriod.end_at
          const days = calculateDays(startAt, endAt)

          // Calculate transport cost: daily rate * days
          // Note: Distance-based calculation would require additional data
          const unitPrice = vehicleDailyRate
          const quantity = days
          const totalPrice = unitPrice * quantity

          transportLines.push({
            id: booking.id,
            type: 'transport',
            description: `Transport - ${vehicle.name || 'Vehicle'} - per day`,
            brandName: null,
            model: null,
            quantity,
            unitPrice,
            totalPrice,
            vatPercent: defaultVatPercent,
            unit: 'day',
            timePeriodId: booking.time_period_id,
            timePeriodTitle: timePeriod.title || null,
            startAt,
            endAt,
          })
        }
      }

      // Combine all lines
      const allLines = [...equipmentLines, ...crewLines, ...transportLines]

      // Calculate totals
      const totalExVat = allLines.reduce(
        (sum, line) => sum + line.totalPrice,
        0,
      )
      const totalVat = allLines.reduce(
        (sum, line) => sum + (line.totalPrice * line.vatPercent) / 100,
        0,
      )
      const totalWithVat = totalExVat + totalVat

      return {
        equipment: equipmentLines,
        crew: crewLines,
        transport: transportLines,
        all: allLines,
        totalExVat,
        totalVat,
        totalWithVat,
      }
    },
  })
}
