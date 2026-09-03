// src/features/jobs/utils/offerLinesToBookings.ts
import { normalizeTransportGroups } from './transportGroups'
import { defaultDescriptionForLine } from './invoiceLineDescription'
import { roundMoney } from './offerCalculations'
import type {
  OfferCrewItem,
  OfferDetail,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../types'
import type {
  BookingInvoiceLine,
  BookingsForInvoice,
} from '../api/invoiceQueries'

/**
 * Convert a technical offer's detail (equipment groups, crew items, transport
 * items) into `BookingsForInvoice` so the invoice preview can render individual
 * lines instead of a single summary line.
 *
 * Equipment: quantity stays the ordered count; unit price is the stored line
 * total ÷ qty (price-per-day × rental factor). Apply equipment discount via
 * `equipmentDiscountOverridesFromOffer`, not a separate discount line.
 *
 * Transport: one line at the stored offer total (qty 1). No rental-factor
 * qty, no discount. Name is the vehicle from the offer.
 *
 * `is_internal` on offer items means company-owned stock, not "hide from invoice".
 */
export function offerLinesToBookings(offer: OfferDetail): BookingsForInvoice {
  const equipment: Array<BookingInvoiceLine> = []
  const crew: Array<BookingInvoiceLine> = []
  const transport: Array<BookingInvoiceLine> = []

  const jobFields = {
    jobId: offer.job_id,
    jobTitle: offer.job_title ?? offer.title,
  }

  for (const group of offer.groups ?? []) {
    for (const item of group.items ?? []) {
      equipment.push(equipmentLine(offer, item, jobFields))
    }
  }

  for (const c of offer.crew_items ?? []) {
    crew.push(crewLine(offer, c, jobFields))
  }

  const seenTransportIds = new Set<string>()
  for (const group of normalizeTransportGroups(offer)) {
    for (const t of group.items) {
      if (seenTransportIds.has(t.id)) continue
      seenTransportIds.add(t.id)
      transport.push(transportLine(offer, t, jobFields))
    }
  }

  const all = [...equipment, ...crew, ...transport]
  const totalExVat = roundMoney(all.reduce((sum, l) => sum + l.totalPrice, 0))
  const totalVat = roundMoney(
    all.reduce((sum, l) => sum + (l.totalPrice * l.vatPercent) / 100, 0),
  )

  return {
    equipment,
    crew,
    transport,
    all,
    totalExVat,
    totalVat,
    totalWithVat: roundMoney(totalExVat + totalVat),
  }
}

function equipmentLine(
  offer: OfferDetail,
  item: OfferEquipmentItem,
  jobFields: { jobId: string; jobTitle: string | null | undefined },
): BookingInvoiceLine {
  // Match bookings: `groupName` is only for inventory groups. The offer section
  // name must not be used here — `itemName` tokens would become "Section (Group)".
  const inventoryGroupName = item.group?.name?.trim() || null
  const itemName =
    item.custom_line_description?.trim() || item.item?.name || null
  const quantity = item.quantity > 0 ? item.quantity : 1
  const lineTotal = roundMoney(item.total_price)
  // Bake rental factor into unit: total ÷ qty (= daily × factor).
  const unitPrice = roundMoney(lineTotal / quantity)
  const line: BookingInvoiceLine = {
    id: item.id,
    type: 'equipment',
    description: itemName || inventoryGroupName || 'Equipment',
    brandName: item.custom_line_brand ?? item.item?.brand?.name ?? null,
    model: item.custom_line_model ?? item.item?.model ?? null,
    groupName: inventoryGroupName,
    itemName,
    rentalDays: offer.days_of_use > 0 ? offer.days_of_use : null,
    quantity,
    unitPrice,
    totalPrice: lineTotal,
    vatPercent: offer.vat_percent,
    timePeriodId: item.time_period_id ?? '',
    timePeriodTitle: null,
    startAt: '',
    endAt: '',
    ...jobFields,
  }
  return { ...line, description: defaultDescriptionForLine(line) }
}

function crewLine(
  offer: OfferDetail,
  c: OfferCrewItem,
  jobFields: { jobId: string; jobTitle: string | null | undefined },
): BookingInvoiceLine {
  const days = crewDayCount(c.start_date, c.end_date)
  const isHourly = c.billing_type === 'hourly'
  const rate = isHourly ? (c.hourly_rate ?? c.daily_rate) : c.daily_rate
  const quantity = isHourly
    ? days * (c.hours_per_day ?? 8) * c.crew_count
    : days * c.crew_count
  const lineTotal = roundMoney(c.total_price)
  const unitPrice =
    quantity > 0 ? roundMoney(lineTotal / quantity) : roundMoney(rate)
  const line: BookingInvoiceLine = {
    id: c.id,
    type: 'crew',
    description: c.role_title || 'Crew',
    roleLabel: c.role_title,
    quantity: quantity > 0 ? quantity : 1,
    unitPrice,
    totalPrice: lineTotal,
    vatPercent: offer.vat_percent,
    unit: isHourly ? 'hour' : 'day',
    timePeriodId: '',
    timePeriodTitle: null,
    startAt: c.start_date ?? '',
    endAt: c.end_date ?? '',
    ...jobFields,
  }
  return { ...line, description: defaultDescriptionForLine(line) }
}

function transportLine(
  offer: OfferDetail,
  t: OfferTransportItem,
  jobFields: { jobId: string; jobTitle: string | null | undefined },
): BookingInvoiceLine {
  const vehicleName = t.vehicle_name?.trim() || 'Transport'
  const lineTotal = roundMoney(t.total_price)
  const line: BookingInvoiceLine = {
    id: t.id,
    type: 'transport',
    description: vehicleName,
    vehicleName,
    quantity: 1,
    unitPrice: lineTotal,
    totalPrice: lineTotal,
    vatPercent: offer.vat_percent,
    timePeriodId: '',
    timePeriodTitle: null,
    startAt: t.start_date ?? '',
    endAt: t.end_date ?? '',
    ...jobFields,
  }
  return { ...line, description: defaultDescriptionForLine(line) }
}

/** Offer discount applies to equipment only — same as calculateOfferTotals. */
export function equipmentDiscountOverridesFromOffer(
  offer: Pick<OfferDetail, 'discount_percent' | 'groups'>,
): Record<string, number> {
  const percent = offer.discount_percent ?? 0
  if (percent <= 0) return {}
  const overrides: Record<string, number> = {}
  for (const group of offer.groups ?? []) {
    for (const item of group.items ?? []) {
      overrides[item.id] = percent
    }
  }
  return overrides
}

function crewDayCount(start?: string | null, end?: string | null): number {
  if (!start || !end) return 1
  const s = new Date(start)
  const e = new Date(end)
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff)
}
