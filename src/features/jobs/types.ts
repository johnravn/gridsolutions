// src/features/jobs/types.ts

export type UUID = string

/* ---------- Job core ---------- */

export type JobStatus =
  | 'draft'
  | 'planned'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'invoiced'
  | 'paid'

export type InvoiceBasis = 'offer' | 'bookings'

export type JobListRow = {
  id: UUID
  company_id: UUID
  title: string
  jobnr: number | null
  status: JobStatus
  start_at: string | null
  end_at: string | null
  customer_contact_id: UUID | null
  archived: boolean
  customer?: {
    id: UUID
    name: string | null
  } | null
  customer_user?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null
  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type AddressListRow = {
  id: UUID
  company_id: UUID
  name: string | null
  address_line: string
  zip_code: string
  city: string
  country: string
  deleted: boolean
  is_personal: boolean
}

export type JobDetail = {
  id: UUID
  company_id: UUID
  title: string
  jobnr: number | null
  description: string | null
  status: JobStatus
  start_at: string | null
  end_at: string | null
  load_in_at: string | null
  load_out_at: string | null
  archived: boolean
  invoice_basis: InvoiceBasis | null

  project_lead_user_id: UUID | null
  customer_id: UUID | null
  customer_user_id: UUID | null
  customer_contact_id: UUID | null
  job_address_id: UUID | null

  customer?: {
    id: UUID
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
    vat_number: string | null
  } | null

  customer_user?: {
    user_id: UUID
    display_name: string | null
    email: string
    phone: string | null
  } | null

  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null

  customer_contact?: {
    user_id: UUID
    name: string | null
    email: string | null
    phone: string | null
    title: string | null
  } | null

  address?: {
    id: UUID
    name: string
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

/* ---------- Equipment tab ---------- */

export type ExternalReqStatus = 'planned' | 'requested' | 'confirmed'

export type ItemLite = {
  id: string
  name: string
  category_id?: string | null
  brand_id?: string | null
  model?: string | null
  total_quantity?: number | null
  active?: boolean
  internally_owned?: boolean
  external_owner_id?: string | null
  notes?: string | null

  // Joined relations (optional)
  category?: {
    id: string
    name: string
  } | null

  brand?: {
    id: string
    name: string
  } | null

  // Optional price info if joined in your query
  price?: number | null
}

/**
 * Supabase may type nested single relations as an array when the FK
 * isn't inferred. Allow both shapes so UI can normalize.
 */
export type ReservedItemRow = {
  id: UUID
  time_period_id: UUID
  item_id: UUID
  quantity: number
  source_group_id: UUID | null
  source_kind: 'direct' | 'group'
  status: BookingStatus
  external_status: ExternalReqStatus | null
  external_note: string | null
  forced: boolean
  start_at: string | null // line override (ISO) - nullable => inherits header
  end_at: string | null // line override (ISO)
  item:
    | { id: UUID; name: string; external_owner_id: UUID | null }
    | Array<{ id: UUID; name: string; external_owner_id: UUID | null }>
  source_group?:
    | {
        id: UUID
        name: string
        category_id?: UUID | null
        category?: { name: string } | null
      }
    | Array<{
        id: UUID
        name: string
        category_id?: UUID | null
        category?: { name: string } | null
      }>
    | null
}

export type TimePeriodStatus =
  | 'tentative'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'

export type TimePeriodLite = {
  id: UUID
  job_id: UUID | null
  company_id: UUID
  title: string | null
  start_at: string // ISO
  end_at: string // ISO
  category?: 'program' | 'equipment' | 'crew' | 'transport' | null
}

/* ---------- Crew tab ---------- */

export type BookingStatus = 'planned' | 'confirmed' | 'canceled'

// Legacy type for backward compatibility
export type CrewReqStatus = BookingStatus

export type ReservedCrewRow = {
  id: UUID
  time_period_id: UUID
  user_id: UUID | null
  notes: string | null
  placeholder_name?: string | null
  status: BookingStatus
  start_at: string | null
  end_at: string | null
  user?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null
}

/* ---------- Transport tab ---------- */

export type ReservedVehicleRow = {
  id: UUID
  time_period_id: UUID
  vehicle_id: UUID
  status: BookingStatus
  external_status: ExternalReqStatus | null
  external_note: string | null
  vehicle?: {
    id: UUID
    name: string
    image_path: string | null
    external_owner_id: UUID | null
  } | null
  time_period?: {
    id: UUID
    title: string | null
    notes: string | null
    start_at: string
    end_at: string
  } | null
}

/* ---------- Offers system ---------- */

export type OfferType = 'technical' | 'pretty'
export type OfferStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'superseded'

export type PrettySectionType =
  | 'hero'
  | 'problem'
  | 'solution'
  | 'benefits'
  | 'testimonial'

export type JobOffer = {
  id: UUID
  job_id: UUID
  company_id: UUID
  offer_type: OfferType
  version_number: number
  status: OfferStatus
  access_token: string
  title: string
  days_of_use: number
  discount_percent: number
  vat_percent: number
  show_price_per_line: boolean
  equipment_subtotal: number
  crew_subtotal: number
  transport_subtotal: number
  total_before_discount: number
  total_after_discount: number
  total_with_vat: number
  based_on_offer_id: UUID | null
  locked: boolean
  created_at: string
  updated_at: string
  bookings_synced_at: string | null
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  accepted_by_name: string | null
  accepted_by_email: string | null
  accepted_by_phone: string | null
  rejected_at: string | null
  rejected_by_name: string | null
  rejected_by_phone: string | null
  rejection_comment: string | null
  revision_requested_at: string | null
  revision_requested_by_name: string | null
  revision_requested_by_phone: string | null
  revision_comment: string | null
}

export type OfferEquipmentGroup = {
  id: UUID
  offer_id: UUID
  group_name: string
  sort_order: number
  created_at: string
}

export type OfferEquipmentItem = {
  id: UUID
  offer_group_id: UUID
  item_id: UUID | null
  group_id: UUID | null
  quantity: number
  unit_price: number
  total_price: number
  is_internal: boolean
  sort_order: number
  // Joined relation
  item?: {
    id: UUID
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
    external_owner_name?: string | null
    brand?: { id: UUID; name: string } | null
    model?: string | null
  } | null
  group?: {
    id: UUID
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
    external_owner_name?: string | null
  } | null
}

export type OfferCrewItem = {
  id: UUID
  offer_id: UUID
  role_title: string
  role_category?: string | null
  crew_count: number
  start_date: string
  end_date: string
  daily_rate: number
  hourly_rate?: number | null
  hours_per_day?: number | null
  billing_type?: 'daily' | 'hourly' | null
  total_price: number
  sort_order: number
}

export type OfferTransportItem = {
  id: UUID
  offer_id: UUID
  vehicle_name: string
  vehicle_id: UUID | null
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
  daily_rate: number
  distance_rate?: number | null
  total_price: number
  is_internal: boolean
  sort_order: number
  // Joined relation
  vehicle?: {
    id: UUID
    name: string
    external_owner_id?: UUID | null
  } | null
}

export type OfferPrettySection = {
  id: UUID
  offer_id: UUID
  section_type: PrettySectionType
  title: string | null
  content: string | null
  image_url: string | null
  sort_order: number
}

// Detail with joined relations
export type OfferDetail = JobOffer & {
  groups?: Array<OfferEquipmentGroup & { items: Array<OfferEquipmentItem> }>
  crew_items?: Array<OfferCrewItem>
  transport_items?: Array<OfferTransportItem>
  pretty_sections?: Array<OfferPrettySection>
  job_title?: string | null
  company_terms?: {
    type: 'pdf' | 'text' | null
    text: string | null
    pdf_path: string | null
  }
  company_expansion?: {
    vehicle_daily_rate: number | null
    vehicle_distance_rate: number | null
    vehicle_distance_increment: number | null
    rental_factor_config?: unknown | null
  }
  customer?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
    logo_path: string | null
  }
  customer_contact?: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
  }
  project_lead?: {
    user_id: string
    display_name: string | null
    email: string
    phone: string | null
  }
  company?: {
    id: string
    name: string
    address: string | null
    logo_light_path: string | null
    logo_dark_path: string | null
    accent_color?: string | null
  }
}

// Acceptance data
export type OfferAcceptance = {
  first_name: string
  last_name: string
  phone: string
  terms_accepted: boolean
}

// Rejection data
export type OfferRejection = {
  first_name: string
  last_name: string
  phone: string
  comment: string
}

// Revision request data
export type OfferRevisionRequest = {
  first_name: string
  last_name: string
  phone: string
  comment: string
}
