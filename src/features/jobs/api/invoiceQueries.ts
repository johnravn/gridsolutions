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
      // Fetch company expansion for rates
      const { data: companyExpansion } = await supabase
        .from('company_expansions')
        .select(
          'vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment',
        )
        .eq('company_id', companyId)
        .maybeSingle()

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

      // Fetch crew bookings (include all statuses for invoice purposes)
      const { data: crewBookings, error: crewError } = await supabase
        .from('reserved_crew')
        .select('id, time_period_id, user_id')
        .in('time_period_id', timePeriodIds)

      if (crewError) throw crewError

      // Fetch user data separately from profiles
      const userIds =
        crewBookings
          ?.map((b) => b.user_id)
          .filter((id): id is string => !!id) ?? []
      const usersMap = new Map<
        string,
        { user_id: string; display_name: string | null; email: string }
      >()
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds)

        if (usersError) throw usersError

        if (users) {
          for (const user of users) {
            usersMap.set(user.user_id, user)
          }
        }
      }

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

      // Process equipment bookings
      const equipmentLines: Array<BookingInvoiceLine> = []
      if (equipmentBookings) {
        for (const booking of equipmentBookings) {
          const item = Array.isArray(booking.item)
            ? booking.item[0]
            : booking.item
          const timePeriod = timePeriodMap.get(booking.time_period_id)
          if (!item || !timePeriod) continue
          const brand = Array.isArray(item.brand) ? item.brand[0] : item.brand

          const unitPrice = pricesMap.get(booking.item_id) ?? 0
          const quantity = booking.quantity
          const totalPrice = unitPrice * quantity

          equipmentLines.push({
            id: booking.id,
            type: 'equipment',
            description: item.name || 'Equipment',
            brandName: brand?.name ?? null,
            model: item.model ?? null,
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

      // Process crew bookings
      const crewLines: Array<BookingInvoiceLine> = []
      if (crewBookings) {
        // Default crew daily rate (could be fetched from company settings)
        // For now, using a placeholder - this should ideally come from company_expansions or a crew rate table
        // Note: Crew rates are not currently stored in the database, so this defaults to 0
        // Users should set prices manually or configure crew rates in company settings
        const defaultCrewDailyRate = 0 // TODO: Fetch from company settings

        for (const booking of crewBookings) {
          const user = usersMap.get(booking.user_id)
          const timePeriod = timePeriodMap.get(booking.time_period_id)
          if (!user || !timePeriod) continue

          // Use time period times (reserved_crew doesn't have start_at/end_at columns)
          const startAt = timePeriod.start_at
          const endAt = timePeriod.end_at
          const days = calculateDays(startAt, endAt)

          const unitPrice = defaultCrewDailyRate
          const quantity = days
          const totalPrice = unitPrice * quantity

          crewLines.push({
            id: booking.id,
            type: 'crew',
            description: `${user.display_name || user.email || 'Crew member'}`,
            brandName: null,
            model: null,
            quantity,
            unitPrice,
            totalPrice,
            vatPercent: defaultVatPercent,
            timePeriodId: booking.time_period_id,
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
            description: vehicle.name || 'Vehicle',
            brandName: null,
            model: null,
            quantity,
            unitPrice,
            totalPrice,
            vatPercent: defaultVatPercent,
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
